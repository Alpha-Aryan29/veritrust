'use strict';
const path = require('path');
const express = require('express');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const { startChain, idOf } = require('./chain');
const svc = require('./service');
const { runScenarios } = require('./scenarios');
const { REASONS } = require('./verifier');
const { createEventHub } = require('./events');
const { renderVerifyHtml } = require('./verifyPage');

const PORT = Number(process.env.PORT) || 3000;
const clip = (v, n = 120) => String(v ?? '').slice(0, n);

// Lightweight in-memory sliding-window rate limiter
function rateLimit({ windowMs = 60000, max = 180 } = {}) {
  const hits = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, item] of hits.entries()) {
      if (now > item.reset) hits.delete(ip);
    }
  }, windowMs);
  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let record = hits.get(ip);
    if (!record || now > record.reset) {
      record = { count: 1, reset: now + windowMs };
      hits.set(ip, record);
    } else {
      record.count++;
    }
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    if (record.count > max) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
}

async function createApp() {
  const ctx = await startChain();
  const issued = []; // records issued through this demo session
  const hub = createEventHub(ctx);
  await hub.initRecentBlocks();

  // Attach contract confirmation hook to push blocks and status to SSE clients
  ctx.onTx = async ({ actor, method, args, receipt, res }) => {
    try {
      await hub.pushBlockFromReceipt(receipt, {
        actor,
        method,
        actorLabel: ctx.actors[actor]?.label,
        actorAddress: ctx.actors[actor]?.address,
      });
      const snap = await svc.networkSnapshot(ctx);
      hub.broadcast('status', snap);
    } catch (err) {
      console.error('Error in ctx.onTx hook:', err);
    }
  };

  const app = express();
  const apiLimiter = rateLimit({ windowMs: 60000, max: 200 });

  app.use(express.json({ limit: '512kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

  // SSE endpoint for live updates across dashboard instances
  app.get('/api/events', hub.sseHandler);

  // Recent mined blocks for blockchain ribbon
  app.get('/api/blocks', (_req, res) => res.json(hub.recentBlocks));

  // Registry network status
  app.get('/api/status', apiLimiter, wrap(async (_req, res) => res.json(await svc.networkSnapshot(ctx))));

  // Issue a record (anchored on-chain)
  app.post('/api/issue', apiLimiter, wrap(async (req, res) => {
    const { actor, subject = {}, validDays } = req.body || {};
    if (!ctx.actors[actor] || actor === 'registrar') throw new Error('Choose a valid issuing account');
    const s = {
      name: clip(subject.name, 80) || 'Unnamed Student',
      program: clip(subject.program, 120) || 'B.Tech',
      graduationYear: Number(subject.graduationYear) || new Date().getFullYear(),
      cgpa: Number(subject.cgpa) || 0,
    };
    const days = validDays === null || validDays === '' || validDays === undefined ? null : Number(validDays);
    const r = await svc.issueRecord(ctx, { actor, subject: s, validDays: Number.isFinite(days) ? days : null });
    const entry = {
      recordHash: r.recordHash,
      credential: r.credential,
      actor,
      issuedBy: r.issuedBy,
      anchored: r.anchored,
      name: s.name,
      program: s.program,
      at: Date.now(),
    };
    issued.unshift(entry);
    hub.broadcast('record_issued', entry);
    res.json(r);
  }));

  // Verify a credential
  app.post('/api/verify', apiLimiter, wrap(async (req, res) => {
    const result = await svc.verify(ctx, req.body && req.body.credential);
    hub.broadcast('verification', { verdict: result.verdict, label: result.label, valid: result.valid, timestamp: Date.now() });
    res.json(result);
  }));

  // Revoke a record
  app.post('/api/revoke', apiLimiter, wrap(async (req, res) => {
    const { actor, recordHash, reason } = req.body || {};
    if (!ctx.actors[actor]) throw new Error('Choose a valid account');
    if (!/^0x[0-9a-fA-F]{64}$/.test(recordHash || '')) throw new Error('Invalid record hash');
    const reasonCode = Math.min(4, Math.max(0, Number(reason) || 0));
    const result = await svc.revokeRecord(ctx, { actor, recordHash, reason: reasonCode });
    if (result.revoked) {
      hub.broadcast('record_revoked', {
        recordHash,
        actor,
        by: result.by,
        reason: REASONS[reasonCode] || 'Unspecified',
        reasonCode,
        txHash: result.tx?.txHash,
      });
    }
    res.json(result);
  }));

  // Suspend / reinstate institution
  app.post('/api/institution/status', apiLimiter, wrap(async (req, res) => {
    const { id, active } = req.body || {};
    if (!/^[A-Z0-9]{2,10}$/.test(id || '')) throw new Error('Invalid institution');
    const result = await svc.exec(ctx, 'registrar', 'setInstitutionActive', [idOf(id), !!active]);
    if (result.ok) {
      hub.broadcast('institution_status', { id, active: !!active });
    }
    res.json(result);
  }));

  // Records issued in this session
  app.get('/api/records', apiLimiter, wrap(async (_req, res) => {
    const rows = [];
    for (const r of issued.slice(0, 50)) {
      const rec = await ctx.reader.getRecord(r.recordHash);
      rows.push({
        recordHash: r.recordHash,
        name: r.name,
        program: r.program,
        issuedBy: r.issuedBy,
        actor: r.actor,
        anchored: rec.exists,
        revoked: rec.revoked,
        reason: rec.revoked ? REASONS[Number(rec.reason)] : null,
        credential: r.credential,
      });
    }
    res.json(rows);
  }));

  // Single record details + live verification
  app.get('/api/records/:hash', apiLimiter, wrap(async (req, res) => {
    const hash = req.params.hash;
    const found = issued.find((x) => x.recordHash.toLowerCase() === hash.toLowerCase());
    const rec = await ctx.reader.getRecord(hash);
    if (!found && !rec.exists) {
      return res.status(404).json({ error: 'Record not found' });
    }
    let verification = null;
    if (found?.credential) {
      verification = await svc.verify(ctx, found.credential);
    }
    const inst = rec.exists ? await ctx.reader.getInstitution(rec.institutionId) : null;
    res.json({
      record: found || null,
      onChain: {
        exists: rec.exists,
        institutionId: rec.institutionId,
        institutionName: inst?.name || null,
        issuer: rec.issuer,
        issuedAt: Number(rec.issuedAt),
        revoked: rec.revoked,
        revokedAt: Number(rec.revokedAt),
        revokedBy: rec.revokedBy,
        reason: rec.revoked ? REASONS[Number(rec.reason)] : null,
      },
      verification,
    });
  }));

  // Generate QR code data URL (offline, local npm package)
  app.get('/api/qr', apiLimiter, wrap(async (req, res) => {
    const text = String(req.query.text || '');
    if (!text) throw new Error('Missing text query parameter');
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      width: 280,
      margin: 1,
      color: { dark: '#16202A', light: '#FFFFFF' },
    });
    res.json({ dataUrl });
  }));

  // Public mobile-friendly verification page for judges / scanners
  app.get('/v/:id', wrap(async (req, res) => {
    const id = req.params.id;
    const found = issued.find((x) => x.recordHash.toLowerCase() === id.toLowerCase() || x.credential?.id === id);
    const rec = await ctx.reader.getRecord(found?.recordHash || id);
    const inst = rec.exists ? await ctx.reader.getInstitution(rec.institutionId) : null;
    let verification = null;
    if (found?.credential) {
      verification = await svc.verify(ctx, found.credential);
    }

    const onChain = {
      exists: rec.exists,
      institutionId: rec.institutionId,
      institutionName: inst?.name || null,
      issuer: rec.issuer,
      issuedAt: Number(rec.issuedAt),
      revoked: rec.revoked,
      revokedAt: Number(rec.revokedAt),
      revokedBy: rec.revokedBy,
      reason: rec.revoked ? REASONS[Number(rec.reason)] : null,
    };

    const host = req.get('host') || `localhost:${PORT}`;
    const reqUrl = `${req.protocol}://${host}/v/${encodeURIComponent(id)}`;
    const html = await renderVerifyHtml({ id, reqUrl, record: found, onChain, verification });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }));

  app.get('/api/audit', apiLimiter, wrap(async (_req, res) => res.json((await svc.auditLog(ctx)).reverse())));
  app.post('/api/scenarios/run', apiLimiter, wrap(async (_req, res) => res.json(await runScenarios(ctx))));
  app.get('/api/reasons', (_req, res) => res.json(REASONS));

  return { app, ctx, hub, issued };
}

if (require.main === module) {
  createApp().then(({ app, ctx }) => {
    app.listen(PORT, () => {
      console.log(`\nVeriTrust is running`);
      console.log(`  Dashboard : http://localhost:${PORT}`);
      console.log(`  Registry  : ${ctx.address} (local in-memory chain, id 1337)\n`);
    });
  }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { createApp };

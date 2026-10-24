'use strict';
const path = require('path');
const express = require('express');
const { ethers } = require('ethers');
const { startChain, idOf } = require('./chain');
const svc = require('./service');
const { runScenarios } = require('./scenarios');
const { REASONS } = require('./verifier');

const PORT = Number(process.env.PORT) || 3000;
const clip = (v, n = 120) => String(v ?? '').slice(0, n);

async function createApp() {
  const ctx = await startChain();
  const issued = []; // records issued through this demo session (the "holder wallet" view)

  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

  app.get('/api/status', wrap(async (_req, res) => res.json(await svc.networkSnapshot(ctx))));

  app.post('/api/issue', wrap(async (req, res) => {
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
    issued.unshift({ recordHash: r.recordHash, credential: r.credential, actor, issuedBy: r.issuedBy, anchored: r.anchored, name: s.name, program: s.program, at: Date.now() });
    res.json(r);
  }));

  app.post('/api/verify', wrap(async (req, res) => {
    res.json(await svc.verify(ctx, req.body && req.body.credential));
  }));

  app.post('/api/revoke', wrap(async (req, res) => {
    const { actor, recordHash, reason } = req.body || {};
    if (!ctx.actors[actor]) throw new Error('Choose a valid account');
    if (!/^0x[0-9a-fA-F]{64}$/.test(recordHash || '')) throw new Error('Invalid record hash');
    res.json(await svc.revokeRecord(ctx, { actor, recordHash, reason: Math.min(4, Math.max(0, Number(reason) || 0)) }));
  }));

  app.post('/api/institution/status', wrap(async (req, res) => {
    const { id, active } = req.body || {};
    if (!/^[A-Z0-9]{2,10}$/.test(id || '')) throw new Error('Invalid institution');
    res.json(await svc.exec(ctx, 'registrar', 'setInstitutionActive', [idOf(id), !!active]));
  }));

  app.get('/api/records', wrap(async (_req, res) => {
    const rows = [];
    for (const r of issued.slice(0, 50)) {
      const rec = await ctx.reader.getRecord(r.recordHash);
      rows.push({
        recordHash: r.recordHash, name: r.name, program: r.program, issuedBy: r.issuedBy, actor: r.actor,
        anchored: rec.exists, revoked: rec.revoked, reason: rec.revoked ? REASONS[Number(rec.reason)] : null, credential: r.credential,
      });
    }
    res.json(rows);
  }));

  app.get('/api/audit', wrap(async (_req, res) => res.json((await svc.auditLog(ctx)).reverse())));
  app.post('/api/scenarios/run', wrap(async (_req, res) => res.json(await runScenarios(ctx))));
  app.get('/api/reasons', (_req, res) => res.json(REASONS));

  return { app, ctx };
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

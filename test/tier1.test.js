'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createApp } = require('../src/server');

let app;
let ctx;
let hub;
let server;
let baseUrl;

test.before(async () => {
  const instance = await createApp();
  app = instance.app;
  ctx = instance.ctx;
  hub = instance.hub;

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) server.close();
  if (ctx && ctx.raw) await ctx.raw.disconnect();
});

test('Tier 1: /api/blocks returns recent blocks from chain deployment and seeding', async () => {
  const res = await fetch(`${baseUrl}/api/blocks`);
  assert.equal(res.status, 200);
  const blocks = await res.json();
  assert.ok(Array.isArray(blocks));
  assert.ok(blocks.length > 0, 'Seeded blocks should be present');
  assert.ok(blocks[0].txHash, 'Block should have txHash');
  assert.ok(blocks[0].blockNumber !== undefined, 'Block should have blockNumber');
});

test('Tier 1: /api/qr generates a valid offline QR code data URL', async () => {
  const res = await fetch(`${baseUrl}/api/qr?text=https://example.com/v/test`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.dataUrl.startsWith('data:image/png;base64,'));
});

test('Tier 1: SSE /api/events connects and receives events upon issue and revoke', async () => {
  // Connect to SSE stream
  const eventsReceived = [];
  let sseReq;

  const sseConnected = new Promise((resolve, reject) => {
    sseReq = http.get(`${baseUrl}/api/events`, (res) => {
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['content-type'], 'text/event-stream');
      res.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventsReceived.push(line.replace('event: ', '').trim());
          }
        }
        if (eventsReceived.includes('init')) resolve();
      });
      res.on('error', reject);
    });
  });

  await sseConnected;
  assert.ok(eventsReceived.includes('init'), 'Should receive init event on connect');

  // Issue a record via API
  const issueRes = await fetch(`${baseUrl}/api/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'sitRegistry',
      subject: { name: 'SSE Test Student', program: 'B.Tech CS' },
      validDays: 365,
    }),
  });
  assert.equal(issueRes.status, 200);
  const issued = await issueRes.json();
  assert.equal(issued.anchored, true);

  // Give short moment for SSE event delivery
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(eventsReceived.includes('record_issued') || eventsReceived.includes('block'), 'Should receive record_issued or block event');

  // Revoke record via API
  const revokeRes = await fetch(`${baseUrl}/api/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'sitRegistry',
      recordHash: issued.recordHash,
      reason: 1,
    }),
  });
  assert.equal(revokeRes.status, 200);

  await new Promise((r) => setTimeout(r, 200));
  assert.ok(eventsReceived.includes('record_revoked'), 'Should receive record_revoked event');

  sseReq.destroy();
});

test('Tier 1: /v/:id serves standalone verification HTML with 7 checks and QR code', async () => {
  // Issue record
  const issueRes = await fetch(`${baseUrl}/api/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'sitRegistry',
      subject: { name: 'Public Page Student', program: 'B.Tech IT' },
    }),
  });
  const issued = await issueRes.json();

  // Fetch /v/:hash
  const res = await fetch(`${baseUrl}/v/${issued.recordHash}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const html = await res.text();

  assert.ok(html.includes('Public Page Student'), 'Student name rendered in certificate view');
  assert.ok(html.includes('Verification Chain of Trust'), 'Chain of trust present');
  assert.ok(html.includes('data:image/png;base64,'), 'QR code embedded in page');
  assert.ok(html.includes('Record is well formed'), 'First check present');
});

test('Tier 1: /v/:id displays honest message for unknown record hashes', async () => {
  const unknownHash = '0x' + '99'.repeat(32);
  const res = await fetch(`${baseUrl}/v/${unknownHash}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Not registered'), 'Should state not registered');
  assert.ok(html.includes('never anchored in this trust registry'), 'Honest explanation for unknown hash');
});

test('Tier 1: API requests include rate limit headers and validate bodies', async () => {
  const res = await fetch(`${baseUrl}/api/status`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('x-ratelimit-limit'), 'Limit header present');
  assert.ok(res.headers.get('x-ratelimit-remaining') !== null, 'Remaining header present');

  // Body validation: missing actor
  const badRes = await fetch(`${baseUrl}/api/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: { name: 'Bad' } }),
  });
  assert.equal(badRes.status, 400);
  const errData = await badRes.json();
  assert.ok(errData.error);
});

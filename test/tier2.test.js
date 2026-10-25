'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/server');

let app;
let ctx;
let server;
let baseUrl;

test.before(async () => {
  const instance = await createApp();
  app = instance.app;
  ctx = instance.ctx;

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

test('Tier 2: /api/tamper computes cryptographic avalanche variance and re-verifies verdict', async () => {
  // 1. Issue a valid credential first
  const issueRes = await fetch(`${baseUrl}/api/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'sitRegistry',
      subject: { name: 'Asha Patil', program: 'B.Tech in Computer Engineering', graduationYear: 2026, cgpa: 8.4 },
      validDays: 3650,
    }),
  });
  assert.equal(issueRes.status, 200);
  const { credential } = await issueRes.json();

  // 2. Tamper with CGPA (e.g. 8.4 -> 9.9)
  const tamperRes = await fetch(`${baseUrl}/api/tamper`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential,
      mutations: { cgpa: 9.9 },
    }),
  });
  assert.equal(tamperRes.status, 200);
  const data = await tamperRes.json();

  assert.ok(data.originalHash);
  assert.ok(data.mutatedHash);
  assert.notEqual(data.originalHash, data.mutatedHash);
  assert.ok(data.flippedBits > 50, `Expected avalanche bit flip > 50 bits, got ${data.flippedBits}`);
  assert.ok(data.avalanchePercent > 20, `Expected variance > 20%, got ${data.avalanchePercent}%`);
  assert.ok(Array.isArray(data.charDiff));
  assert.equal(data.charDiff.length, 64);

  // Verification of tampered credential should fail with TAMPERED verdict
  assert.equal(data.verification.valid, false);
  assert.equal(data.verification.verdict, 'TAMPERED');
  assert.equal(data.verification.checks[1].status, 'fail'); // Check 2: Signature
  assert.equal(data.verification.checks[2].status, 'skipped'); // Checks 3-7 skipped
});

test('Tier 2: /api/issue-batch issues multiple credentials in 1 EVM transaction with gas savings', async () => {
  const records = [
    { name: 'Aditi Sharma', program: 'B.Tech Computer Eng', graduationYear: 2026, cgpa: 9.24 },
    { name: 'Rohan Deshmukh', program: 'B.Tech AI', graduationYear: 2026, cgpa: 8.85 },
    { name: 'Kavya Iyer', program: 'B.Tech Data Science', graduationYear: 2026, cgpa: 9.12 },
    { name: 'Arjun Kulkarni', program: 'B.Tech Cyber Security', graduationYear: 2026, cgpa: 8.40 },
  ];

  const res = await fetch(`${baseUrl}/api/issue-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'sitRegistry',
      records,
      validDays: 3650,
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.anchored, true);
  assert.equal(data.count, 4);
  assert.ok(data.totalGas > 0);
  assert.ok(data.gasPerRecord > 0);
  assert.ok(data.gasPerRecord < 80000, `Expected batch gas/record < 80k, got ${data.gasPerRecord}`);
  assert.ok(data.savingsPercent > 25, `Expected savings > 25%, got ${data.savingsPercent}%`);
  assert.equal(data.items.length, 4);

  // Verify the first batch item against the registry
  const firstCred = data.items[0].credential;
  const verifyRes = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: firstCred }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.equal(verifyData.valid, true);
  assert.equal(verifyData.verdict, 'VALID');
  assert.equal(verifyData.checks.every((c) => c.status === 'pass'), true);

  // Revoke the batch-issued record
  const revokeRes = await fetch(`${baseUrl}/api/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor: 'sitRegistry',
      recordHash: data.items[0].recordHash,
      reason: 2, // Fraud or misconduct
    }),
  });
  assert.equal(revokeRes.status, 200);
  const revokeData = await revokeRes.json();
  assert.equal(revokeData.revoked, true);

  // Verify again: should now be REVOKED
  const verifyRevokedRes = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: firstCred }),
  });
  const verifyRevoked = await verifyRevokedRes.json();
  assert.equal(verifyRevoked.valid, false);
  assert.equal(verifyRevoked.verdict, 'REVOKED');
});

test('Tier 2: /api/analytics returns aggregated telemetry, gas benchmarks, and verdict counts', async () => {
  const res = await fetch(`${baseUrl}/api/analytics`);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(data.verifications);
  assert.ok(data.verifications.total > 0);
  assert.ok(Array.isArray(data.institutions));
  assert.ok(data.institutions.length >= 2);
  assert.ok(data.gas);
  assert.ok(data.gas.savingsPercent > 40);
  assert.ok(data.reasonsBreakdown);
  assert.ok(data.reasonsBreakdown['Fraud or misconduct'] >= 1);
});

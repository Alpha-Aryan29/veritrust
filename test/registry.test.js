'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');
const { startChain, idOf } = require('../src/chain');
const svc = require('../src/service');
const { runScenarios } = require('../src/scenarios');
const { canonicalize, hashCredential } = require('../src/credential');
const { verifyCredential } = require('../src/verifier');

let ctx;
const subject = (name) => ({ name, program: 'B.Tech', cgpa: 8.1 });
const clone = (o) => JSON.parse(JSON.stringify(o));

test.before(async () => {
  ctx = await startChain();
});

test.after(async () => {
  await ctx.raw.disconnect();
});

test('MVP 1: a valid record from an authorized issuer verifies', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Valid Student') });
  assert.equal(r.anchored, true);
  const v = await svc.verify(ctx, r.credential);
  assert.equal(v.verdict, 'VALID');
  assert.ok(v.checks.every((c) => c.status === 'pass'));
});

test('MVP 2: any modification to a record is detected', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Tamper Target') });
  for (const mutate of [
    (c) => { c.credentialSubject.cgpa = 9.9; },
    (c) => { c.credentialSubject.name = 'Someone Else'; },
    (c) => { c.issuanceDate = '2001-01-01T00:00:00.000Z'; },
    (c) => { c.proof.proofValue = c.proof.proofValue.slice(0, -4) + '0000'; },
    (c) => { c.issuer = 'did:ethr:' + ctx.actors.ksuRegistry.address; },
  ]) {
    const c = clone(r.credential);
    mutate(c);
    assert.equal((await svc.verify(ctx, c)).verdict, 'TAMPERED');
  }
});

test('MVP 3: unauthorized issuance is rejected on-chain and the forged record fails verification', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'rogue', subject: subject('Forged Graduate') });
  assert.equal(r.anchored, false);
  assert.equal(r.tx.error, 'NotAuthorizedIssuer');
  assert.equal((await svc.verify(ctx, r.credential)).verdict, 'UNAUTHORIZED_ISSUER');
});

test('MVP 4: revocation is detected, and only the issuing institution can revoke', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Revoke Me') });
  for (const actor of ['ksuRegistry', 'ksuAdmin', 'rogue', 'registrar']) {
    const x = await svc.revokeRecord(ctx, { actor, recordHash: r.recordHash, reason: 2 });
    assert.equal(x.tx.error, 'NotRecordAuthority', `${actor} must not be able to revoke`);
  }
  assert.equal((await svc.verify(ctx, r.credential)).verdict, 'VALID');
  const ok = await svc.revokeRecord(ctx, { actor: 'sitExam', recordHash: r.recordHash, reason: 1 });
  assert.equal(ok.revoked, true);
  const v = await svc.verify(ctx, r.credential);
  assert.equal(v.verdict, 'REVOKED');
  assert.equal(v.onChain.reason, 'Issued in error');
  const again = await svc.revokeRecord(ctx, { actor: 'sitAdmin', recordHash: r.recordHash });
  assert.equal(again.tx.error, 'AlreadyRevoked');
});

test('the institution admin may also revoke', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'ksuRegistry', subject: subject('Admin Revoke') });
  assert.equal((await svc.revokeRecord(ctx, { actor: 'ksuAdmin', recordHash: r.recordHash })).revoked, true);
});

test('revoking an unknown record is rejected', async () => {
  const x = await svc.revokeRecord(ctx, { actor: 'sitAdmin', recordHash: ethers.id('never issued') });
  assert.equal(x.tx.error, 'RecordUnknown');
});

test('registry governance: only the owner registers institutions, only admins add issuers', async () => {
  const stranger = await svc.exec(ctx, 'rogue', 'registerInstitution', [idOf('EVIL'), 'Evil Univ', ctx.actors.rogue.address]);
  assert.equal(stranger.error, 'NotOwner');
  const dupInst = await svc.exec(ctx, 'registrar', 'registerInstitution', [idOf('SIT'), 'Again', ctx.actors.sitAdmin.address]);
  assert.equal(dupInst.error, 'InstitutionExists');
  const selfAuth = await svc.exec(ctx, 'rogue', 'addIssuer', [idOf('SIT'), ctx.actors.rogue.address]);
  assert.equal(selfAuth.error, 'NotInstitutionAdmin');
  const crossAuth = await svc.exec(ctx, 'ksuAdmin', 'addIssuer', [idOf('SIT'), ctx.actors.rogue.address]);
  assert.equal(crossAuth.error, 'NotInstitutionAdmin');
  const twice = await svc.exec(ctx, 'sitAdmin', 'addIssuer', [idOf('SIT'), ctx.actors.sitRegistry.address]);
  assert.equal(twice.error, 'IssuerAlreadyAuthorized');
  const suspend = await svc.exec(ctx, 'sitAdmin', 'setInstitutionActive', [idOf('SIT'), false]);
  assert.equal(suspend.error, 'NotOwner');
});

test('duplicate anchoring of the same hash is rejected', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Dup') });
  assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueRecord', [r.recordHash])).error, 'RecordExists');
  assert.equal((await svc.exec(ctx, 'sitExam', 'issueRecord', [r.recordHash])).error, 'RecordExists');
});

test('a valid signature that was never anchored is flagged NOT_ANCHORED', async () => {
  const { signCredential, buildCredential } = require('../src/credential');
  const c = await signCredential(
    buildCredential({ issuerAddress: ctx.actors.sitRegistry.address, subject: subject('Unregistered') }),
    ctx.actors.sitRegistry.wallet
  );
  assert.equal((await svc.verify(ctx, c)).verdict, 'NOT_ANCHORED');
});

test('an authorized issuer cannot pass off another issuer\'s anchor (issuer mismatch)', async () => {
  const { signCredential, buildCredential } = require('../src/credential');
  // KSU key signs a record; SIT key anchors that exact hash.
  const c = await signCredential(
    buildCredential({ issuerAddress: ctx.actors.ksuRegistry.address, subject: subject('Mismatch') }),
    ctx.actors.ksuRegistry.wallet
  );
  assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueRecord', [hashCredential(c)])).ok, true);
  assert.equal((await svc.verify(ctx, c)).verdict, 'ISSUER_MISMATCH');
});

test('expired record is flagged', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Old'), validDays: -2 });
  const v = await svc.verify(ctx, r.credential);
  assert.equal(v.verdict, 'EXPIRED');
  assert.equal(v.valid, false);
  const validityCheck = v.checks.find((c) => c.id === 'validity');
  assert.equal(validityCheck.status, 'fail');
  assert.ok(validityCheck.detail.startsWith('Expired on '));
});

test('valid future expiration date verifies with VALID', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Future Expiry'), validDays: 365 });
  const v = await svc.verify(ctx, r.credential);
  assert.equal(v.verdict, 'VALID');
  assert.equal(v.valid, true);
  const validityCheck = v.checks.find((c) => c.id === 'validity');
  assert.equal(validityCheck.status, 'pass');
  assert.ok(validityCheck.detail.startsWith('Valid until '));
});

test('invalid expiration date string is flagged MALFORMED', async () => {
  const { signCredential, buildCredential } = require('../src/credential');
  for (const badDate of ['not-a-date', '2025-99-99', 'invalid-iso-string']) {
    const unsigned = buildCredential({ issuerAddress: ctx.actors.sitRegistry.address, subject: subject('Invalid Expiry ' + badDate) });
    unsigned.expirationDate = badDate;
    const signed = await signCredential(unsigned, ctx.actors.sitRegistry.wallet);
    assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueRecord', [hashCredential(signed)])).ok, true);
    const v = await svc.verify(ctx, signed);
    assert.equal(v.verdict, 'MALFORMED', `Expected MALFORMED for date: ${badDate}`);
    assert.equal(v.valid, false);
    const validityCheck = v.checks.find((c) => c.id === 'validity');
    assert.equal(validityCheck.status, 'fail');
    assert.equal(validityCheck.detail, 'Invalid expiration date format');
  }
});

test('empty or missing expiration date verifies as VALID with No expiry set according to conventions', async () => {
  const { signCredential, buildCredential } = require('../src/credential');
  // 1. Missing expiration date (omitted)
  const rMissing = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Missing Expiry') });
  assert.equal(rMissing.credential.expirationDate, undefined);
  const vMissing = await svc.verify(ctx, rMissing.credential);
  assert.equal(vMissing.verdict, 'VALID');
  assert.equal(vMissing.valid, true);
  assert.equal(vMissing.checks.find((c) => c.id === 'validity').detail, 'No expiry set');

  // 2. Empty string expiration date
  const unsignedEmptyStr = buildCredential({ issuerAddress: ctx.actors.sitRegistry.address, subject: subject('Empty Expiry Str') });
  unsignedEmptyStr.expirationDate = '';
  const signedEmptyStr = await signCredential(unsignedEmptyStr, ctx.actors.sitRegistry.wallet);
  assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueRecord', [hashCredential(signedEmptyStr)])).ok, true);
  const vEmptyStr = await svc.verify(ctx, signedEmptyStr);
  assert.equal(vEmptyStr.verdict, 'VALID');
  assert.equal(vEmptyStr.valid, true);
  assert.equal(vEmptyStr.checks.find((c) => c.id === 'validity').detail, 'No expiry set');

  // 3. Null expiration date
  const unsignedNull = buildCredential({ issuerAddress: ctx.actors.sitRegistry.address, subject: subject('Null Expiry') });
  unsignedNull.expirationDate = null;
  const signedNull = await signCredential(unsignedNull, ctx.actors.sitRegistry.wallet);
  assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueRecord', [hashCredential(signedNull)])).ok, true);
  const vNull = await svc.verify(ctx, signedNull);
  assert.equal(vNull.verdict, 'VALID');
  assert.equal(vNull.valid, true);
  assert.equal(vNull.checks.find((c) => c.id === 'validity').detail, 'No expiry set');
});

test('non-string and whitespace expiration dates are flagged MALFORMED without throwing', async () => {
  const { signCredential, buildCredential } = require('../src/credential');
  for (const badExp of [1735689600000, true, {}, '   ']) {
    const unsigned = buildCredential({ issuerAddress: ctx.actors.sitRegistry.address, subject: subject('Bad Exp Type') });
    unsigned.expirationDate = badExp;
    const signed = await signCredential(unsigned, ctx.actors.sitRegistry.wallet);
    assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueRecord', [hashCredential(signed)])).ok, true);
    const v = await svc.verify(ctx, signed);
    assert.equal(v.verdict, 'MALFORMED', `Expected MALFORMED for non-string/whitespace expirationDate: ${badExp}`);
    assert.equal(v.valid, false);
    const validityCheck = v.checks.find((c) => c.id === 'validity');
    assert.equal(validityCheck.status, 'fail');
    assert.equal(validityCheck.detail, 'Invalid expiration date format');
  }
});

test('removing an issuer key blocks new issuance but keeps earlier records valid', async () => {
  const early = await svc.issueRecord(ctx, { actor: 'sitExam', subject: subject('Before Removal') });
  assert.equal((await svc.exec(ctx, 'sitAdmin', 'removeIssuer', [ctx.actors.sitExam.address])).ok, true);
  assert.equal((await svc.exec(ctx, 'sitExam', 'issueRecord', [ethers.id('x')])).error, 'NotAuthorizedIssuer');
  assert.equal((await svc.verify(ctx, early.credential)).verdict, 'VALID');
  assert.equal((await svc.exec(ctx, 'sitAdmin', 'addIssuer', [idOf('SIT'), ctx.actors.sitExam.address])).ok, true);
});

test('institution suspension blocks issuance and flags its records', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'ksuRegistry', subject: subject('Before Suspension') });
  await svc.exec(ctx, 'registrar', 'setInstitutionActive', [idOf('KSU'), false]);
  assert.equal((await svc.verify(ctx, r.credential)).verdict, 'INSTITUTION_SUSPENDED');
  assert.equal((await svc.exec(ctx, 'ksuRegistry', 'issueRecord', [ethers.id('y')])).error, 'InstitutionInactive');
  await svc.exec(ctx, 'registrar', 'setInstitutionActive', [idOf('KSU'), true]);
  assert.equal((await svc.verify(ctx, r.credential)).verdict, 'VALID');
});

test('malformed input never throws', async () => {
  for (const bad of ['not json', '{}', '{"issuer":"x","credentialSubject":{},"proof":{"proofValue":"0x"}}', 'null', '[]']) {
    const v = await svc.verify(ctx, bad);
    assert.equal(v.verdict, 'MALFORMED', bad);
  }
});

test('privacy: personal data never reaches the chain, only a salted hash', async () => {
  const marker = 'Unmistakable Personal Name 12345';
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: { name: marker, program: 'Secret Program' } });
  const logs = await ctx.provider.getLogs({ address: ctx.address, fromBlock: 0, toBlock: 'latest' });
  const haystack = logs.map((l) => l.data + l.topics.join('')).join('').toLowerCase();
  assert.ok(!haystack.includes(Buffer.from(marker).toString('hex')));
  assert.ok(!haystack.includes(Buffer.from('Secret Program').toString('hex')));
  assert.ok(haystack.includes(r.recordHash.slice(2).toLowerCase()), 'the record hash is anchored');
  // Same content with a fresh salt yields a different hash: the hash cannot be brute-forced from guessable fields.
  const r2 = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: { name: marker, program: 'Secret Program' } });
  assert.notEqual(r.recordHash, r2.recordHash);
});

test('verification needs only read access: no key, no issuer contact', async () => {
  const r = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: subject('Reader Test') });
  const readOnly = new ethers.Contract(ctx.address, ctx.abi, ctx.provider); // provider only, no signer
  assert.equal((await verifyCredential(readOnly, r.credential)).verdict, 'VALID');
});

test('canonicalization is order-independent', () => {
  assert.equal(canonicalize({ b: 1, a: { d: [2, 1], c: 'x' } }), canonicalize({ a: { c: 'x', d: [2, 1] }, b: 1 }));
});

test('batch issuance anchors many records in one transaction', async () => {
  const hashes = Array.from({ length: 25 }, (_, i) => ethers.id('batch-' + i));
  const tx = await ctx.as('sitRegistry').issueBatch(hashes);
  const rc = await tx.wait();
  assert.ok(Number(rc.gasUsed) / 25 < 90000, 'batching lowers per-record gas');
  assert.equal((await ctx.reader.getRecord(hashes[24])).exists, true);
  assert.equal((await svc.exec(ctx, 'sitRegistry', 'issueBatch', [[]])).error, 'EmptyBatch');
});

test('audit log is rebuilt from on-chain events only', async () => {
  const log = await svc.auditLog(ctx);
  const kinds = new Set(log.map((e) => e.event));
  for (const k of ['InstitutionRegistered', 'IssuerAuthorized', 'RecordIssued', 'RecordRevoked', 'IssuerRemoved', 'InstitutionStatusChanged']) {
    assert.ok(kinds.has(k), `${k} present`);
  }
});

test('scripted scenarios all pass and can be re-run', async () => {
  for (let i = 0; i < 2; i++) {
    const { passed, total, results } = await runScenarios(ctx);
    assert.equal(passed, total, JSON.stringify(results.filter((r) => !r.pass)));
  }
});

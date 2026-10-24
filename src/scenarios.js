'use strict';
// Scripted scenarios: the four mandatory MVP demonstrations plus extra edge cases.
// Safe to run repeatedly: scenarios that change standing (key removal, suspension) restore it.
const svc = require('./service');
const { idOf } = require('./chain');

const clone = (o) => JSON.parse(JSON.stringify(o));
const sample = (name, extra = {}) => ({
  name,
  program: 'B.Tech in Computer Engineering',
  graduationYear: 2026,
  cgpa: 8.7,
  ...extra,
});

async function runScenarios(ctx) {
  const results = [];
  const add = (r) => results.push(r);

  // 1. Valid record
  const good = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: sample('Asha Patil'), validDays: 3650 });
  const v1 = await svc.verify(ctx, good.credential);
  add({
    id: 'valid', mandatory: true, title: 'Valid record is accepted',
    expected: 'VALID', actual: v1.verdict, pass: v1.verdict === 'VALID',
    detail: 'SIT issues a certificate; a verifier checks it using only the registry.',
    verification: v1,
  });

  // 2. Modified record
  const forged = clone(good.credential);
  forged.credentialSubject.cgpa = 9.9;
  const v2 = await svc.verify(ctx, forged);
  add({
    id: 'tampered', mandatory: true, title: 'Modified record is detected',
    expected: 'TAMPERED', actual: v2.verdict, pass: v2.verdict === 'TAMPERED',
    detail: 'CGPA changed from 8.7 to 9.9 after signing.', verification: v2,
  });

  // 3. Unauthorized issuer
  const rogue = await svc.issueRecord(ctx, { actor: 'rogue', subject: sample('Fake Graduate', { program: 'MBA' }) });
  const v3 = await svc.verify(ctx, rogue.credential);
  add({
    id: 'unauthorized', mandatory: true, title: 'Unauthorized issuer is rejected',
    expected: 'NotAuthorizedIssuer + UNAUTHORIZED_ISSUER',
    actual: `${rogue.tx.error || 'accepted'} + ${v3.verdict}`,
    pass: !rogue.anchored && rogue.tx.error === 'NotAuthorizedIssuer' && v3.verdict === 'UNAUTHORIZED_ISSUER',
    detail: 'An unregistered key tried to issue. The contract rejected the issuance, and its self-signed record also fails verification.',
    verification: v3,
  });

  // 4. Revoked record, incl. unauthorized revocation attempts
  const toRevoke = await svc.issueRecord(ctx, { actor: 'sitExam', subject: sample('Rohan Mehta') });
  const badRevoke = await svc.revokeRecord(ctx, { actor: 'ksuRegistry', recordHash: toRevoke.recordHash, reason: 2 });
  const outsider = await svc.revokeRecord(ctx, { actor: 'rogue', recordHash: toRevoke.recordHash, reason: 2 });
  const okRevoke = await svc.revokeRecord(ctx, { actor: 'sitRegistry', recordHash: toRevoke.recordHash, reason: 3 });
  const v4 = await svc.verify(ctx, toRevoke.credential);
  add({
    id: 'revoked', mandatory: true, title: 'Revoked record is detected; unauthorized revocation is rejected',
    expected: 'NotRecordAuthority x2, then REVOKED',
    actual: `${badRevoke.tx.error || 'accepted'}, ${outsider.tx.error || 'accepted'}, then ${v4.verdict}`,
    pass: badRevoke.tx.error === 'NotRecordAuthority' && outsider.tx.error === 'NotRecordAuthority' && okRevoke.revoked && v4.verdict === 'REVOKED',
    detail: 'A KSU issuer and an outsider both failed to revoke an SIT record. An SIT issuer revoked it, and verifiers now see the revocation.',
    verification: v4,
  });

  // 5. Duplicate anchoring
  const dup = await svc.exec(ctx, 'sitRegistry', 'issueRecord', [good.recordHash]);
  add({
    id: 'duplicate', mandatory: false, title: 'Duplicate issuance is rejected',
    expected: 'RecordExists', actual: dup.error || 'accepted', pass: dup.error === 'RecordExists',
    detail: 'Anchoring the same record hash twice is refused, so history cannot be rewritten.',
  });

  // 6. Expired record
  const old = await svc.issueRecord(ctx, { actor: 'ksuRegistry', subject: sample('Meera Joshi', { program: 'M.Sc. Data Science' }), validDays: -1 });
  const v6 = await svc.verify(ctx, old.credential);
  add({
    id: 'expired', mandatory: false, title: 'Expired record is flagged',
    expected: 'EXPIRED', actual: v6.verdict, pass: v6.verdict === 'EXPIRED',
    detail: 'Signature and anchor are fine, but the validity window has passed.', verification: v6,
  });

  // 7. Issuer key removal: old records stay valid, new issuance blocked
  const before = await svc.issueRecord(ctx, { actor: 'sitExam', subject: sample('Kabir Shah') });
  await svc.exec(ctx, 'sitAdmin', 'removeIssuer', [ctx.actors.sitExam.address]);
  const after = await svc.exec(ctx, 'sitExam', 'issueRecord', ['0x' + '22'.repeat(32)]);
  const v7 = await svc.verify(ctx, before.credential);
  await svc.exec(ctx, 'sitAdmin', 'addIssuer', [idOf('SIT'), ctx.actors.sitExam.address]);
  add({
    id: 'key-removal', mandatory: false, title: 'Removed issuer key can no longer issue; earlier records stay valid',
    expected: 'NotAuthorizedIssuer, earlier record VALID', actual: `${after.error || 'accepted'}, earlier record ${v7.verdict}`,
    pass: after.error === 'NotAuthorizedIssuer' && v7.verdict === 'VALID',
    detail: 'The key was removed and later re-authorized to keep the demo repeatable.', verification: v7,
  });

  // 8. Institution suspension
  const sus = await svc.issueRecord(ctx, { actor: 'sitRegistry', subject: sample('Neha Kulkarni') });
  await svc.exec(ctx, 'registrar', 'setInstitutionActive', [idOf('SIT'), false]);
  const v8 = await svc.verify(ctx, sus.credential);
  const blocked = await svc.exec(ctx, 'sitRegistry', 'issueRecord', ['0x' + '11'.repeat(32)]);
  await svc.exec(ctx, 'registrar', 'setInstitutionActive', [idOf('SIT'), true]);
  add({
    id: 'suspension', mandatory: false, title: 'Suspended institution is flagged and cannot issue',
    expected: 'INSTITUTION_SUSPENDED + InstitutionInactive', actual: `${v8.verdict} + ${blocked.error || 'accepted'}`,
    pass: v8.verdict === 'INSTITUTION_SUSPENDED' && blocked.error === 'InstitutionInactive',
    detail: 'The registrar suspended SIT, then reinstated it so the demo can be rerun.', verification: v8,
  });

  return { passed: results.filter((r) => r.pass).length, total: results.length, results };
}

module.exports = { runScenarios };

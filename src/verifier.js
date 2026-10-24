'use strict';
// Cross-institution verification. Needs only the credential and READ access to the
// registry: it never contacts the issuing institution.
const { ethers } = require('ethers');
const { hashCredential, recoverSigner, addressFromDid } = require('./credential');

const REASONS = ['Unspecified', 'Issued in error', 'Fraud or misconduct', 'Degree withdrawn', 'Superseded by a new record'];

const VERDICTS = {
  VALID: 'Valid',
  TAMPERED: 'Altered',
  UNAUTHORIZED_ISSUER: 'Unauthorized issuer',
  NOT_ANCHORED: 'Not registered',
  REVOKED: 'Revoked',
  EXPIRED: 'Expired',
  INSTITUTION_SUSPENDED: 'Institution suspended',
  ISSUER_MISMATCH: 'Issuer mismatch',
  MALFORMED: 'Malformed',
};

const STEPS = [
  ['format', 'Record is well formed'],
  ['signature', 'Signature matches the record contents'],
  ['issuer', 'Signer is an authorized issuer'],
  ['anchor', 'Record is anchored on-chain by that issuer'],
  ['institution', 'Issuing institution is in good standing'],
  ['status', 'Record has not been revoked'],
  ['validity', 'Record is within its validity period'],
];

async function verifyCredential(registry, input, { now = Date.now() } = {}) {
  const checks = STEPS.map(([id, label]) => ({ id, label, status: 'pending', detail: '' }));
  const set = (id, status, detail = '') => {
    const c = checks.find((x) => x.id === id);
    c.status = status;
    c.detail = detail;
  };
  const finish = (verdict, reason, extra = {}) => {
    for (const c of checks) if (c.status === 'pending') c.status = 'skipped';
    return { verdict, label: VERDICTS[verdict], valid: verdict === 'VALID', reason, checks, ...extra };
  };

  // 1. Format
  let cred = input;
  try {
    if (typeof input === 'string') cred = JSON.parse(input);
    if (!cred || typeof cred !== 'object') throw new Error('not an object');
    if (!cred.issuer || !cred.credentialSubject || !cred.proof || !cred.proof.proofValue) {
      throw new Error('missing issuer, credentialSubject or proof');
    }
  } catch (e) {
    set('format', 'fail', e.message);
    return finish('MALFORMED', `The record could not be read: ${e.message}.`);
  }
  let claimed;
  try {
    claimed = addressFromDid(cred.issuer);
  } catch (e) {
    set('format', 'fail', e.message);
    return finish('MALFORMED', e.message + '.');
  }
  set('format', 'pass', 'W3C credential structure found');

  const recordHash = hashCredential(cred);

  // 2. Signature / integrity: any edit to the record changes the hash, so the
  //    recovered signer no longer equals the claimed issuer.
  let signer = null;
  try {
    signer = recoverSigner(cred);
  } catch (e) {
    /* invalid signature bytes */
  }
  if (!signer || signer.toLowerCase() !== claimed.toLowerCase()) {
    set('signature', 'fail', signer ? `Signature recovers to ${short(signer)}, not the claimed issuer ${short(claimed)}` : 'Signature bytes are invalid');
    return finish('TAMPERED', 'The record contents or signature were changed after it was signed.', { recordHash });
  }
  set('signature', 'pass', `Signed by ${short(claimed)}`);

  // 3 + 4. Registry lookups (read-only calls)
  const [authorized, instId] = await registry.isAuthorizedIssuer(claimed);
  const rec = await registry.getRecord(recordHash);
  const onChain = {
    exists: rec.exists,
    institutionId: rec.institutionId,
    issuedAt: rec.exists ? Number(rec.issuedAt) : null,
    revoked: rec.revoked,
    revokedAt: rec.revoked ? Number(rec.revokedAt) : null,
    revokedBy: rec.revoked ? rec.revokedBy : null,
    reason: rec.revoked ? REASONS[Number(rec.reason)] || 'Unspecified' : null,
  };

  const knownByAnchor = rec.exists && rec.issuer.toLowerCase() === claimed.toLowerCase();
  if (!authorized && !knownByAnchor) {
    set('issuer', 'fail', `${short(claimed)} is not registered by any institution`);
    return finish('UNAUTHORIZED_ISSUER', 'The signer is not an authorized issuer in the trust registry.', { recordHash, onChain });
  }
  set('issuer', 'pass', authorized ? `Authorized for ${ethers.decodeBytes32String(instId)}` : 'Key was authorized when the record was issued');

  if (!rec.exists) {
    set('anchor', 'fail', 'No issuance entry for this record hash');
    return finish('NOT_ANCHORED', 'A valid issuer signed this, but it was never registered on-chain.', { recordHash, onChain });
  }
  if (rec.issuer.toLowerCase() !== claimed.toLowerCase()) {
    set('anchor', 'fail', `Anchored by ${short(rec.issuer)}, not by ${short(claimed)}`);
    return finish('ISSUER_MISMATCH', 'The on-chain issuance was made by a different key than the one that signed.', { recordHash, onChain });
  }
  set('anchor', 'pass', `Anchored at ${new Date(onChain.issuedAt * 1000).toISOString()}`);

  // 5. Institution standing
  const inst = await registry.getInstitution(rec.institutionId);
  onChain.institutionName = inst.name;
  if (!inst.active) {
    set('institution', 'fail', `${inst.name} is suspended`);
    return finish('INSTITUTION_SUSPENDED', `${inst.name} is currently suspended by the registrar.`, { recordHash, onChain });
  }
  set('institution', 'pass', inst.name);

  // 6. Revocation
  if (rec.revoked) {
    set('status', 'fail', `Revoked: ${onChain.reason}`);
    return finish('REVOKED', `The issuer revoked this record (${onChain.reason}).`, { recordHash, onChain });
  }
  set('status', 'pass', 'No revocation event found');

  // 7. Validity window
  if (cred.expirationDate && Date.parse(cred.expirationDate) < now) {
    set('validity', 'fail', `Expired on ${cred.expirationDate.slice(0, 10)}`);
    return finish('EXPIRED', 'The record is past its expiration date.', { recordHash, onChain });
  }
  set('validity', 'pass', cred.expirationDate ? `Valid until ${cred.expirationDate.slice(0, 10)}` : 'No expiry set');

  return finish('VALID', `Issued by ${inst.name}; unaltered and in good standing.`, { recordHash, onChain });
}

function short(a) {
  return a.slice(0, 6) + '…' + a.slice(-4);
}

module.exports = { verifyCredential, VERDICTS, REASONS };

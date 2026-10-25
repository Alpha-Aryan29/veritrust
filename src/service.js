'use strict';
// Application service: what an institution backend would do (issue, sign, anchor, revoke),
// plus the audit trail. Used by the API server, the CLI demo and the tests.
const { ethers } = require('ethers');
const { buildCredential, signCredential, hashCredential } = require('./credential');
const { verifyCredential, REASONS } = require('./verifier');

/** Turn an ethers revert into a short, named reason such as NotAuthorizedIssuer. */
function revertName(err, iface) {
  try {
    const data = err.data || err.info?.error?.data || err.error?.data;
    if (data && typeof data === 'string' && data.length >= 10) {
      const parsed = iface.parseError(data);
      if (parsed) return parsed.name;
    }
  } catch (_) { /* fall through */ }
  if (err.revert && err.revert.name) return err.revert.name;
  const m = /reverted with custom error '(\w+)/.exec(err.message || '');
  return m ? m[1] : (err.shortMessage || err.message || 'Reverted');
}

/**
 * Run a state-changing contract call as `actor`. A dry run (eth_call) comes first so a
 * rejected call returns its named custom error (e.g. NotAuthorizedIssuer) and costs no gas.
 */
async function exec(ctx, actor, method, args) {
  const contract = ctx.as(actor);
  try {
    await contract[method].staticCall(...args);
  } catch (err) {
    return { ok: false, error: revertName(err, ctx.iface) };
  }
  try {
    const tx = await contract[method](...args);
    const receipt = await tx.wait();
    const res = { ok: true, txHash: receipt.hash, block: receipt.blockNumber, gasUsed: Number(receipt.gasUsed) };
    if (typeof ctx.onTx === 'function') {
      try {
        await ctx.onTx({ actor, method, args, receipt, res });
      } catch (_) { /* don't fail transaction on telemetry hook error */ }
    }
    return res;
  } catch (err) {
    return { ok: false, error: revertName(err, ctx.iface) };
  }
}

/**
 * Issue a record as `actor`. The credential is always signed with the actor's key;
 * anchoring succeeds only if the registry authorizes that key. A rogue actor therefore
 * still gets a signed (forged) credential, but the registry rejects its issuance.
 */
async function issueRecord(ctx, { actor, subject, type, validDays }) {
  const a = ctx.actors[actor];
  if (!a) throw new Error(`Unknown actor: ${actor}`);
  const credential = await signCredential(
    buildCredential({ issuerAddress: a.address, subject, type, validDays }),
    a.wallet
  );
  const recordHash = hashCredential(credential);
  const tx = await exec(ctx, actor, 'issueRecord', [recordHash]);
  return { credential, recordHash, anchored: tx.ok, tx, issuedBy: a.label };
}

async function revokeRecord(ctx, { actor, recordHash, reason = 0 }) {
  const a = ctx.actors[actor];
  if (!a) throw new Error(`Unknown actor: ${actor}`);
  const tx = await exec(ctx, actor, 'revokeRecord', [recordHash, reason]);
  return { revoked: tx.ok, tx, by: a.label };
}

const verify = (ctx, credential, opts) => verifyCredential(ctx.reader, credential, opts);

/** Chronological audit trail rebuilt purely from on-chain events. */
async function auditLog(ctx) {
  const logs = await ctx.provider.getLogs({ address: ctx.address, fromBlock: 0, toBlock: 'latest' });
  const nameOf = (addr) => Object.values(ctx.actors).find((x) => x.address.toLowerCase() === addr.toLowerCase())?.label;
  const blockTimes = new Map();
  const out = [];
  for (const log of logs) {
    const p = ctx.iface.parseLog(log);
    if (!p) continue;
    if (!blockTimes.has(log.blockNumber)) blockTimes.set(log.blockNumber, (await ctx.provider.getBlock(log.blockNumber)).timestamp);
    const e = { event: p.name, block: log.blockNumber, time: blockTimes.get(log.blockNumber), txHash: log.transactionHash };
    const a = p.args;
    switch (p.name) {
      case 'InstitutionRegistered': e.summary = `Institution registered: ${a.name}`; e.subject = ethers.decodeBytes32String(a.institutionId); break;
      case 'IssuerAuthorized': e.summary = `Issuer key authorized for ${ethers.decodeBytes32String(a.institutionId)}`; e.subject = nameOf(a.issuer) || a.issuer; break;
      case 'IssuerRemoved': e.summary = `Issuer key removed from ${ethers.decodeBytes32String(a.institutionId)}`; e.subject = nameOf(a.issuer) || a.issuer; break;
      case 'InstitutionStatusChanged': e.summary = `${ethers.decodeBytes32String(a.institutionId)} ${a.active ? 'reinstated' : 'suspended'}`; e.subject = ethers.decodeBytes32String(a.institutionId); break;
      case 'RecordIssued': e.summary = `Record issued by ${ethers.decodeBytes32String(a.institutionId)}`; e.subject = a.recordHash; break;
      case 'RecordRevoked': e.summary = `Record revoked by ${ethers.decodeBytes32String(a.institutionId)} (${REASONS[Number(a.reason)] || 'Unspecified'})`; e.subject = a.recordHash; break;
      default: continue;
    }
    out.push(e);
  }
  return out;
}

async function networkSnapshot(ctx) {
  const institutions = [];
  const n = Number(await ctx.reader.institutionCount());
  for (let i = 0; i < n; i++) {
    const id = await ctx.reader.institutionIdAt(i);
    const inst = await ctx.reader.getInstitution(id);
    const key = ethers.decodeBytes32String(id);
    const issuers = [];
    for (const [actorKey, a] of Object.entries(ctx.actors)) {
      const bound = await ctx.reader.issuerInstitution(a.address);
      if (bound === id) issuers.push({ key: actorKey, label: a.label, address: a.address });
    }
    institutions.push({ id: key, name: inst.name, active: inst.active, admin: inst.admin, issuers });
  }
  return {
    contract: ctx.address,
    block: await ctx.provider.getBlockNumber(),
    records: Number(await ctx.reader.recordCount()),
    revocations: Number(await ctx.reader.revocationCount()),
    institutions,
    actors: Object.entries(ctx.actors).map(([key, a]) => ({ key, label: a.label, address: a.address })),
  };
}

module.exports = { exec, issueRecord, revokeRecord, verify, auditLog, networkSnapshot, revertName };

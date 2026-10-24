'use strict';
// Verifiable-credential helpers: build, canonicalize, hash, sign, recover.
// Cryptography comes from ethers.js (secp256k1 ECDSA + keccak256); nothing is hand-rolled.
const crypto = require('crypto');
const { ethers } = require('ethers');

/** Deterministic JSON (sorted keys, no whitespace) so every party hashes identical bytes. */
function canonicalize(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

const stripProof = (cred) => {
  const { proof, ...rest } = cred; // eslint-disable-line no-unused-vars
  return rest;
};

/** keccak256 over the canonical form of the credential without its proof. */
const hashCredential = (cred) => ethers.keccak256(ethers.toUtf8Bytes(canonicalize(stripProof(cred))));

const didFromAddress = (address) => `did:ethr:${ethers.getAddress(address)}`;

function addressFromDid(did) {
  const m = /^did:ethr:(?:[a-z0-9]+:)?(0x[0-9a-fA-F]{40})$/.exec(String(did || ''));
  if (!m) throw new Error('Issuer is not a valid did:ethr identifier');
  return ethers.getAddress(m[1]);
}

/** W3C Verifiable Credential data model (v1) shaped record. */
function buildCredential({ issuerAddress, subject, type = 'AcademicCertificate', validDays = null, now = new Date() }) {
  const cred = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', type],
    issuer: didFromAddress(issuerAddress),
    issuanceDate: now.toISOString(),
    credentialSubject: { id: `did:example:${crypto.randomBytes(6).toString('hex')}`, ...subject },
    // Random salt: stops anyone brute-forcing the on-chain hash from guessable fields.
    credentialSalt: ethers.hexlify(ethers.randomBytes(16)),
  };
  if (validDays) cred.expirationDate = new Date(now.getTime() + validDays * 86400000).toISOString();
  return cred;
}

/** Sign the credential hash with the issuer key (EIP-191 personal_sign). */
async function signCredential(cred, signer) {
  const unsigned = stripProof(cred);
  const hash = hashCredential(unsigned);
  const proofValue = await signer.signMessage(ethers.getBytes(hash));
  const issuer = await signer.getAddress();
  return {
    ...unsigned,
    proof: {
      type: 'EcdsaSecp256k1RecoverySignature2020',
      created: new Date().toISOString(),
      verificationMethod: `${didFromAddress(issuer)}#controller`,
      proofPurpose: 'assertionMethod',
      proofValue,
    },
  };
}

/** Recover the signing address from a credential's proof. Throws on a malformed signature. */
const recoverSigner = (cred) =>
  ethers.verifyMessage(ethers.getBytes(hashCredential(cred)), cred.proof.proofValue);

module.exports = { canonicalize, hashCredential, buildCredential, signCredential, recoverSigner, didFromAddress, addressFromDid, stripProof };

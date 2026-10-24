# Pitch plan and Q&A preparation

Format: **7 minutes presenting, 3 minutes Q&A.** Rehearse with a timer. The live demo is the strongest part: give it the most time.

## 7-minute plan

| Time | What you say and show |
|---|---|
| 0:00 to 0:45 | **The problem.** A student applies abroad. The receiving university cannot easily tell whether the certificate is real, altered or revoked. Today that means emailing the issuer or paying a central verification service. Records can be forged, and nobody wants to share a whole database. |
| 0:45 to 1:30 | **The idea.** Issuer signs. Only a salted fingerprint goes on-chain. Verifier checks the registry, not the issuer. Show the architecture diagram from the README. |
| 1:30 to 5:30 | **Live demo** (below). |
| 5:30 to 6:15 | **Why it is trustworthy:** 20 automated tests, 8 scenarios, contract-enforced roles, privacy test proving no personal data on-chain. Show `npm test` output or the Scenarios tab "8 of 8". |
| 6:15 to 7:00 | **Limits and next steps:** multisig governance, holder binding, selective disclosure, offline verification. Honest limits score well. |

## Live demo script (4 minutes)

Have the app already running and the Verify tab open. Keep a terminal with `npm test` ready as a backup.

1. **Valid.** Click *Load valid sample*, *Verify record*. Point at the chain: seven linked checks, all green. Say: "No call to the university was made. Only the registry was read."
2. **Altered.** Click *Load altered sample*, *Verify*. Say: "Someone changed the CGPA from 8.4 to 9.9 after it was signed." The chain **breaks** at the signature check and the later steps show "Not reached".
3. **Unauthorized issuer.** Go to Issue, choose *Unregistered degree mill*, submit. Show the contract rejecting it (`NotAuthorizedIssuer`). Click *Send to Verify*: "Even the forged record it signed itself is caught, at the issuer-authorization step."
4. **Revocation.** Go to Records, pick a real record, *Revoke…* as **KSU Registrar Office** (a different institution). Show it refused (`NotRecordAuthority`). Change to the issuing office, confirm, then *Verify*: Revoked, with reason and time.
5. **Audit.** Network and audit tab: every issuance and revocation is rebuilt from chain events.
6. **Close with Scenarios:** *Run all scenarios*, 8 of 8.

If something goes wrong on stage: restart with `npm start` (takes about 3 seconds) or fall back to `npm run demo`.

## Likely judge questions and answers

**Why a blockchain? Could a database do this?**
A database controlled by one party makes that party the trusted authority, which is exactly what the problem rules out. The registry is shared: no single institution can rewrite who is authorized, silently un-revoke a record or backdate an issuance, and anyone can audit the history independently.

**What stops a university from lying?**
Nothing can force an institution to issue honest records, and no technology can. What the system guarantees is *attribution and integrity*: a record can only come from a key the registry says belongs to that institution, it cannot be edited unnoticed, and the institution cannot deny having issued it.

**Who decides which institutions are trusted?**
The registrar role admits institutions. In the MVP it is one key for simplicity. In production it would be a multisig or a consortium governance contract. Each institution then manages its own issuer keys, so the registrar cannot issue on an institution's behalf.

**Where is the private data? Is a hash safe?**
Names and grades never touch the chain. Each record contains a random 16-byte salt, so the fingerprint cannot be brute-forced from guessable fields. A test checks that personal strings do not appear in chain logs.

**What if an issuer's key is stolen?**
The institution's admin removes the key, which blocks new issuance immediately. Records already issued stay valid, because the anchor proves the key was authorized then. Any fraudulent records issued in the window can be revoked by the admin.

**What about revocation when the verifier is offline?**
The MVP checks live. For offline use, verifiers can cache a recent registry state or accept signed status snapshots with an expiry time. That is a trade-off between freshness and availability, and we have noted it as future work.

**Why not store the whole certificate on IPFS or on-chain?**
That would expose personal data publicly and permanently. Our approach keeps data with the holder and puts only a verifiable fingerprint on-chain.

**Did you write the cryptography yourselves?**
No. Signing and recovery use ethers.js (secp256k1 ECDSA, keccak256), which the problem statement requires. Records follow the W3C Verifiable Credentials data model.

**How does it scale? What does it cost?**
Anchoring costs about 98k gas for one record and about 52k per record when batched (measured). On an L2 or a permissioned chain that is a fraction of a cent or free. Verification is a free read call.

**Can a verifier trust a record someone just pastes in?**
Yes, that is the point: trust comes from the signature and the registry, not from the channel the record arrived through. The one gap is holder binding (proving the presenter is the person named), which we list as the next step.

**Difference between "Altered", "Unauthorized issuer" and "Not registered"?**
Altered: the contents or signature do not match. Unauthorized issuer: the signature is genuine but the signer is not in the registry. Not registered: an authorized key signed it but never anchored it, so the issuance never officially happened.

**Is the contract secure?**
Custom errors and strict role checks on every state-changing function, no external calls, no ether handling, so reentrancy and fund-theft classes do not apply. Tests cover every rejection path. It has not had an independent audit, which a production deployment would need.

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

Have the app already running at http://localhost:3000. Keep a terminal with `npm test` ready as a backup.

### Option A: Using "Play demo" (Automated / Narrated Mode)
1. Click the **Play demo** button in the header. The floating walkthrough controller guides you through all 5 demonstrations with real transactions on the live EVM contract.
2. Advance with **Next** (or press the **Right Arrow** key / enable **Auto-play**):
   - **Step 1 (Valid):** Shows Sahyadri Institute's certificate with 7 green links in the chain of trust and the `[ VALID ]` stamp.
   - **Step 2 (Altered):** Edits CGPA from 8.4 to 9.9. The chain visibly **breaks** at check 2 (signature/integrity) with later steps "Not reached".
   - **Step 3 (Unauthorized issuer):** Unregistered degree mill attempts issuance; contract reverts `NotAuthorizedIssuer`, and its self-signed record fails check 3.
   - **Step 4 (Unauthorized revocation):** Konkan State University tries to revoke an SIT certificate; contract reverts `NotRecordAuthority`.
   - **Step 5 (Revoked record):** Authorized SIT key revokes the certificate; live status changes, and Verify displays `[ REVOKED ]` with reason and on-chain timestamp.

### Option B: The "Judge Phone Scan" Live Moment
1. Go to **Issue**, issue a certificate for a student (e.g., Asha Patil).
2. Point at the **Blockchain Ribbon**: a new block slides in with the transaction hash and gas used (~98k gas). Click the block to show the mined block details.
3. Show the **QR code** generated on the certificate.
4. **Invite a judge to scan the QR code with their phone** on the local Wi-Fi.
5. The judge's phone opens `/v/:recordHash` and renders the mobile-friendly verification page with the 7-step chain of trust running live!
6. Open a second browser window with **Records**. Click *Revoke…* as SIT on that certificate.
7. Show that the judge's phone and the first window **instantly flip to "Revoked" without refreshing**, powered by Server-Sent Events (`/api/events`).

### Backup / CLI Demo
If something goes wrong on stage: restart with `npm start` (takes ~2 seconds) or fall back to `npm run demo` in the terminal.

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

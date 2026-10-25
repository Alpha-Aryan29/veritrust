# VeriTrust

**A decentralized trust registry for institutional records.** Universities, departments and other organizations issue digitally signed records, and any other institution can verify them, detect tampering and check revocation, without a central verification authority and without anyone sharing their database.

Built for INNOVISE 2026, Blockchain domain, Problem Statement 2: *Decentralized Institutional Data and Trust Infrastructure*.

## The idea in one paragraph

A university signs a certificate with its own key. Only the **fingerprint** (a salted hash) of that certificate is written to a shared smart contract, together with the issuing institution and a timestamp. The certificate itself, with the student's name and grades, stays off-chain with the holder. A verifier who receives the certificate recomputes the fingerprint, recovers the signer from the signature, and asks the registry three read-only questions: *Is this signer an authorized issuer? Was this exact record registered by it? Has it been revoked?* No call to the issuing university is needed.

## Run it

Requires Node.js 18 or newer. No Docker, no wallet, no internet connection after install.

```bash
npm install
npm start          # dashboard at http://localhost:3000
npm test           # 20 automated tests
npm run demo       # the scenarios in the terminal, 8 of 8 should pass
```

`npm start` compiles the Solidity contract, starts an in-memory Ethereum chain, deploys the registry and seeds two institutions, so the demo is identical on every run.

## What the MVP demonstrates

| Required demonstration | How to see it | Result |
|---|---|---|
| Valid record verifies | Verify tab, "Load valid sample" | Valid, all 7 checks pass |
| Modified record detected | "Load altered sample" (CGPA edited after signing) | Altered, chain breaks at the signature check |
| Unauthorized issuer rejected | "Load forged sample", or Issue as "Unregistered degree mill" | Contract reverts `NotAuthorizedIssuer`; the forged record fails verification |
| Revoked record detected | Records tab, revoke, then Verify | Revoked, with reason and time |
| Unauthorized revocation rejected | Records tab, revoke "as" another institution | Contract reverts `NotRecordAuthority` |

The **Scenarios** tab runs all of these (plus duplicate issuance, expiry, issuer key removal and institution suspension) against the live contract in one click.

## Requirement map

| MVP requirement | Where |
|---|---|
| 1. Institution identity and authorization | `registerInstitution`, `addIssuer`, `removeIssuer`, `setInstitutionActive` in `contracts/TrustRegistry.sol` |
| 2. Cryptographically signed records | `src/credential.js`: W3C Verifiable Credential shaped records signed with secp256k1 ECDSA via ethers.js. No hand-written cryptography |
| 3. Cross-institution verification | `src/verifier.js`: 7 ordered checks using read-only registry calls; never contacts the issuer |
| 4. Revocation and validity checking | `revokeRecord` in the contract; the verifier reads the current revocation state on every check |
| 5. Blockchain trust registry | `contracts/TrustRegistry.sol`: authorized identities, issuance anchors, revocation events; unauthorized issue/revoke revert |
| 6. Verification interface | `public/`: Verify, Issue, Records, Network and audit, Scenarios |

## Architecture

```
 Issuer (institution backend)                 Shared registry (smart contract)               Verifier (any institution)
 ────────────────────────────                 ────────────────────────────────               ──────────────────────────
 build W3C credential + random salt           institutions + admins                          receives credential JSON
 hash = keccak256(canonical JSON)             authorized issuer keys                         recompute hash (detects edits)
 sign hash with issuer key  ───────────────►  issueRecord(hash)  ◄── only authorized keys    recover signer from signature
 send credential to the holder                revokeRecord(hash) ◄── only same institution   read registry: issuer? anchored? revoked?
                                              events = public audit trail  ──────────────►   verdict + chain of checks
```

**What is on-chain:** institution identities, issuer public addresses, record fingerprints, timestamps, revocation events.
**What is never on-chain:** names, grades, programmes, any record content. A random 16-byte salt inside every record stops anyone brute-forcing the fingerprint from guessable fields (an automated test checks that personal data never appears in chain logs).

### Verification checks, in order

1. Record is well formed
2. Signature matches the record contents (any edit changes the hash, so the recovered signer no longer matches)
3. Signer is an authorized issuer
4. Record is anchored on-chain by that issuer
5. Issuing institution is in good standing
6. Record has not been revoked
7. Record is within its validity period

Each failure maps to a distinct verdict: Altered, Unauthorized issuer, Not registered, Issuer mismatch, Institution suspended, Revoked, Expired, Malformed.

### Design decisions worth defending

- **Hash on-chain, record off-chain.** Satisfies the privacy requirement and keeps gas low (about 98k gas per record, about 52k per record when batched in groups of 25).
- **Records issued before a key is removed stay valid.** The on-chain anchor proves the key was authorized at issuance time. Removing a key only blocks new issuance.
- **Revocation authority is scoped to the issuing institution.** Another institution, the registrar and outsiders all fail (tested).
- **Governance is separated.** The registrar admits institutions; each institution's admin manages its own issuer keys; issuers issue. No role can do another's job.
- **Standards-aligned.** Records follow the W3C Verifiable Credentials data model; identifiers use the `did:ethr` format.

## Project layout

```
contracts/TrustRegistry.sol   smart contract
src/chain.js                  compile, start local chain, deploy, seed demo network
src/credential.js             build, canonicalize, hash, sign, recover
src/verifier.js               the 7-step verification
src/service.js                issue, revoke, audit log (what an institution backend does)
src/events.js                 Server-Sent Events hub, block tracker, and telemetry
src/verifyPage.js             standalone mobile-friendly public verification page (/v/:id)
src/scenarios.js              scripted demonstrations
src/server.js                 REST API + static dashboard + rate limiting
public/                       dashboard (vanilla JS, no build step, accessible & responsive)
test/registry.test.js         20 base unit tests
test/tier1.test.js            automated tests for SSE, blocks, QR, /v/:id & rate limits
scripts/demo.js               terminal demo
docs/PITCH_AND_QA.md          7-minute pitch plan, judge Q&A, and demo scripts
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | contract address, block height, counts, institutions |
| GET | `/api/events` | Server-Sent Events (SSE) live stream for multi-window updates |
| GET | `/api/blocks` | latest mined blocks with tx hashes and gas usage |
| POST | `/api/issue` | sign and anchor a record as a chosen issuer |
| POST | `/api/verify` | verify a credential, returns verdict and the 7 checks |
| POST | `/api/revoke` | attempt a revocation as a chosen account |
| GET | `/api/records` | records issued this session with live status |
| GET | `/api/records/:hash` | single record details + live verification result |
| GET | `/api/qr?text=...` | generates offline QR code data URL (PNG) |
| GET | `/v/:recordHash` | public mobile-friendly verification page for phone scanners |
| GET | `/api/audit` | audit trail rebuilt from chain events |
| POST | `/api/scenarios/run` | run all scenarios against the live contract |

## Live Demo Highlights

- **Guided Demo Mode ("Play demo" button)**: Top-right button launches an interactive walkthrough of all 5 core demonstrations (Valid, Altered, Unauthorized issuer, Unauthorized revocation, Revoked). Has Next/Back, auto-play, and keyboard arrow controls.
- **Blockchain Ribbon**: An always-visible strip under the header showing mined blocks as they occur. Clicking any chip opens complete transaction and gas details.
- **Real-Time Multi-Window Sync**: Open two windows (e.g. issuer in one, verifier in another). Revoking a record in one flips the other's status badge and active verification result to "Revoked" instantly.
- **QR Code & Phone Verification**: Every certificate includes a generated QR code. Anyone on the same Wi-Fi can scan the QR code with their phone camera to open `/v/:recordHash` and inspect the live 7-step chain of trust in real time.
- **Drag-and-Drop Verification**: Drag any `.json` credential into the Verify tab to inspect and verify immediately with friendly validation checks.

## Honest limitations and next steps

- **Demo chain is in-memory** (Ganache). The contract is standard Solidity and deploys unchanged to any EVM chain; a real consortium would use a permissioned network such as Hyperledger Besu, or a low-fee L2.
- **The registrar is a single key.** Production should use a multisig or consortium governance contract.
- **The demo server holds the issuer keys** so one dashboard can play every role. In production each institution signs locally, ideally with an HSM.
- **Canonicalization is a simple sorted-key JSON.** Production should use RFC 8785 (JCS) or RDF canonicalization.
- **No holder binding yet:** whoever holds the JSON can present it. Next step: holder DID plus challenge-response.
- **No selective disclosure yet** (share the degree but not the CGPA). Next step: SD-JWT or BBS+ signatures.
- **Revocation check needs chain read access.** Verifiers can cache or use signed status snapshots for offline use.

## License

MIT. All names, institutions and data in this repository are synthetic.

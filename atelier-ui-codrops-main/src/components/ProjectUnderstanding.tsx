'use client';

import React from 'react';

export default function ProjectUnderstanding({ onExploreAction }: { onExploreAction?: (tab: string) => void }) {
  return (
    <section className="py-20 relative border-t border-white/10 bg-gradient-to-b from-transparent via-[#0b101c]/60 to-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header Badge */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold block mb-3">
            Core Architecture & Security Model
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Decentralized Trust Infrastructure
          </h2>
          <p className="text-gray-300 text-sm sm:text-lg mt-4 leading-relaxed">
            Eliminating centralized verification bottlenecks, forged credentials, and database exposure across universities and government institutions using immutable smart contracts.
          </p>
        </div>

        {/* Centralized Dilemma vs VeriTrust Solution Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Left: The Centralized Bottleneck */}
          <div className="glass-panel p-8 rounded-3xl border border-rose-500/20 bg-rose-950/10 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xl">
                ✕
              </span>
              <div>
                <h3 className="text-xl font-bold text-white">The Centralized Dilemma (Legacy Web2)</h3>
                <span className="text-xs font-mono text-rose-400">CURRENT BROKEN STATE</span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-300">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-rose-300 block mb-1">1. Central Database Honeypots</strong>
                <p className="text-xs text-gray-400">
                  Institutions must surrender complete internal student databases to central portals, creating massive single-point-of-failure breach risks and data privacy violations.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-rose-300 block mb-1">2. Rampant Certificate Forgery</strong>
                <p className="text-xs text-gray-400">
                  Static PDF transcripts and paper degrees are easily forged with graphic software. Verifiers have no instant mathematical way to confirm authentic signatures.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-rose-300 block mb-1">3. Inter-Institutional Delay</strong>
                <p className="text-xs text-gray-400">
                  Verifying an applicant&apos;s degree across state or national borders takes weeks of manual phone calls, notarized copies, and high administrative fees.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-rose-300 block mb-1">4. Unchecked Revocations</strong>
                <p className="text-xs text-gray-400">
                  If an institution rescinds a degree for fraud or plagiarism, third-party verifiers are never notified in real-time, allowing fraudulent claims to persist.
                </p>
              </div>
            </div>
          </div>

          {/* Right: The VeriTrust Decentralized Architecture */}
          <div className="glass-panel-glow p-8 rounded-3xl border border-emerald-500/30 bg-emerald-950/10 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl">
                ✓
              </span>
              <div>
                <h3 className="text-xl font-bold text-white">The VeriTrust Infrastructure (Web3 Trust)</h3>
                <span className="text-xs font-mono text-emerald-400">PS 2 PRODUCTION SOLUTION</span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-300">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-emerald-300 block mb-1">1. Zero Database Sharing & Privacy</strong>
                <p className="text-xs text-gray-400">
                  Student PII stays off-chain with the student as a salted W3C Verifiable Credential. The blockchain only stores a 32-byte salted hash, preserving confidentiality.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-emerald-300 block mb-1">2. Cryptographic Avalanche Detection</strong>
                <p className="text-xs text-gray-400">
                  A 1-bit change to any grade or name triggers a 50%+ hash bit explosion (avalanche effect). Verification immediately flags tampering in &lt; 50ms.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-emerald-300 block mb-1">3. Trustless Cross-Border Verification</strong>
                <p className="text-xs text-gray-400">
                  Any employer or university globally verifies authenticity using public smart contract state. No API keys, no passwords, and zero university contact required.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <strong className="text-emerald-300 block mb-1">4. Real-Time On-Chain Revocations</strong>
                <p className="text-xs text-gray-400">
                  Institutions revoke compromised records directly via smart contract with immutable reason codes. Global verification status updates in the exact same mined block.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Step End-to-End Workflow Diagram */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              End-to-End Cryptographic Lifecycle
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              How a digital certificate travels from issuance to trustless verification:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 relative">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
                01
              </div>
              <h4 className="text-base font-bold text-white mb-2">1. Credential Minting</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                University registrar signs student data using their authorized ECDSA private key. A 128-bit random salt is injected to prevent dictionary attacks.
              </p>
              <div className="text-[10px] font-mono text-emerald-400 bg-black/30 p-2 rounded border border-white/5">
                Output: signed credential.json + 128-bit salt
              </div>
            </div>

            {/* Step 2 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 relative">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
                02
              </div>
              <h4 className="text-base font-bold text-white mb-2">2. On-Chain Anchoring</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                The smart contract commits the salted hash to <code className="text-white">TrustRegistry.sol</code> with the block timestamp. Single or Batch transaction.
              </p>
              <div className="text-[10px] font-mono text-cyan-400 bg-black/30 p-2 rounded border border-white/5">
                anchorRecord(hash, validDays) • EVM Gas
              </div>
            </div>

            {/* Step 3 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 relative">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
                03
              </div>
              <h4 className="text-base font-bold text-white mb-2">3. Student Custody</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                The student receives the self-sovereign credential file and a dynamic QR code. They can share it with employers without asking the university.
              </p>
              <div className="text-[10px] font-mono text-purple-400 bg-black/30 p-2 rounded border border-white/5">
                W3C standard • Mobile QR verification link
              </div>
            </div>

            {/* Step 4 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 relative">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
                04
              </div>
              <h4 className="text-base font-bold text-white mb-2">4. 7-Step Verification</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                The employer uploads the file. In 50ms, VeriTrust recovers the signer key, matches the on-chain hash, checks revocation, and yields the final verdict.
              </p>
              <div className="text-[10px] font-mono text-amber-400 bg-black/30 p-2 rounded border border-white/5">
                Verdict: VALID • Mathematical Proof
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Deep-Dive Action Row */}
        <div className="glass-panel-glow p-8 rounded-3xl border border-white/10 text-center max-w-4xl mx-auto bg-gradient-to-r from-emerald-950/40 via-black to-cyan-950/40">
          <h3 className="text-2xl font-black text-white mb-2">
            Ready to Inspect the Trust Infrastructure?
          </h3>
          <p className="text-sm text-gray-300 max-w-xl mx-auto mb-6">
            Switch directly to our live interactive modules to issue credentials, test the cryptographic avalanche tamper lab, or run the official hackathon test scenarios.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onExploreAction?.('verify')}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition shadow-lg shadow-emerald-500/20"
            >
              Verify Credentials
            </button>
            <button
              onClick={() => onExploreAction?.('tamper')}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition border border-white/10"
            >
              Tamper Detection Lab
            </button>
            <button
              onClick={() => onExploreAction?.('scenarios')}
              className="px-6 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold text-sm transition border border-cyan-500/40"
            >
              System Test Scenarios
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

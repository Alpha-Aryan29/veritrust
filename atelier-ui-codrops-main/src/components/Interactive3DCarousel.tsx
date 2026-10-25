"use client";

import React, { useEffect, useState } from "react";

interface Pillar {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  tag: string;
  description: string;
  points: string[];
  techSpec: string;
  color: string;
}

export const PILLARS: Pillar[] = [
  {
    id: "p1",
    number: "01",
    title: "Zero-Knowledge Data Privacy",
    subtitle: "Off-Chain Credentials & Cryptographic Salt",
    tag: "PRIVACY BY DESIGN",
    description:
      "Personal Identifiable Information (PII) such as student name, grades, and birth dates NEVER touch the public blockchain. Only a one-way salted cryptographic fingerprint is anchored.",
    points: [
      "W3C-compliant Verifiable Credential standard",
      "128-bit random cryptographic salt per credential",
      "Defeats brute-force and rainbow table dictionary attacks",
      "Full compliance with global student privacy regulations",
    ],
    techSpec: "ECDSA secp256k1 + Keccak-256 (32 bytes hash)",
    color: "#00d296",
  },
  {
    id: "p2",
    number: "02",
    title: "Smart Contract Trust Registry",
    subtitle: "Decentralized Multi-Institutional Governance",
    tag: "EVM SMART CONTRACT",
    description:
      "TrustRegistry.sol replaces single central verification authorities with an immutable smart contract deployed on an EVM-compatible consortium blockchain.",
    points: [
      "Institutions register verified issuer public keys",
      "Consortium governance: only authorized admins manage keys",
      "No single point of failure or single vendor lock-in",
      "Immutable block height timestamps and transaction proofs",
    ],
    techSpec: "Solidity 0.8.26 • Gas-optimized storage mappings",
    color: "#00c3ff",
  },
  {
    id: "p3",
    number: "03",
    title: "7-Step Instant Verification",
    subtitle: "Cross-Institutional Proof in < 50ms",
    tag: "TRUSTLESS VERIFICATION",
    description:
      "Any external university, employer, or government verifier can validate a credential offline in milliseconds using only read access to the blockchain.",
    points: [
      "1. Schema format & digital signature recovery",
      "2. Fingerprint lookup against smart contract",
      "3. Verified issuing university accreditation check",
      "4. Active signing key status validation",
      "5. Instant revocation state check",
      "6. Expiration & temporal validity check",
      "7. Salt & payload tamper integrity check",
    ],
    techSpec: "Offline mathematical proof without issuer phone calls",
    color: "#8b5cf6",
  },
  {
    id: "p4",
    number: "04",
    title: "Avalanche Tamper Detection",
    subtitle: "Mathematical Impossibility of Forgery",
    tag: "CRYPTOGRAPHIC GUARANTEE",
    description:
      'Modifying a single letter (e.g. "Alice" -> "Alicia") or GPA decimal causes a catastrophic avalanche effect, flipping over 50% of the hash bits.',
    points: [
      "Strict Avalanche Criterion (SAC) verified",
      "Hamming distance visualization in real-time",
      "Altered payloads fail both ECDSA and on-chain hash checks",
      "Immediate visual tampering diagnostics for employers",
    ],
    techSpec: "Flipped bits: ~128 / 256 bits (50.0% variance)",
    color: "#f59e0b",
  },
  {
    id: "p5",
    number: "05",
    title: "Batch Anchoring Optimization",
    subtitle: "Lower Gas Cost for Convocation Cohorts",
    tag: "SCALABILITY & THROUGHPUT",
    description:
      "Universities graduate thousands of students simultaneously. Batch anchoring commits up to 50 records in a single on-chain transaction.",
    points: [
      "Single transaction commits array of cryptographic fingerprints",
      "Amortized transaction base gas across all records",
      "Measured gas savings over individual issuances",
      "Real-time gas telemetry benchmark in the dashboard",
    ],
    techSpec: "Current benchmark: ~52,100 gas vs ~98,200 gas single",
    color: "#10b981",
  },
  {
    id: "p6",
    number: "06",
    title: "Decentralized Revocation",
    subtitle: "Immutable Non-Custodial Revocation Ledger",
    tag: "FRAUD & ERROR CONTROL",
    description:
      "When credentials must be revoked for academic misconduct or administrative corrections, issuers revoke them on-chain with immutable reason codes.",
    points: [
      "Strict access control: only the issuing institution can revoke",
      "Preserves audit history: past issuance remains logged",
      "Standardized reason codes (Misconduct, Error, Fraud)",
      "Instant global synchronization across all verifiers",
    ],
    techSpec: "EVM event emit: RecordRevoked(hash, actor, reason, timestamp)",
    color: "#f43f5e",
  },
];

export default function Interactive3DCarousel({
  onPillarClick,
}: {
  onPillarClick?: (p: Pillar) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const total = PILLARS.length;

  const nextPillar = () => setCurrentIndex((prev) => (prev + 1) % total);
  const prevPillar = () =>
    setCurrentIndex((prev) => (prev - 1 + total) % total);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      nextPillar();
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, total]);

  const activePillar = PILLARS[currentIndex];

  return (
    <div
      className="py-20 relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-10 text-center">
        <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold block mb-2">
          Protocol Architecture & Security Guarantees
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          How VeriTrust Guarantees Institutional Trust
        </h2>
        <p className="text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto mt-3">
          Explore the core design principles: zero database exposure,
          mathematical tamper resistance, instant verification, and
          decentralized revocations.
        </p>
      </div>

      {/* Carousel Card Stage */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Navigation Indicator Bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {PILLARS.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx
                    ? "w-8 bg-emerald-400"
                    : "w-2 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Go to principle ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={prevPillar}
              className="p-2 rounded-xl bg-[#0c101a] border border-white/10 hover:border-white/30 text-white transition hover:scale-105 active:scale-95"
              aria-label="Previous Principle"
            >
              &larr;
            </button>
            <button
              onClick={nextPillar}
              className="p-2 rounded-xl bg-[#0c101a] border border-white/10 hover:border-white/30 text-white transition hover:scale-105 active:scale-95"
              aria-label="Next Principle"
            >
              &rarr;
            </button>
          </div>
        </div>

        {/* Active Principle Card */}
        <div className="relative rounded-3xl p-6 sm:p-10 border border-white/10 overflow-hidden transition-all duration-500 bg-[#0c101a]/90 backdrop-blur-2xl shadow-2xl">
          {/* Subtle Ambient Glow */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-700"
            style={{ backgroundColor: activePillar.color }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Info Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl sm:text-4xl font-black opacity-30 text-white">
                  {activePillar.number}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border"
                  style={{
                    borderColor: `${activePillar.color}50`,
                    color: activePillar.color,
                    backgroundColor: `${activePillar.color}15`,
                  }}
                >
                  {activePillar.tag}
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {activePillar.title}
                </h3>
                <p className="text-sm text-neutral-400 font-mono mt-1">
                  {activePillar.subtitle}
                </p>
              </div>

              <p className="text-sm text-neutral-300 leading-relaxed">
                {activePillar.description}
              </p>

              <ul className="space-y-2 pt-2">
                {activePillar.points.map((pt, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-xs text-neutral-300"
                  >
                    <span className="text-emerald-400 font-bold mt-0.5">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Spec Card */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pb-3 border-b border-white/10">
                <span>PROTOCOL SPEC</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-mono text-neutral-500 uppercase">
                  Cryptographic Engine
                </span>
                <p className="text-xs font-mono text-neutral-200 bg-white/5 p-2.5 rounded-lg border border-white/5">
                  {activePillar.techSpec}
                </p>
              </div>

              <button
                onClick={() => onPillarClick?.(activePillar)}
                className="w-full mt-4 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Inspect in Verification Engine</span>
                <span className="group-hover:translate-x-1 transition-transform">
                  &rarr;
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

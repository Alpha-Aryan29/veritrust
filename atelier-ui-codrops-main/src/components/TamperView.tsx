"use client";

import React, { useEffect, useState } from "react";
import { api, type TamperResponse, type VeriTrustCredential } from "@/lib/api";

const DEFAULT_SAMPLE: VeriTrustCredential = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  id: "urn:uuid:vjti-2026-ce-942",
  type: ["VerifiableCredential", "AcademicCertificate"],
  issuer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  issuanceDate: "2026-06-15T10:00:00Z",
  credentialSubject: {
    name: "Asha Patil",
    program: "B.Tech in Computer Engineering",
    graduationYear: 2026,
    cgpa: 9.42,
  },
  salt: "0xa4f89d31c4e92a83f104d5b6e7a89201",
  proof: {
    type: "EcdsaSecp256k1Signature2019",
    created: "2026-06-15T10:05:00Z",
    proofPurpose: "assertionMethod",
    verificationMethod: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    signatureValue:
      "0x6f918e77a21390d45293bb81d89284ea5723b44b679124a9194bb827365a12ef6c694a539bc7a612501a2d1645bf90f05566378e9192410bc39e0155b51c88a11b",
  },
};

export default function TamperView({
  initialCred,
}: {
  initialCred?: VeriTrustCredential | null;
}) {
  const [cred, setCred] = useState<VeriTrustCredential>(
    initialCred || DEFAULT_SAMPLE,
  );
  const [name, setName] = useState(cred.credentialSubject.name);
  const [cgpa, setCgpa] = useState<number>(Number(cred.credentialSubject.cgpa));
  const [graduationYear, setGraduationYear] = useState<number>(
    Number(cred.credentialSubject.graduationYear),
  );
  const [loading, setLoading] = useState(false);
  const [tamperResult, setTamperResult] = useState<TamperResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialCred?.proof?.proofValue) return;
    let active = true;
    setLoading(true);
    api
      .issue({
        actor: "sitRegistry",
        subject: {
          name: "Asha Patil",
          program: "B.Tech in Computer Engineering",
          graduationYear: 2026,
          cgpa: 9.42,
        },
        validDays: 3650,
      })
      .then((response) => {
        if (!active) return;
        setCred(response.credential);
        setName(response.credential.credentialSubject.name);
        setCgpa(Number(response.credential.credentialSubject.cgpa));
        setGraduationYear(
          Number(response.credential.credentialSubject.graduationYear),
        );
      })
      .catch((error: Error) => {
        if (active)
          setErrorMsg(
            error.message || "Could not prepare a signed sample credential.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialCred]);

  const handleRunTamper = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.tamper({
        credential: cred,
        modifications: {
          name,
          cgpa: Number(cgpa),
          graduationYear: Number(graduationYear),
        },
      });
      setTamperResult(res);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Tamper analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const isModified =
    name !== cred.credentialSubject.name ||
    Number(cgpa) !== Number(cred.credentialSubject.cgpa) ||
    Number(graduationYear) !== Number(cred.credentialSubject.graduationYear);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="pb-6 border-b border-white/10">
        <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold block mb-2">
          Mathematical Tamper Resistance
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Cryptographic Integrity & Avalanche Analysis
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Demonstrates why post-issuance payload mutation is mathematically
          detectable. Even a one-character change produces a radically different
          Keccak-256 digest.
        </p>
      </div>

      {/* Interactive Mutation Form & Hash Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-mono font-bold uppercase text-gray-300">
              Live Field Mutator
            </span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              TAMPER SIMULATOR
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Tweak any field below (e.g. increase CGPA to 9.99 or alter name) to
            observe the instant cryptographic hash explosion:
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                Student Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  CGPA Grade
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cgpa}
                  onChange={(e) => setCgpa(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Graduation Year
                </label>
                <input
                  type="number"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="pt-2 flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => {
                setName(cred.credentialSubject.name);
                setCgpa(9.99);
              }}
              className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 font-mono text-[11px]"
            >
              Set Grade to 9.99
            </button>
            <button
              onClick={() => {
                setName("Alicia Patil");
              }}
              className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 font-mono text-[11px]"
            >
              Modify Name
            </button>
            <button
              onClick={() => {
                setName(cred.credentialSubject.name);
                setCgpa(Number(cred.credentialSubject.cgpa));
                setGraduationYear(
                  Number(cred.credentialSubject.graduationYear),
                );
              }}
              className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-mono text-[11px]"
            >
              Reset to Authentic
            </button>
          </div>

          <button
            onClick={handleRunTamper}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            {loading
              ? "Analyzing Bit Flips..."
              : "Analyze Avalanche Variance & Re-Verify"}
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs"
            >
              {errorMsg}
            </div>
          )}
        </div>

        {/* Right Output: Bit Flipped Gauge & Hash Differences (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {tamperResult ? (
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-500/30 space-y-6 bg-[#0c101d]">
              {/* Avalanche Metric Scorecard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono uppercase text-gray-400 block">
                    Flipped Bits
                  </span>
                  <strong className="text-3xl font-mono font-black text-rose-400">
                    {tamperResult.avalanche.flippedBits}{" "}
                    <span className="text-sm font-normal text-gray-400">
                      / 256
                    </span>
                  </strong>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    Hamming Distance
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono uppercase text-gray-400 block">
                    Avalanche Variance
                  </span>
                  <strong className="text-3xl font-mono font-black text-amber-400">
                    {tamperResult.avalanche.avalanchePercent}%
                  </strong>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    Expected SAC ~50.0%
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                  <span className="text-[10px] font-mono uppercase text-gray-400 block">
                    Verification Verdict
                  </span>
                  <strong
                    className={`text-xl font-mono font-black block mt-1 ${
                      tamperResult.verification.valid
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {tamperResult.verification.verdict}
                  </strong>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    Rejected On-Chain
                  </span>
                </div>
              </div>

              {/* Side-by-Side Cryptographic Hash Visualizer */}
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold uppercase text-gray-300 block">
                  Hex Character Differences (64 Hex Characters)
                </span>

                <div className="p-4 rounded-xl bg-black/70 border border-white/10 space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-400 block uppercase mb-1">
                      Authentic Signed Hash
                    </span>
                    <div className="text-gray-300 break-all select-all">
                      {tamperResult.originalHash}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[10px] text-rose-400 block uppercase mb-1">
                      Altered Payload Hash
                    </span>
                    <div className="flex flex-wrap gap-0.5 break-all">
                      {tamperResult.avalanche.charDiff.map((diff, i) => (
                        <span
                          key={i}
                          className={`px-0.5 rounded ${
                            diff.diff
                              ? "bg-rose-500/30 text-rose-300 font-bold"
                              : "text-gray-400"
                          }`}
                        >
                          {diff.char2}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Security takeaway */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
                <strong>Why this breaks the forgery:</strong> Because of the
                Strict Avalanche Criterion, even a 1-bit mutation in the student
                payload causes half the bits in the cryptographic digest to
                flip. Because the university&apos;s ECDSA signature was bound to
                the original hash, the modified payload will NEVER match the
                signature or the on-chain anchor.
              </div>
            </div>
          ) : (
            <div className="glass-panel p-10 rounded-3xl border border-white/10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto text-2xl">
                🧪
              </div>
              <h3 className="text-xl font-bold text-white">Tamper Lab Ready</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Modify the student name, grade, or graduation year in the left
                panel and click &ldquo;Compute Avalanche Variance&rdquo; to
                visualize the cryptographic defense in action.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

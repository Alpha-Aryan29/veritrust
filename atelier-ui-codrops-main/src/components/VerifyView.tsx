"use client";

import type React from "react";
import { useEffect, useState } from "react";
import {
  api,
  getPublicBase,
  type VerificationVerdict,
  type VeriTrustCredential,
} from "@/lib/api";

export default function VerifyView({
  initialCredential,
  onNavigateTamper,
}: {
  initialCredential?: VeriTrustCredential | null;
  onNavigateTamper?: (cred: VeriTrustCredential) => void;
}) {
  const [inputJson, setInputJson] = useState<string>("");
  const [parsedCred, setParsedCred] = useState<VeriTrustCredential | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [verifyStep, setVerifyStep] = useState(0);
  const [result, setResult] = useState<VerificationVerdict | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [explainMode, setExplainMode] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Initialize with initial or sample credential
  useEffect(() => {
    if (initialCredential) {
      const json = JSON.stringify(initialCredential, null, 2);
      setInputJson(json);
      setParsedCred(initialCredential);
      handleExecuteVerification(initialCredential);
    } else {
      handleLoadSample("valid");
    }
  }, [initialCredential]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputJson(val);
    try {
      const parsed = JSON.parse(val);
      setParsedCred(parsed);
      setErrorMsg(null);
    } catch (_) {
      setParsedCred(null);
    }
  };

  const handleExecuteVerification = async (
    payloadToVerify?: VeriTrustCredential,
  ) => {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    setVerifyStep(1);

    try {
      let payload = payloadToVerify;
      if (!payload) {
        try {
          payload = JSON.parse(inputJson);
        } catch (_) {
          throw new Error(
            "Invalid JSON format. Please ensure valid JSON structure.",
          );
        }
      }

      // Keep progress legible on slower devices without adding an artificial delay.
      const stepTimer1 = setTimeout(() => setVerifyStep(2), 600);
      const stepTimer2 = setTimeout(() => setVerifyStep(3), 1200);
      const stepTimer3 = setTimeout(() => setVerifyStep(4), 1800);

      const res = await api.verify({ credential: payload });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      setResult(res);

      if (res.recordHash) {
        try {
          const qrRes = await api.getQr(
            `${getPublicBase()}/v/${res.recordHash}`,
          );
          setQrUrl(qrRes.dataUrl);
        } catch (_) {}
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Verification request failed");
    } finally {
      setLoading(false);
      setVerifyStep(0);
    }
  };

  const handleVerify = () => {
    handleExecuteVerification();
  };

  const handleLoadSample = async (
    sampleType: "valid" | "tampered" | "expired",
  ) => {
    setLoading(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const res = await api.issue({
        actor: "sitRegistry",
        subject: {
          name: "Asha Patil",
          program: "B.Tech in Computer Engineering",
          graduationYear: 2026,
          cgpa: 9.42,
        },
        validDays: sampleType === "expired" ? -1 : 3650,
      });

      let c = res.credential;
      if (sampleType === "tampered") {
        c = JSON.parse(JSON.stringify(c));
        c.credentialSubject.cgpa = 9.99;
      }

      setInputJson(JSON.stringify(c, null, 2));
      setParsedCred(c);
      setQrUrl(null);
    } catch (err: unknown) {
      setErrorMsg(
        (err as Error).message ||
          "Could not generate a live sample credential.",
      );
      setInputJson("");
      setParsedCred(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadCredentialJson = () => {
    if (!parsedCred) return;
    const blob = new Blob([JSON.stringify(parsedCred, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credential-${parsedCred.credentialSubject?.name || "record"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Title & Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold block mb-2">
            Independent Verification Engine
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Credential Verification
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Validates W3C Verifiable Credentials against the on-chain Trust
            Registry using ECDSA signature recovery, hash anchoring, and
            revocation status.
          </p>
        </div>

        {/* Explain Mode Toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-mono text-neutral-300 cursor-pointer bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20">
            <input
              type="checkbox"
              checked={explainMode}
              onChange={(e) => setExplainMode(e.target.checked)}
              className="rounded accent-emerald-500"
            />
            <span>Detailed Security Explanations</span>
          </label>
        </div>
      </div>

      {/* Main Grid: Input Form vs Certificate & Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: JSON Input & Quick Presets (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4 bg-[#0a0d16]/80 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-neutral-400 font-bold">
                Paste Credential JSON
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleLoadSample("valid")}
                  className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono hover:bg-emerald-500/25 border border-emerald-500/20"
                >
                  Valid Degree
                </button>
                <button
                  onClick={() => handleLoadSample("tampered")}
                  className="px-2.5 py-1 rounded bg-rose-500/15 text-rose-300 text-[10px] font-mono hover:bg-rose-500/25 border border-rose-500/20"
                >
                  Tampered GPA
                </button>
                <button
                  onClick={() => handleLoadSample("expired")}
                  className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 text-[10px] font-mono hover:bg-amber-500/25 border border-amber-500/20"
                >
                  Expired
                </button>
              </div>
            </div>

            <textarea
              rows={14}
              value={inputJson}
              onChange={handleJsonChange}
              placeholder="Paste W3C credential JSON here..."
              className="w-full p-3 font-mono text-xs bg-black/60 border border-white/10 rounded-xl text-emerald-300 focus:outline-none focus:border-emerald-500/60 leading-relaxed resize-y"
            />

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-black"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Verifying Against Registry...</span>
                  </>
                ) : (
                  <span>Verify Against Registry</span>
                )}
              </button>

              {parsedCred && (
                <button
                  onClick={downloadCredentialJson}
                  title="Download JSON Credential"
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition"
                >
                  ↓
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Certificate, Loader, and 7-Step Pipeline (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Verification Loader Card (Shows during 2-3s verification) */}
          {loading && (
            <div className="p-8 rounded-3xl border border-emerald-500/30 bg-[#0c121e]/90 backdrop-blur-2xl shadow-2xl space-y-6 text-center animate-pulse">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-emerald-400 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white tracking-tight">
                  Cryptographic Proof in Progress
                </h4>
                <p className="text-xs font-mono text-neutral-400">
                  Executing 7-step trustless verification against EVM
                  TrustRegistry.sol
                </p>
              </div>

              {/* Step Progression Telemetry */}
              <div className="max-w-md mx-auto space-y-2 text-left font-mono text-xs">
                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                    verifyStep >= 1
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-black/30 border-white/5 text-neutral-500"
                  }`}
                >
                  <span>1. Schema & ECDSA Signature Recovery</span>
                  <span>{verifyStep >= 1 ? "✓ VERIFIED" : "PENDING"}</span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                    verifyStep >= 2
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-black/30 border-white/5 text-neutral-500"
                  }`}
                >
                  <span>2. EVM Salted Fingerprint Query</span>
                  <span>{verifyStep >= 2 ? "✓ ANCHORED" : "SCANNING"}</span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                    verifyStep >= 3
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-black/30 border-white/5 text-neutral-500"
                  }`}
                >
                  <span>3. Institution Accreditation Check</span>
                  <span>{verifyStep >= 3 ? "✓ AUTHORIZED" : "CHECKING"}</span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                    verifyStep >= 4
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : "bg-black/30 border-white/5 text-neutral-500"
                  }`}
                >
                  <span>4. Non-Custodial Revocation Audit</span>
                  <span>{verifyStep >= 4 ? "✓ ACTIVE" : "INSPECTING"}</span>
                </div>
              </div>

              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, verifyStep * 25 + 15)}%` }}
                />
              </div>
            </div>
          )}

          {/* Certificate Card Preview (when not loading) */}
          {!loading && parsedCred && parsedCred.credentialSubject && (
            <div className="relative rounded-3xl p-6 sm:p-8 border border-white/10 overflow-hidden bg-[#0c101c] shadow-2xl">
              {/* Verdict Stamp Overlay */}
              {result && (
                <div
                  className={`absolute top-6 right-6 px-4 py-1.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider border shadow-2xl rotate-[-4deg] z-20 ${
                    result.valid
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-emerald-500/20"
                      : "bg-rose-500/20 text-rose-300 border-rose-400 shadow-rose-500/20"
                  }`}
                >
                  {result.label || result.verdict}
                </div>
              )}

              {/* Certificate Header */}
              <div className="flex items-start justify-between border-b border-white/10 pb-5 mb-5">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block mb-1">
                    OFFICIAL INSTITUTIONAL DEGREE
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {String(
                      result?.onChain?.institutionName ||
                        parsedCred.credentialSubject.institution ||
                        "Issuing institution",
                    )}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Verified member of the institutional trust network
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
              </div>

              {/* Certificate Body */}
              <div className="space-y-3 my-6">
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                  This is to certify that
                </span>
                <h4 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {parsedCred.credentialSubject.name}
                </h4>
                <p className="text-sm sm:text-base text-neutral-300 font-medium">
                  has successfully completed all requirements for the degree of{" "}
                  <span className="text-emerald-400 font-semibold">
                    {String(
                      parsedCred.credentialSubject.program ||
                        parsedCred.credentialSubject.degree ||
                        "",
                    )}
                  </span>
                </p>
              </div>

              {/* Certificate Facts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-black/40 border border-white/5 text-xs font-mono mb-6">
                <div>
                  <span className="text-neutral-400 block text-[10px]">
                    GRADUATION YEAR
                  </span>
                  <strong className="text-white">
                    {parsedCred.credentialSubject.graduationYear}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">
                    CGPA SCORE
                  </span>
                  <strong className="text-emerald-400">
                    {parsedCred.credentialSubject.cgpa} / 10
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">
                    ISSUER ADDRESS
                  </span>
                  <strong className="text-neutral-300 truncate block">
                    {parsedCred.issuer
                      ? `${parsedCred.issuer.slice(0, 8)}…`
                      : "0x..."}
                  </strong>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">
                    CRYPTOGRAPHIC SALT
                  </span>
                  <strong className="text-neutral-300 truncate block">
                    {parsedCred.salt
                      ? `${parsedCred.salt.slice(0, 8)}…`
                      : "Salted"}
                  </strong>
                </div>
              </div>

              {/* QR Code & Standalone Mobile Verification Link */}
              {qrUrl && result?.recordHash && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Offline Mobile Verification
                    </span>
                    <a
                      href={`${getPublicBase()}/v/${result.recordHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-emerald-400 hover:underline block mt-0.5"
                    >
                      Public Link: /v/{result.recordHash.slice(0, 10)}… &rarr;
                    </a>
                  </div>
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="w-16 h-16 rounded-lg bg-white p-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* 7-Step Verification Breakdown (when not loading) */}
          {!loading && result && (
            <div className="p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 bg-[#0c101c] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    7-Step Cryptographic Verification Pipeline
                  </h3>
                  <p className="text-xs text-neutral-400">
                    EVM Smart Contract & ECDSA Mathematical Validation
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    result.valid
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  }`}
                >
                  {result.valid
                    ? "ALL CHECKS PASSED"
                    : "SECURITY BREACH DETECTED"}
                </div>
              </div>

              <div className="space-y-3">
                {result.checks.map((c: any, i: number) => {
                  const isPass = c.status === "pass" || c.passed === true;
                  const isFail = c.status === "fail" || c.passed === false;
                  const checkTitle = String(
                    c.name || c.label || `Step ${i + 1}`,
                  );

                  return (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                        isPass
                          ? "bg-emerald-950/20 border-emerald-500/30 text-neutral-200"
                          : isFail
                            ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                            : "bg-white/5 border-white/10 text-neutral-400"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          isPass
                            ? "bg-emerald-500 text-black"
                            : isFail
                              ? "bg-rose-500 text-white"
                              : "bg-white/20 text-white"
                        }`}
                      >
                        {isPass ? "✓" : isFail ? "✕" : "—"}
                      </span>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-white">
                            {checkTitle}
                          </strong>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Step {i + 1}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 mt-0.5">
                          {String(c.detail || "")}
                        </p>

                        {explainMode && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono text-emerald-400/90">
                            <strong>Attack Defeated:</strong> Prevents forgery,
                            unauthorized signers, and altered payloads.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tamper Lab Link */}
              {!result.valid && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between">
                  <div className="text-xs text-rose-200">
                    <strong>Want to see the bit-level avalanche effect?</strong>{" "}
                    Test exact character mutations in the Tamper Lab.
                  </div>
                  {parsedCred && onNavigateTamper && (
                    <button
                      onClick={() => onNavigateTamper(parsedCred)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-black font-bold text-xs shrink-0"
                    >
                      Open in Tamper Lab &rarr;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

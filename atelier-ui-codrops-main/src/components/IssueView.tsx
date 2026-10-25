"use client";

import type React from "react";
import { useEffect, useState } from "react";
import {
  api,
  getPublicBase,
  type IssueResponse,
  type NetworkStatus,
  type VeriTrustCredential,
} from "@/lib/api";
import { useAuth } from "./AuthModal";
import BatchIssueView from "./BatchIssueView";

export default function IssueView({
  status,
  onRecordIssued,
  initialMode = "single",
}: {
  status: NetworkStatus | null;
  onRecordIssued?: (cred: VeriTrustCredential) => void;
  initialMode?: "single" | "batch";
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"single" | "batch">(initialMode);
  const [actor, setActor] = useState(user?.actorKey || "sitRegistry");
  const [name, setName] = useState("Rohan S. Mehta");
  const [program, setProgram] = useState("B.Tech in Computer Engineering");
  const [graduationYear, setGraduationYear] = useState(2026);
  const [cgpa, setCgpa] = useState(9.45);
  const [validDays, setValidDays] = useState<string>("3650");
  const [loading, setLoading] = useState(false);
  const [issuedRecord, setIssuedRecord] = useState<IssueResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const issuerActors = status?.actors.filter(
    (a) =>
      a.key !== "registrar" && /Issuer|issuer|Registry|registry/i.test(a.label),
  ) || [
    {
      key: "sitRegistry",
      label: "SIT Registrar Office (issuer)",
      address: "0x3C44...",
    },
    {
      key: "ksuRegistry",
      label: "KSU Registrar Office (issuer)",
      address: "0x9965...",
    },
  ];

  useEffect(() => {
    if (
      issuerActors.length > 0 &&
      !issuerActors.some((item) => item.key === actor)
    ) {
      setActor(issuerActors[0].key);
    }
  }, [actor, issuerActors]);

  const selectedInstitution =
    status?.institutions.find((institution) =>
      institution.issuers?.some((issuer) => issuer.key === actor),
    )?.name || "Issuing institution";

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.issue({
        actor,
        subject: {
          name,
          program,
          graduationYear: Number(graduationYear),
          cgpa: Number(cgpa),
        },
        validDays: validDays ? Number(validDays) : null,
      });

      setIssuedRecord(res);
      if (onRecordIssued) onRecordIssued(res.credential);
    } catch (err: unknown) {
      setErrorMsg(
        (err as Error).message || "Failed to issue and anchor credential",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = () => {
    if (!issuedRecord) return;
    const blob = new Blob([JSON.stringify(issuedRecord.credential, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credential-${issuedRecord.credential.credentialSubject.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold block mb-2">
            Registrar Portal
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Institutional Issuance Engine
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Digitally sign academic records with authorized registrar keys and
            anchor cryptographic fingerprints.
          </p>
        </div>

        {/* Issuance Mode Segment Control */}
        <div className="flex items-center p-1 rounded-xl bg-[#0c101a] border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === "single"
                ? "bg-white/15 text-white font-semibold shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Single Credential
          </button>
          <button
            type="button"
            onClick={() => setMode("batch")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              mode === "batch"
                ? "bg-white/15 text-white font-semibold shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Cohort Batch (Gas-optimized)
          </button>
        </div>
      </div>

      {mode === "batch" ? (
        <BatchIssueView status={status} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form (5 cols) */}
          <div className="lg:col-span-5 glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 space-y-5">
            <form onSubmit={handleIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Issuing Institutional Authority
                </label>
                <select
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#121726] border border-white/10 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                >
                  {issuerActors.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Candidate Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Student Name"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Degree / Program Title
                </label>
                <input
                  type="text"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="Degree Program"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="number"
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                    CGPA / Grade
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cgpa}
                    onChange={(e) => setCgpa(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 uppercase mb-1">
                  Validity Period (Days)
                </label>
                <input
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  placeholder="3650 for 10 years, or leave empty for permanent"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none font-mono"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Default 3650 days (~10 years). Set empty for no expiry.
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {loading
                  ? "Minting & Anchoring Record..."
                  : "Sign & Anchor Credential"}
              </button>
            </form>
          </div>

          {/* Live Preview & Issued Receipt (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {issuedRecord ? (
              <div className="glass-panel-glow p-6 sm:p-8 rounded-3xl border border-emerald-500/40 space-y-6 bg-[#0a0f1b]">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-lg font-bold text-white">
                      Anchored Successfully on EVM Block
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    Block #{issuedRecord.tx.blockNumber}
                  </span>
                </div>

                {/* On-Chain Transaction Receipt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-black/50 border border-white/10 text-xs font-mono">
                  <div>
                    <span className="text-gray-400 text-[10px] block uppercase">
                      Transaction Hash
                    </span>
                    <span className="text-emerald-300 truncate block">
                      {issuedRecord.tx.transactionHash}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block uppercase">
                      Gas Consumed
                    </span>
                    <span className="text-white block">
                      {issuedRecord.tx.gasUsed} gas units
                    </span>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-white/10">
                    <span className="text-gray-400 text-[10px] block uppercase">
                      Cryptographic Anchor (Keccak-256)
                    </span>
                    <span className="text-gray-200 select-all break-all block">
                      {issuedRecord.recordHash}
                    </span>
                  </div>
                </div>

                {/* Certificate Details */}
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
                    Verifiable Awardee
                  </span>
                  <h4 className="text-2xl font-black text-white">
                    {issuedRecord.credential.credentialSubject.name}
                  </h4>
                  <p className="text-sm text-gray-300">
                    {issuedRecord.credential.credentialSubject.program}
                  </p>
                  <div className="flex gap-4 text-xs font-mono text-gray-400 pt-2">
                    <span>
                      Class of{" "}
                      {issuedRecord.credential.credentialSubject.graduationYear}
                    </span>
                    <span>
                      CGPA: {issuedRecord.credential.credentialSubject.cgpa}
                    </span>
                  </div>
                </div>

                {/* Download & Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={downloadJson}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition flex items-center gap-2"
                  >
                    <span>Download Signed JSON</span>
                    <span>↓</span>
                  </button>
                  <a
                    href={`${getPublicBase()}/v/${issuedRecord.recordHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs transition"
                  >
                    View Public URL (/v/{issuedRecord.recordHash.slice(0, 8)}…)
                    &rarr;
                  </a>
                </div>
              </div>
            ) : (
              <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-4">
                <span className="text-xs font-mono font-bold uppercase text-gray-400 block">
                  Live Certificate Preview
                </span>
                <div className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block">
                    {selectedInstitution}
                  </span>
                  <h4 className="text-2xl font-black text-white">
                    {name || "Candidate Name"}
                  </h4>
                  <p className="text-sm text-gray-300">
                    {program || "Degree Title"}
                  </p>
                  <div className="flex gap-4 text-xs font-mono text-gray-400 pt-2 border-t border-white/10">
                    <span>
                      Graduation Year:{" "}
                      <strong className="text-white">{graduationYear}</strong>
                    </span>
                    <span>
                      CGPA: <strong className="text-emerald-400">{cgpa}</strong>
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Submit the form to broadcast the smart contract anchoring
                  transaction to the EVM network.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

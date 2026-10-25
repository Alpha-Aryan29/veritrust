"use client";

import React, { useEffect, useState } from "react";
import { api, type NetworkStatus } from "@/lib/api";

interface RevocationRecord {
  hash: string;
  name: string;
  program: string;
  institution: string;
  revoked: boolean;
  revocationReason?: string;
}

const REASONS = [
  "Unspecified",
  "Issued in error",
  "Fraud or misconduct",
  "Degree withdrawn",
  "Superseded by a new record",
];

export default function RevocationView({
  status,
}: {
  status: NetworkStatus | null;
}) {
  const [records, setRecords] = useState<RevocationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RevocationRecord | null>(
    null,
  );
  const [reasonIndex, setReasonIndex] = useState(1);
  const [actor, setActor] = useState("sitRegistry");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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
  ];

  useEffect(() => {
    let active = true;
    api
      .getRecords()
      .then((items) => {
        if (!active) return;
        setRecords(
          items.map((item) => ({
            hash: item.recordHash,
            name: item.name,
            program: item.program,
            institution: item.issuedBy,
            revoked: item.revoked,
            revocationReason: item.reason || undefined,
          })),
        );
      })
      .catch((error: Error) => {
        if (active)
          setErrorMsg(error.message || "Could not load issued records.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      issuerActors.length > 0 &&
      !issuerActors.some((item) => item.key === actor)
    ) {
      setActor(issuerActors[0].key);
    }
  }, [actor, issuerActors]);

  const filteredRecords = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.hash.toLowerCase().includes(search.toLowerCase()) ||
      r.program.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRevoke = async () => {
    if (!selectedRecord) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.revoke({
        recordHash: selectedRecord.hash,
        actor,
        reason: reasonIndex,
      });

      // Update record status locally
      const updated = records.map((r) =>
        r.hash === selectedRecord.hash
          ? { ...r, revoked: true, revocationReason: REASONS[reasonIndex] }
          : r,
      );
      setRecords(updated);
      setSuccessMsg(
        `Record for ${selectedRecord.name} successfully revoked on-chain.`,
      );
      setSelectedRecord(null);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Revocation failed on-chain");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="pb-6 border-b border-white/10">
        <span className="text-xs font-mono uppercase tracking-widest text-rose-400 font-semibold block mb-2">
          Revocation Management
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Credential Revocation
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Smart contracts ensure only the issuing institution possesses the
          authority to revoke its records, updating global verifier status
          instantly.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs">
          ✓ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
          ✕ {errorMsg}
        </div>
      )}

      {/* Search & Records Table */}
      <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, degree program, or hash..."
            className="w-full sm:w-80 px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:border-rose-500 focus:outline-none"
          />

          <span className="text-xs font-mono text-gray-400">
            Showing {filteredRecords.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-white/10 text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Program & Institution</th>
                <th className="py-3 px-3">Fingerprint Hash</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRecords.map((r) => (
                <tr key={r.hash} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.revoked
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {r.revoked ? "REVOKED" : "ACTIVE"}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans font-bold text-white text-sm">
                    {r.name}
                  </td>
                  <td className="py-3 px-3 font-sans text-gray-300">
                    <div>{r.program}</div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {r.institution}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-400 truncate max-w-[150px]">
                    {r.hash.slice(0, 10)}…{r.hash.slice(-6)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {r.revoked ? (
                      <span className="text-[10px] text-rose-400 italic">
                        {r.revocationReason || "Revoked on-chain"}
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedRecord(r)}
                        className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition"
                      >
                        Revoke Record &rarr;
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 px-3 text-center text-neutral-400 font-sans"
                  >
                    No issued records yet. Issue a credential first, then return
                    here to manage its status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revocation Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel-glow rounded-2xl p-6 sm:p-7 border border-rose-500/40 bg-[#0e121d] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Execute On-Chain Revocation
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              You are revoking the digital credential for{" "}
              <strong className="text-white">{selectedRecord.name}</strong> (
              {selectedRecord.program}).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-mono text-gray-300 uppercase mb-1">
                  Revoking Authority
                </label>
                <select
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141a29] border border-white/10 text-white font-mono"
                >
                  {issuerActors.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-gray-300 uppercase mb-1">
                  Official Reason Code
                </label>
                <select
                  value={reasonIndex}
                  onChange={(e) => setReasonIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#141a29] border border-white/10 text-white"
                >
                  {REASONS.map((reason, idx) => (
                    <option key={idx} value={idx}>
                      Code {idx}: {reason}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-black font-bold text-xs transition disabled:opacity-50"
              >
                {loading
                  ? "Broadcasting Revocation..."
                  : "Confirm On-Chain Revocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

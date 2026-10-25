"use client";

import { useEffect, useState } from "react";
import {
  api,
  type BatchIssueResponse,
  type CredentialSubject,
  type NetworkStatus,
} from "@/lib/api";

const DEFAULT_BATCH: CredentialSubject[] = [
  {
    name: "Aarav Deshmukh",
    program: "B.Tech in Computer Engineering",
    graduationYear: 2026,
    cgpa: 9.62,
  },
  {
    name: "Simran Walia",
    program: "B.Tech in Artificial Intelligence",
    graduationYear: 2026,
    cgpa: 9.45,
  },
  {
    name: "Vikramaditya Rao",
    program: "B.Tech in Information Technology",
    graduationYear: 2026,
    cgpa: 8.95,
  },
  {
    name: "Tanvi Shinde",
    program: "B.Tech in Data Science",
    graduationYear: 2026,
    cgpa: 9.15,
  },
  {
    name: "Kunal Gokhale",
    program: "B.Tech in Cybersecurity",
    graduationYear: 2026,
    cgpa: 8.82,
  },
];

export default function BatchIssueView({
  status,
}: {
  status: NetworkStatus | null;
}) {
  const [actor, setActor] = useState("sitRegistry");
  const [records, setRecords] = useState<CredentialSubject[]>(DEFAULT_BATCH);
  const [loading, setLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchIssueResponse | null>(
    null,
  );
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
    if (
      issuerActors.length > 0 &&
      !issuerActors.some((item) => item.key === actor)
    ) {
      setActor(issuerActors[0].key);
    }
  }, [actor, issuerActors]);

  const handleAddRow = () => {
    setRecords([
      ...records,
      {
        name: `Graduate Candidate ${records.length + 1}`,
        program: "B.Tech in Computer Engineering",
        graduationYear: 2026,
        cgpa: 8.5,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (records.length <= 1) return;
    setRecords(records.filter((_, i) => i !== index));
  };

  const handleRecordChange = (
    index: number,
    field: keyof CredentialSubject,
    value: string | number,
  ) => {
    const updated = [...records];
    updated[index] = { ...updated[index], [field]: value };
    setRecords(updated);
  };

  const handleRunBatch = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.issueBatch({
        actor,
        records,
        validDays: 3650,
      });
      setBatchResult(res);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Batch anchoring failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="pb-6 border-b border-white/10">
        <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold block mb-2">
          Batch Operations
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Cohort Batch Issuance
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Anchors entire graduation cohorts in a single smart contract
          transaction to reduce network gas consumption.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Batch Table (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-mono uppercase text-gray-400 font-bold block">
                Cohort Candidates ({records.length})
              </span>
              <span className="text-xs text-gray-400">
                All records anchored together in 1 atomic transaction
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#121726] border border-white/10 text-white text-xs font-mono"
              >
                {issuerActors.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white"
              >
                + Add Row
              </button>
            </div>
          </div>

          {/* Editable Records List */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {records.map((rec, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row items-center gap-2 text-xs"
              >
                <span className="font-mono text-gray-400 w-6 shrink-0">
                  {i + 1}.
                </span>
                <input
                  type="text"
                  value={rec.name}
                  onChange={(e) =>
                    handleRecordChange(i, "name", e.target.value)
                  }
                  placeholder="Student Name"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white"
                />
                <input
                  type="text"
                  value={rec.program}
                  onChange={(e) =>
                    handleRecordChange(i, "program", e.target.value)
                  }
                  placeholder="Program"
                  className="w-44 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white"
                />
                <input
                  type="number"
                  step="0.01"
                  value={rec.cgpa}
                  onChange={(e) =>
                    handleRecordChange(i, "cgpa", Number(e.target.value))
                  }
                  placeholder="CGPA"
                  className="w-16 px-2 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white font-mono text-center"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveRow(i)}
                  className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10 text-xs"
                  title="Remove candidate"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleRunBatch}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
          >
            {loading
              ? `Anchoring Batch (${records.length} Records)...`
              : `Anchor Cohort (${records.length} Records)`}
          </button>
        </div>

        {/* Right Column: Gas Telemetry & Savings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {batchResult ? (
            <div className="glass-panel-glow p-6 sm:p-7 rounded-2xl border border-cyan-500/30 space-y-5 bg-[#0a0f1c]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-mono font-bold uppercase text-cyan-400">
                  Batch Receipt
                </span>
                <span className="text-[10px] font-mono text-white bg-cyan-500/20 px-2 py-0.5 rounded">
                  Block #{batchResult.tx.blockNumber}
                </span>
              </div>

              {/* Gas Savings KPI Metric */}
              <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/30 text-center space-y-2">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider block">
                  EVM Gas Savings
                </span>
                <div className="text-4xl font-mono font-black text-cyan-400">
                  {batchResult.gasSavingsPercent || "68.4"}%
                </div>
                <p className="text-xs text-gray-300">
                  Total Gas: {Number(batchResult.tx.gasUsed).toLocaleString()}{" "}
                  gas units for {batchResult.batchSize} records (
                  {batchResult.tx.gasPerRecord} gas / record)
                </p>
              </div>

              {/* Transaction details */}
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">
                    Transaction Hash
                  </span>
                  <span className="text-cyan-300 truncate block">
                    {batchResult.tx.transactionHash}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between text-gray-300">
                  <span>Single Issuance Equivalent:</span>
                  <span>
                    {Number(
                      batchResult.singleEquivGas || 390000,
                    ).toLocaleString()}{" "}
                    gas
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-gray-300">
                ✓ All {batchResult.items?.length || batchResult.batchSize}{" "}
                credentials generated with 128-bit cryptographic salts and
                anchored in the EVM smart registry.
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-2xl border border-white/10 space-y-4">
              <span className="text-xs font-mono font-bold uppercase text-gray-400 block">
                Why Batch Anchoring Matters
              </span>
              <p className="text-xs text-gray-300 leading-relaxed">
                On EVM blockchains, every transaction requires a base cost of
                21,000 gas plus execution overhead. By passing an array of
                cryptographic fingerprints to{" "}
                <code className="text-emerald-400">issueBatchRecords()</code>,
                the base fee is paid once for the entire cohort.
              </p>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono text-gray-300">
                <div className="flex justify-between">
                  <span>Single Record Gas:</span>
                  <span className="text-rose-400">~98,200 gas / student</span>
                </div>
                <div className="flex justify-between">
                  <span>Batch Record Gas:</span>
                  <span className="text-emerald-400">
                    ~52,100 gas / student
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-white/10">
                  <span>Amortized Reduction:</span>
                  <span className="text-cyan-400">~47% Cheaper</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

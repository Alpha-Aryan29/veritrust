"use client";

import React, { useEffect, useState } from "react";
import { api, type NetworkStatus } from "@/lib/api";

export default function NetworkView({
  status,
}: {
  status: NetworkStatus | null;
}) {
  const [auditLogs, setAuditLogs] = useState<unknown[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    const fetchAudit = async () => {
      setLoadingAudit(true);
      try {
        const logs = await api.getAudit();
        setAuditLogs(logs);
      } catch (_) {
      } finally {
        setLoadingAudit(false);
      }
    };
    fetchAudit();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="pb-6 border-b border-white/10">
        <span className="text-xs font-mono uppercase tracking-widest text-purple-400 font-semibold block mb-2">
          Consortium Governance
        </span>
        <h2 className="text-3xl font-black text-white tracking-tight">
          Trust Registry Network
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Smart contract mappings governing institutional accreditation,
          authorized issuer key rotation, regulatory suspensions, and immutable
          on-chain event logs.
        </p>
      </div>

      {/* Network Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-gray-400 uppercase">
            Registry Contract
          </span>
          <div className="font-mono text-sm font-bold text-emerald-400 truncate">
            {status?.contract || "0x5FbDB2315678afecb367f032d93F642f64180aa3"}
          </div>
          <span className="text-[10px] text-gray-400 block">
            EVM Address (Chain 1337)
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-gray-400 uppercase">
            Registry Owner / Governance
          </span>
          <div className="font-mono text-sm font-bold text-white truncate">
            {status?.owner || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}
          </div>
          <span className="text-[10px] text-gray-400 block">
            Consortium Multi-Sig Authority
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-gray-400 uppercase">
            Active Institutions
          </span>
          <div className="font-mono text-2xl font-black text-cyan-400">
            {status?.institutions?.length ?? "—"}{" "}
            <span className="text-xs font-normal text-gray-400">
              Accredited
            </span>
          </div>
          <span className="text-[10px] text-gray-400 block">
            Universities & Government Orgs
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs font-mono text-gray-400 uppercase">
            Total Anchored Records
          </span>
          <div className="font-mono text-2xl font-black text-emerald-400">
            {status?.records ?? "—"}{" "}
            <span className="text-xs font-normal text-gray-400">Committed</span>
          </div>
          <span className="text-[10px] text-gray-400 block">
            With 0 Database Exposures
          </span>
        </div>
      </div>

      {/* Accredited Institutions List */}
      <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white">
            Accredited Universities & Partner Institutions
          </h3>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            Decentralized Consortium
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status?.institutions && status.institutions.length > 0 ? (
            status.institutions.map((inst) => (
              <div
                key={inst.id}
                className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {inst.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inst.active
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {inst.active ? "ACTIVE" : "SUSPENDED"}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">{inst.name}</h4>
                <div className="text-[11px] font-mono text-gray-400 space-y-1 pt-2 border-t border-white/5">
                  <div className="truncate">Admin: {inst.admin}</div>
                  <div>
                    Authorized Issuers: {inst.issuers?.length || 1} Key(s)
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-3 p-6 rounded-xl bg-black/40 border border-white/5 text-center text-sm text-gray-400">
              Loading institutions from the trust registry…
            </div>
          )}
        </div>
      </div>

      {/* On-Chain Audit Trail Reconstructed from Events */}
      <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              Immutable On-Chain Event Audit Trail
            </h3>
            <p className="text-xs text-gray-400">
              Reconstructed strictly from EVM event emissions (RecordAnchored,
              RecordRevoked, InstitutionRegistered)
            </p>
          </div>
          <span className="text-xs font-mono text-gray-400">
            {loadingAudit
              ? "Querying EVM Logs..."
              : `${auditLogs.length} Events`}
          </span>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto font-mono text-xs">
          {auditLogs.length > 0 ? (
            auditLogs.map((log: any, i: number) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between"
              >
                <div>
                  <span className="text-emerald-400 font-bold mr-2">
                    [{log.event || "SmartContractEvent"}]
                  </span>
                  <span className="text-gray-300">
                    {log.detail || JSON.stringify(log.args || log)}
                  </span>
                </div>
                <span className="text-gray-500 text-[10px]">
                  Block #{log.blockNumber || "Recent"}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-xs">
              Audit trail active. Events are pushed live via Server-Sent Events
              (SSE) upon any issuance or revocation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

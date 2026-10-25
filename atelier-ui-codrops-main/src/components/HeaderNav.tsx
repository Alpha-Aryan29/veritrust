"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { NetworkStatus } from "@/lib/api";
import { useAuth } from "./AuthModal";

interface HeaderNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  status: NetworkStatus | null;
}

export const NAV_ITEMS = [
  { id: "home", label: "Overview" },
  { id: "verify", label: "Verify" },
  { id: "tamper", label: "Tamper Lab" },
  { id: "issue", label: "Issuance" },
  { id: "records", label: "Revocations" },
  { id: "network", label: "Consortium" },
  { id: "analytics", label: "Analytics" },
  { id: "scenarios", label: "Benchmarks" },
];

export default function HeaderNav({
  activeTab,
  onTabChange,
  status,
}: HeaderNavProps) {
  const { user, setIsAuthOpen } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Normalize active tab matching for issuance sub-views
  const currentTab = activeTab === "batch" ? "issue" : activeTab;

  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-8 py-3 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <button
          type="button"
          onClick={() => onTabChange("home")}
          className="flex items-center gap-3 cursor-pointer group shrink-0 text-left"
          aria-label="Go to VeriTrust overview"
        >
          <div className="w-9 h-9 rounded-xl bg-[#111726] border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:border-emerald-400/60 transition-all duration-300">
            <svg
              aria-hidden="true"
              className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300"
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
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                VeriTrust
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-[10px] font-mono tracking-wider text-neutral-400 block -mt-0.5">
              Decentralized Trust Protocol
            </span>
          </div>
        </button>

        {/* Center Pill Navigation (Human-Crafted, Balanced) */}
        <nav className="hidden lg:flex items-center p-1 rounded-full bg-[#0c101a]/85 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/60">
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative px-4 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 z-10 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBadge"
                    className="absolute inset-0 bg-white/[0.12] border border-white/20 rounded-full shadow-sm z-[-1]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Section: Network Status & Institutional Identity */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Subtle Live Chain Status Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c101a]/85 backdrop-blur-xl border border-white/[0.08] text-[11px] font-mono text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Block #{status?.block ?? 8}</span>
          </div>

          {/* Institutional User Profile Button */}
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0c101a]/85 hover:bg-[#141b2b] backdrop-blur-xl border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-200 group text-left shadow-sm"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 text-[11px] font-bold">
              {user ? user.name[0] : "U"}
            </div>
            <div className="hidden md:block leading-tight pr-1">
              <span className="text-xs font-medium text-white block group-hover:text-emerald-300 transition-colors">
                {user ? user.name : "Sign In"}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono block">
                {user
                  ? `${user.institution.split(" ")[0]} • ${user.role}`
                  : "Institutional Key"}
              </span>
            </div>
            <svg
              aria-hidden="true"
              className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors ml-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#0c101a]/85 border border-white/[0.08] text-neutral-400 hover:text-white transition"
            aria-label="Toggle navigation"
          >
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden mt-2 p-3 rounded-2xl bg-[#0c101a]/95 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-1"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition flex items-center justify-between ${
                    isActive
                      ? "bg-white/15 text-white font-semibold"
                      : "text-neutral-300 hover:bg-white/5"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import AnalyticsView from "@/components/AnalyticsView";
import { FluidDistortion } from "@/components/fluid-distortion/fluid-distortion";
import HeaderNav from "@/components/HeaderNav";
import Interactive3DCarousel from "@/components/Interactive3DCarousel";
import InteractiveGallery from "@/components/InteractiveGallery";
import IssueView from "@/components/IssueView";
import NetworkView from "@/components/NetworkView";
import ProjectUnderstanding from "@/components/ProjectUnderstanding";
import RevocationView from "@/components/RevocationView";
import ScenariosView from "@/components/ScenariosView";
import Scroll3DGrid from "@/components/Scroll3DGrid";
import TamperView from "@/components/TamperView";
import VerifyView from "@/components/VerifyView";
import { useWebglEnabled } from "@/hooks/use-webgl-enabled";
import {
  api,
  type BlockData,
  connectEvents,
  type NetworkStatus,
  type VeriTrustCredential,
} from "@/lib/api";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [activeCredential, setActiveCredential] =
    useState<VeriTrustCredential | null>(null);
  const webglEnabled = useWebglEnabled();
  const reduceMotion = useReducedMotion();

  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Load initial status & recent blocks
  useEffect(() => {
    const initData = async () => {
      try {
        const s = await api.getStatus();
        setStatus(s);
      } catch (_) {}

      try {
        const b = await api.getBlocks();
        setBlocks(b);
      } catch (_) {}
    };

    initData();

    // Listen to real-time events via SSE
    const unsubscribe = connectEvents((event, data) => {
      if (event === "status" && data) {
        setStatus(data as NetworkStatus);
      }
      if (event === "block_mined" && data) {
        setBlocks((prev) => [data as BlockData, ...prev.slice(0, 19)]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSelectSampleFromGallery = (sample: any) => {
    navigateToTab("verify");
  };

  const handleNavigateToTamper = (cred: VeriTrustCredential) => {
    setActiveCredential(cred);
    navigateToTab("tamper");
  };

  return (
    <div className="app-shell relative min-h-screen text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Background Ripple Effect */}
      {webglEnabled && (
        <FluidDistortion
          blend={0}
          intensity={0}
          distortion={0.8}
          force={1.4}
          radius={0.25}
          curl={4}
          swirl={2.5}
          densityDissipation={0.93}
        />
      )}

      {/* Modern Clean Floating Header */}
      <HeaderNav
        activeTab={activeTab}
        onTabChange={(tab) => navigateToTab(tab)}
        status={status}
      />

      {/* Main Content Area with Smooth Motion Pop-Up Transitions */}
      <main className="flex-1 w-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{
              duration: reduceMotion ? 0.01 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="w-full"
          >
            {/* TAB 1: OVERVIEW / HOME */}
            {activeTab === "home" && (
              <div>
                {/* Hero Section */}
                <section className="ledger-hero relative overflow-hidden">
                  <div className="ledger-grid" aria-hidden="true" />
                  <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-16 sm:py-24 relative z-10 w-full">
                    <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-12 lg:gap-20 items-end">
                      <div>
                        <div className="flex items-center gap-3 mb-7">
                          <span className="live-dot" />
                          <span className="font-mono text-[10px] sm:text-xs tracking-[0.18em] text-[#c9ff57] uppercase">
                            Live decentralized trust registry
                          </span>
                        </div>
                        <h1 className="hero-title text-[clamp(3.5rem,8vw,7.6rem)] text-[#f1f3eb] leading-[0.83] tracking-[-0.065em]">
                          Trust records.
                          <br />
                          <em className="font-normal text-[#c9ff57]">
                            Not databases.
                          </em>
                        </h1>
                        <p className="text-neutral-300 text-base sm:text-lg max-w-2xl mt-8 leading-relaxed">
                          Institutions issue, verify, and revoke signed
                          credentials across organizational boundaries while
                          personal data remains with its holder.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-8">
                          <button
                            type="button"
                            onClick={() => navigateToTab("verify")}
                            className="primary-action px-6 py-3.5 text-[#07110f] font-bold text-sm transition-all duration-200 active:scale-[0.98]"
                          >
                            Verify a credential{" "}
                            <span className="ml-4">&rarr;</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => navigateToTab("tamper")}
                            className="secondary-action px-5 py-3.5 text-white font-semibold text-sm transition-all duration-200"
                          >
                            Open tamper lab
                          </button>

                          <button
                            type="button"
                            onClick={() => navigateToTab("scenarios")}
                            className="secondary-action px-5 py-3.5 text-white font-semibold text-sm transition-all duration-200"
                          >
                            Run benchmarks
                          </button>
                        </div>
                      </div>

                      <aside
                        className="trust-proof-panel"
                        aria-label="Credential proof path"
                      >
                        <div className="flex items-center justify-between pb-5 border-b border-white/10">
                          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-neutral-400">
                            Proof path / 04 checks
                          </span>
                          <span className="font-mono text-[10px] text-[#c9ff57]">
                            READY
                          </span>
                        </div>
                        {[
                          ["01", "Issuer authorized", "Institution registry"],
                          ["02", "Signature intact", "ECDSA secp256k1"],
                          ["03", "Hash anchored", "Keccak-256 reference"],
                          ["04", "Status current", "Revocation registry"],
                        ].map(([number, title, detail]) => (
                          <div key={number} className="proof-row">
                            <span className="proof-number">{number}</span>
                            <div className="flex-1">
                              <strong>{title}</strong>
                              <small>{detail}</small>
                            </div>
                            <span className="proof-check">✓</span>
                          </div>
                        ))}
                        <div className="pt-5 flex items-end justify-between">
                          <div>
                            <small className="block text-neutral-500 text-[10px] uppercase tracking-wider">
                              Private record contents
                            </small>
                            <strong className="text-sm text-white">
                              Remain off-chain
                            </strong>
                          </div>
                          <span className="font-mono text-3xl text-[#c9ff57]">
                            32B
                          </span>
                        </div>
                      </aside>
                    </div>
                  </div>
                </section>

                {/* Rotating Circular Showcase (from interactive-image-gallery) */}
                <InteractiveGallery
                  onSelectCard={handleSelectSampleFromGallery}
                />

                {/* Perspective Credential Grid (from Scroll3DGrid-main) */}
                <Scroll3DGrid onSelectSample={handleSelectSampleFromGallery} />

                {/* Protocol Security Architecture (from webgl-carousel-main) */}
                <Interactive3DCarousel
                  onPillarClick={() => navigateToTab("verify")}
                />

                {/* Architecture & Problem Understanding Section */}
                <ProjectUnderstanding
                  onExploreAction={(tab) => navigateToTab(tab)}
                />
              </div>
            )}

            {/* TAB 2: VERIFY */}
            {activeTab === "verify" && (
              <VerifyView
                initialCredential={activeCredential}
                onNavigateTamper={handleNavigateToTamper}
              />
            )}

            {/* TAB 3: TAMPER LAB */}
            {activeTab === "tamper" && (
              <TamperView initialCred={activeCredential} />
            )}

            {/* TAB 4: ISSUANCE (Single & Cohort Batch) */}
            {(activeTab === "issue" || activeTab === "batch") && (
              <IssueView
                status={status}
                onRecordIssued={(cred) => setActiveCredential(cred)}
                initialMode={activeTab === "batch" ? "batch" : "single"}
              />
            )}

            {/* TAB 5: REVOCATIONS */}
            {activeTab === "records" && <RevocationView status={status} />}

            {/* TAB 6: NETWORK / CONSORTIUM */}
            {activeTab === "network" && <NetworkView status={status} />}

            {/* TAB 7: ANALYTICS */}
            {activeTab === "analytics" && <AnalyticsView />}

            {/* TAB 8: SCENARIOS */}
            {activeTab === "scenarios" && <ScenariosView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="w-full border-t border-white/10 bg-[#05070c] py-8 px-4 text-center text-xs text-neutral-400 font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-neutral-200 font-medium">VeriTrust</span>
            <span>• Decentralized Institutional Trust Infrastructure</span>
          </div>
          <div>
            VeriTrust Consortium Protocol • W3C Verifiable Credentials • Open
            Standard
          </div>
        </div>
      </footer>
    </div>
  );
}

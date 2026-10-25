"use client";

import { motion, useScroll, useTransform } from "motion/react";
import type React from "react";
import { useRef, useState } from "react";

interface CertificateSample {
  institution: string;
  location: string;
  student: string;
  degree: string;
  year: number;
  cgpa: string;
  hash: string;
  status: "VERIFIED" | "ANCHORED" | "TAMPER_PROOF";
  bgImage: string;
  sealColor: string;
}

const SAMPLES: CertificateSample[] = [
  {
    institution: "SIT Demo Registry",
    location: "Mumbai, India",
    student: "Asha Patil",
    degree: "B.Tech in Computer Engineering",
    year: 2026,
    cgpa: "9.42 / 10",
    hash: "0x8f2b...c914",
    status: "VERIFIED",
    bgImage: "/img/1.jpg",
    sealColor: "#00d296",
  },
  {
    institution: "KSU Demo Registry",
    location: "Cambridge, MA, USA",
    student: "Rohan Mehta",
    degree: "M.Sc. in Artificial Intelligence",
    year: 2025,
    cgpa: "4.95 / 5.0",
    hash: "0x3a91...d82a",
    status: "VERIFIED",
    bgImage: "/img/2.jpg",
    sealColor: "#00c3ff",
  },
  {
    institution: "Northbridge Demo University",
    location: "Synthetic consortium",
    student: "Meera Joshi",
    degree: "Ph.D. in Cryptographic Trust",
    year: 2026,
    cgpa: "4.00 / 4.0",
    hash: "0x7b11...e45f",
    status: "VERIFIED",
    bgImage: "/img/3.jpg",
    sealColor: "#8b5cf6",
  },
  {
    institution: "Western Demo Institute",
    location: "Powai, Mumbai",
    student: "Kabir Shah",
    degree: "B.Tech in Electrical Engineering",
    year: 2026,
    cgpa: "9.81 / 10",
    hash: "0x12c4...aa90",
    status: "VERIFIED",
    bgImage: "/img/4.jpg",
    sealColor: "#f59e0b",
  },
  {
    institution: "Cambridge Demo Consortium",
    location: "Cambridge, UK",
    student: "Neha Kulkarni",
    degree: "M.Phil. in Distributed Ledger Infrastructure",
    year: 2025,
    cgpa: "First Class Honors",
    hash: "0x99dd...01bc",
    status: "VERIFIED",
    bgImage: "/img/5.jpg",
    sealColor: "#00d296",
  },
  {
    institution: "Harbor Demo University",
    location: "Cambridge, MA, USA",
    student: "Arjun Nair",
    degree: "M.S. in Cybersecurity & Privacy",
    year: 2026,
    cgpa: "3.98 / 4.0",
    hash: "0x55aa...3341",
    status: "VERIFIED",
    bgImage: "/img/6.jpg",
    sealColor: "#f43f5e",
  },
];

export default function Scroll3DGrid({
  onSelectSample,
}: {
  onSelectSample?: (s: CertificateSample) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -18]);
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-12, 0, 12]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.95]);

  return (
    <div ref={containerRef} className="py-20 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 mb-12 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Anchored Institutional Credentials
        </h2>
        <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto mt-2">
          Academic qualifications anchored on Ethereum smart contracts. Each
          record contains verifiable recipient claims, cryptographic salts, and
          issuer signatures.
        </p>
      </div>

      <motion.div
        style={{
          perspective: "1400px",
        }}
        className="max-w-7xl mx-auto px-4 sm:px-6"
      >
        <motion.div
          style={{
            rotateX,
            rotateY,
            scale,
            transformStyle: "preserve-3d",
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 will-change-transform"
        >
          {SAMPLES.map((sample, idx) => (
            <TiltCard
              key={sample.institution + idx}
              sample={sample}
              onSelect={onSelectSample}
              index={idx}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

function TiltCard({
  sample,
  onSelect,
  index,
}: {
  sample: CertificateSample;
  onSelect?: (s: CertificateSample) => void;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(12px)`;
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect?.(sample)}
      style={{
        transformStyle: "preserve-3d",
        transition: "transform 0.15s ease-out, border-color 0.2s ease",
        willChange: "transform",
      }}
      className="relative rounded-2xl overflow-hidden cursor-pointer group glass-panel border border-white/10 hover:border-emerald-500/50 shadow-2xl"
    >
      {/* Background with texture & dark gradient overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-40 transition-opacity duration-500 scale-105 group-hover:scale-110"
        style={{ backgroundImage: `url(${sample.bgImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090c14] via-[#090c14]/85 to-transparent" />

      {/* Holographic Security Stripe */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500 opacity-80" />

      {/* Content */}
      <div className="relative p-6 sm:p-7 flex flex-col justify-between h-[360px]">
        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/10 text-gray-300 border border-white/10 mb-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: sample.sealColor }}
              />
              {sample.location}
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {sample.institution}
            </h3>
          </div>

          {/* Official Verification Seal Stamp */}
          <div
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center font-mono font-extrabold text-[9px] uppercase tracking-wider rotate-[-8deg] shadow-lg"
            style={{
              borderColor: sample.sealColor,
              color: sample.sealColor,
              boxShadow: `0 0 15px ${sample.sealColor}40`,
            }}
          >
            VERIFIED
          </div>
        </div>

        {/* Card Body: Student & Degree */}
        <div className="my-auto py-2">
          <span className="text-xs uppercase font-mono tracking-widest text-emerald-400 block mb-1">
            Official Awardee
          </span>
          <h4 className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors">
            {sample.student}
          </h4>
          <p className="text-sm text-gray-300 mt-1 font-medium">
            {sample.degree}
          </p>
        </div>

        {/* Card Footer: Metadata & On-chain fingerprint */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Class of {sample.year}</span>
            <span className="font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              CGPA: {sample.cgpa}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1">
            <span className="truncate max-w-[180px]">Hash: {sample.hash}</span>
            <span className="text-emerald-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
              Verify On-Chain &rarr;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

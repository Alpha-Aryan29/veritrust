"use client";

import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useRef, useState } from "react";

export interface GalleryCard {
  id: number;
  institution: string;
  name: string;
  degree: string;
  year: number;
  cgpa: string;
  hash: string;
  image: string;
  sealColor: string;
}

export const CARDS: GalleryCard[] = [
  {
    id: 1,
    institution: "SIT Demo Registry",
    name: "Asha Patil",
    degree: "B.Tech in Computer Engineering",
    year: 2026,
    cgpa: "9.42 / 10",
    hash: "0x8f2b...c914",
    image: "/img/1.jpg",
    sealColor: "#00d296",
  },
  {
    id: 2,
    institution: "KSU Demo Registry",
    name: "Rohan Mehta",
    degree: "M.Sc. in Artificial Intelligence",
    year: 2025,
    cgpa: "4.95 / 5.0",
    hash: "0x3a91...d82a",
    image: "/img/2.jpg",
    sealColor: "#00c3ff",
  },
  {
    id: 3,
    institution: "Northbridge Demo University",
    name: "Meera Joshi",
    degree: "Ph.D. in Cryptographic Engineering",
    year: 2026,
    cgpa: "4.00 / 4.0",
    hash: "0x7b11...e45f",
    image: "/img/3.jpg",
    sealColor: "#8b5cf6",
  },
  {
    id: 4,
    institution: "Western Demo Institute",
    name: "Kabir Shah",
    degree: "B.Tech in Electrical Engineering",
    year: 2026,
    cgpa: "9.81 / 10",
    hash: "0x12c4...aa90",
    image: "/img/4.jpg",
    sealColor: "#f59e0b",
  },
  {
    id: 5,
    institution: "Cambridge Demo Consortium",
    name: "Neha Kulkarni",
    degree: "M.Phil. in Distributed Systems",
    year: 2025,
    cgpa: "First Class Honors",
    hash: "0x99dd...01bc",
    image: "/img/5.jpg",
    sealColor: "#00d296",
  },
  {
    id: 6,
    institution: "Harbor Demo University",
    name: "Arjun Nair",
    degree: "M.S. in Data Privacy & Governance",
    year: 2026,
    cgpa: "3.98 / 4.0",
    hash: "0x55aa...3341",
    image: "/img/6.jpg",
    sealColor: "#f43f5e",
  },
  {
    id: 7,
    institution: "Oxford Demo Consortium",
    name: "Isha Deshmukh",
    degree: "M.Sc. in Mathematical Foundations",
    year: 2025,
    cgpa: "Distinction",
    hash: "0x44bb...11ee",
    image: "/img/7.jpg",
    sealColor: "#00c3ff",
  },
  {
    id: 8,
    institution: "Caldera Demo Institute",
    name: "Vikramaditya Rao",
    degree: "B.S. in Applied Physics & Cryptography",
    year: 2026,
    cgpa: "3.92 / 4.0",
    hash: "0x66ff...88aa",
    image: "/img/8.jpg",
    sealColor: "#8b5cf6",
  },
];

export default function InteractiveGallery({
  onSelectCard,
}: {
  onSelectCard?: (c: GalleryCard) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const total = CARDS.length;

  const nextCard = () => setActiveIndex((prev) => (prev + 1) % total);
  const prevCard = () => setActiveIndex((prev) => (prev - 1 + total) % total);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const diff = e.clientX - startX.current;
    if (diff < -50) nextCard();
    if (diff > 50) prevCard();
  };

  return (
    <section className="relative w-full py-20 overflow-hidden select-none">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8 text-center">
        <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold block mb-2">
          Anchored Academic Credentials
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Verifiable Institutional Registry
        </h2>
        <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto mt-2">
          Explore tamper-proof degrees anchored on the Ethereum trust registry.
          Click or swipe to inspect credentials.
        </p>

        {/* Carousel Drag Indicator & Controls */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={prevCard}
            className="w-10 h-10 rounded-full bg-[#0d121f] border border-white/10 hover:border-white/30 text-white flex items-center justify-center text-sm transition hover:scale-105 active:scale-95 shadow-md"
            aria-label="Previous credential"
          >
            &larr;
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0d121f] border border-white/10">
            {CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeIndex === i
                    ? "w-6 bg-emerald-400"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Go to credential ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={nextCard}
            className="w-10 h-10 rounded-full bg-[#0d121f] border border-white/10 hover:border-white/30 text-white flex items-center justify-center text-sm transition hover:scale-105 active:scale-95 shadow-md"
            aria-label="Next credential"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* 3D Perspective Stage */}
      <div
        className="relative w-full h-[520px] sm:h-[560px] flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ perspective: "1200px" }}
      >
        <div className="relative w-full max-w-5xl h-full flex items-center justify-center">
          {CARDS.map((card, idx) => {
            // Calculate circular offset distance (-total/2 to +total/2)
            let offset = idx - activeIndex;
            if (offset > total / 2) offset -= total;
            if (offset < -total / 2) offset += total;

            const isCenter = offset === 0;
            const isVisible = Math.abs(offset) <= 2;

            if (!isVisible) return null;

            // Compute 3D coverflow styling
            const translateX = offset * 310;
            const translateZ = isCenter ? 60 : -Math.abs(offset) * 80;
            const rotateY = offset * -18;
            const scale = isCenter ? 1 : 0.88 - Math.abs(offset) * 0.06;
            const opacity = isCenter
              ? 1
              : Math.max(0.2, 0.7 - Math.abs(offset) * 0.25);
            const zIndex = 20 - Math.abs(offset) * 5;

            return (
              <motion.div
                key={card.id}
                onClick={() => {
                  if (isCenter) {
                    onSelectCard?.(card);
                  } else {
                    setActiveIndex(idx);
                  }
                }}
                className="absolute transition-all duration-500 ease-out cursor-pointer"
                style={{
                  transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Certificate Card */}
                <div
                  className={`w-[300px] sm:w-[350px] h-[450px] sm:h-[480px] rounded-3xl overflow-hidden relative border transition-all duration-300 shadow-2xl ${
                    isCenter
                      ? "border-emerald-500/50 shadow-emerald-500/15"
                      : "border-white/10 hover:border-white/20"
                  }`}
                  style={{
                    backgroundColor: "#0c101a",
                  }}
                >
                  {/* Background Certificate Texture */}
                  <img
                    src={card.image}
                    alt={card.institution}
                    className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-all duration-500 ${
                      isCenter
                        ? "filter-none opacity-30 scale-105"
                        : "grayscale opacity-15 scale-100"
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080b12] via-[#080b12]/80 to-transparent pointer-events-none" />

                  {/* Card Content Overlay */}
                  <div className="relative p-6 sm:p-7 h-full flex flex-col justify-between z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block mb-1">
                          Accredited Issuer
                        </span>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight line-clamp-2">
                          {card.institution}
                        </h3>
                      </div>
                      <div
                        className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border shrink-0"
                        style={{
                          borderColor: `${card.sealColor}50`,
                          color: card.sealColor,
                          backgroundColor: `${card.sealColor}12`,
                        }}
                      >
                        Anchored
                      </div>
                    </div>

                    <div className="space-y-1 my-auto py-4">
                      <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
                        Candidate
                      </span>
                      <h4 className="text-2xl font-extrabold text-white">
                        {card.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-neutral-300 font-medium">
                        {card.degree}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-white/10 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400 font-mono">
                          Class of {card.year}
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {card.cgpa}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 pt-1">
                        <span>Fingerprint: {card.hash}</span>
                        <span className="text-emerald-400 font-sans font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Inspect &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

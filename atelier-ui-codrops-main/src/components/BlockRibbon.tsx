'use client';

import React from 'react';
import { BlockData } from '@/lib/api';

interface BlockRibbonProps {
  blocks: BlockData[];
  latestBlock?: number;
}

export default function BlockRibbon({ blocks, latestBlock }: BlockRibbonProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="w-full border-y border-white/10 bg-black/50 backdrop-blur-md overflow-hidden py-2.5 px-4 text-xs font-mono select-none">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        {/* Ribbon Label */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10 shrink-0 text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-white text-[11px] uppercase tracking-wider">EVM LEDGER</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
            #{latestBlock || (blocks[0]?.number ?? 0)}
          </span>
        </div>

        {/* Scrollable Block List */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {blocks.slice(0, 8).map((blk, idx) => {
            const isNew = idx === 0;
            return (
              <div
                key={blk.hash || blk.number}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg shrink-0 border transition-all ${
                  isNew
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : 'bg-white/[0.03] border-white/10 text-gray-300'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">Block #{blk.number}</span>
                    {isNew && (
                      <span className="text-[9px] font-extrabold uppercase bg-emerald-400 text-black px-1.5 rounded">
                        NEW
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                    {blk.hash ? `${blk.hash.slice(0, 10)}…` : '0x...'}
                  </span>
                </div>

                <div className="text-right text-[10px] text-gray-400 pl-2 border-l border-white/10">
                  <div>{blk.txCount || (blk.txs ? blk.txs.length : 0)} txs</div>
                  <div>{Number(blk.gasUsed || 0).toLocaleString()} gas</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use strict';
// Server-Sent Events (SSE) hub and blockchain block tracker for live demo updates.
const { EventEmitter } = require('events');
const { ethers } = require('ethers');
const { REASONS } = require('./verifier');

function createEventHub(ctx) {
  const hub = new EventEmitter();
  const clients = new Set();
  const recentBlocks = [];

  const nameOf = (addr) =>
    Object.values(ctx.actors).find((x) => x.address.toLowerCase() === (addr || '').toLowerCase())?.label;

  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch (_) {
        clients.delete(res);
      }
    }
    hub.emit(event, data);
  }

  async function pushBlockFromReceipt(receipt, meta = {}) {
    try {
      const block = await ctx.provider.getBlock(receipt.blockNumber);
      const timestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);
      const logs = receipt.logs || [];
      const events = [];

      for (const log of logs) {
        try {
          const parsed = ctx.iface.parseLog(log);
          if (!parsed) continue;
          const a = parsed.args;
          let summary = parsed.name;
          let details = {};

          switch (parsed.name) {
            case 'InstitutionRegistered':
              summary = `Institution registered: ${a.name}`;
              details = { id: ethers.decodeBytes32String(a.institutionId), name: a.name, admin: a.admin };
              break;
            case 'IssuerAuthorized':
              summary = `Issuer key authorized for ${ethers.decodeBytes32String(a.institutionId)}`;
              details = { id: ethers.decodeBytes32String(a.institutionId), issuer: a.issuer, issuerLabel: nameOf(a.issuer) };
              break;
            case 'IssuerRemoved':
              summary = `Issuer key removed from ${ethers.decodeBytes32String(a.institutionId)}`;
              details = { id: ethers.decodeBytes32String(a.institutionId), issuer: a.issuer, issuerLabel: nameOf(a.issuer) };
              break;
            case 'InstitutionStatusChanged':
              summary = `${ethers.decodeBytes32String(a.institutionId)} ${a.active ? 'reinstated' : 'suspended'}`;
              details = { id: ethers.decodeBytes32String(a.institutionId), active: a.active };
              break;
            case 'RecordIssued':
              summary = `Record issued by ${ethers.decodeBytes32String(a.institutionId)}`;
              details = { recordHash: a.recordHash, institutionId: ethers.decodeBytes32String(a.institutionId), issuer: a.issuer };
              break;
            case 'RecordRevoked':
              summary = `Record revoked by ${ethers.decodeBytes32String(a.institutionId)} (${REASONS[Number(a.reason)] || 'Unspecified'})`;
              details = { recordHash: a.recordHash, institutionId: ethers.decodeBytes32String(a.institutionId), by: a.by, reason: REASONS[Number(a.reason)] };
              break;
            default:
              break;
          }
          events.push({ name: parsed.name, summary, details });
        } catch (_) { /* ignore unparsed logs */ }
      }

      const primaryEvent = events[0] || { name: meta.method || 'Transaction', summary: meta.method || 'Transaction mined', details: {} };
      const blockItem = {
        blockNumber: Number(receipt.blockNumber),
        txHash: receipt.hash,
        event: primaryEvent.name,
        summary: primaryEvent.summary,
        allEvents: events,
        gasUsed: Number(receipt.gasUsed),
        timestamp,
        from: receipt.from || meta.actorAddress || null,
        actor: meta.actorLabel || (receipt.from ? nameOf(receipt.from) : null),
      };

      recentBlocks.unshift(blockItem);
      if (recentBlocks.length > 30) recentBlocks.pop();

      // Broadcast new block to blockchain ribbon
      broadcast('block', blockItem);

      // Broadcast audit event if any
      for (const ev of events) {
        broadcast('audit', {
          event: ev.name,
          block: Number(receipt.blockNumber),
          time: timestamp,
          txHash: receipt.hash,
          summary: ev.summary,
          subject: ev.details.recordHash || ev.details.id || ev.details.issuer || '',
        });
      }

      return blockItem;
    } catch (e) {
      console.error('Error processing block for SSE:', e);
      return null;
    }
  }

  // Pre-seed recent blocks from initial logs if any
  async function initRecentBlocks() {
    try {
      const logs = await ctx.provider.getLogs({ address: ctx.address, fromBlock: 0, toBlock: 'latest' });
      const blockMap = new Map();
      for (const log of logs) {
        if (!blockMap.has(log.blockNumber)) {
          const blk = await ctx.provider.getBlock(log.blockNumber);
          blockMap.set(log.blockNumber, blk);
        }
        const blk = blockMap.get(log.blockNumber);
        try {
          const parsed = ctx.iface.parseLog(log);
          if (!parsed) continue;
          let summary = parsed.name;
          const a = parsed.args;
          switch (parsed.name) {
            case 'InstitutionRegistered': summary = `Institution registered: ${a.name}`; break;
            case 'IssuerAuthorized': summary = `Issuer key authorized for ${ethers.decodeBytes32String(a.institutionId)}`; break;
            case 'InstitutionStatusChanged': summary = `${ethers.decodeBytes32String(a.institutionId)} ${a.active ? 'reinstated' : 'suspended'}`; break;
            case 'RecordIssued': summary = `Record issued by ${ethers.decodeBytes32String(a.institutionId)}`; break;
            case 'RecordRevoked': summary = `Record revoked by ${ethers.decodeBytes32String(a.institutionId)}`; break;
          }
          recentBlocks.push({
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            event: parsed.name,
            summary,
            gasUsed: 98000,
            timestamp: blk ? blk.timestamp : Math.floor(Date.now() / 1000),
            from: log.address,
            actor: 'System setup',
          });
        } catch (_) {}
      }
      recentBlocks.reverse();
    } catch (_) {}
  }

  function sseHandler(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    // Send initial snapshot
    res.write(`event: init\ndata: ${JSON.stringify({ recentBlocks: recentBlocks.slice(0, 15) })}\n\n`);

    clients.add(res);

    const pingTimer = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (_) {
        clearInterval(pingTimer);
        clients.delete(res);
      }
    }, 15000);
    if (pingTimer.unref) pingTimer.unref();

    req.on('close', () => {
      clearInterval(pingTimer);
      clients.delete(res);
    });
  }

  return {
    hub,
    clients,
    recentBlocks,
    broadcast,
    pushBlockFromReceipt,
    initRecentBlocks,
    sseHandler,
  };
}

module.exports = { createEventHub };

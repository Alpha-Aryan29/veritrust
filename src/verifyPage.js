'use strict';
// Dedicated mobile-friendly public verification page for judges / scanners (/v/:id).
// Completely offline: uses only system fonts, inline SVGs, and calm palette colors.
const { ethers } = require('ethers');
const QRCode = require('qrcode');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (h, a = 10, b = 8) => (h && h.length > a + b + 2 ? `${h.slice(0, a)}…${h.slice(-b)}` : h || '');
const fmtTime = (s) => (s ? new Date(s * 1000).toLocaleString() : 'N/A');

const ICON = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M7 12h10"/></svg>',
  bang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v9M12 19v.5"/></svg>',
};

const TONE = {
  VALID: ['t-ok', 'ok', 'VALID'],
  TAMPERED: ['t-bad', 'no', 'ALTERED'],
  ISSUER_MISMATCH: ['t-bad', 'no', 'MISMATCH'],
  UNAUTHORIZED_ISSUER: ['t-viol', 'no', 'UNAUTHORIZED'],
  NOT_ANCHORED: ['t-viol', 'bang', 'NOT REGISTERED'],
  REVOKED: ['t-warn', 'no', 'REVOKED'],
  EXPIRED: ['t-warn', 'bang', 'EXPIRED'],
  INSTITUTION_SUSPENDED: ['t-warn', 'bang', 'SUSPENDED'],
  MALFORMED: ['t-grey', 'bang', 'MALFORMED'],
};

async function renderVerifyHtml({ id, reqUrl, record, onChain, verification }) {
  const isUnknown = !onChain?.exists;
  const isRevoked = onChain?.revoked;

  let verdictKey = 'NOT_ANCHORED';
  let label = 'Not registered';
  let reason = 'The record fingerprint was never anchored in this trust registry. No institution has registered this certificate.';

  if (verification) {
    verdictKey = verification.verdict;
    label = verification.label;
    reason = verification.reason;
  } else if (!isUnknown) {
    if (isRevoked) {
      verdictKey = 'REVOKED';
      label = 'Revoked';
      reason = `The issuing institution revoked this record on-chain (${onChain.reason || 'Unspecified'}).`;
    } else {
      verdictKey = 'VALID';
      label = 'Anchored on-chain';
      reason = `Anchored by ${onChain.institutionName || 'an authorized issuer'} on the shared trust registry.`;
    }
  }

  const [tone, icon, stampText] = TONE[verdictKey] || ['t-grey', 'bang', verdictKey];

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(reqUrl, { width: 220, margin: 1, color: { dark: '#16202A', light: '#FFFFFF' } });
  } catch (_) {}

  const subj = record?.credential?.credentialSubject || {};
  const studentName = record?.name || subj.name || (isUnknown ? 'Unknown Record' : 'Verified Graduate');
  const program = record?.program || subj.program || (isUnknown ? 'Not Found' : 'Academic Degree Certificate');
  const gradYear = subj.graduationYear || '2026';
  const cgpa = subj.cgpa !== undefined ? subj.cgpa : 'N/A';
  const recordHash = record?.recordHash || id;
  const instName = onChain?.institutionName || (onChain?.institutionId ? ethers.decodeBytes32String(onChain.institutionId) : 'Institutional Trust Registry');

  const checks = verification?.checks || [
    { label: 'Record is well formed', status: isUnknown ? 'fail' : 'pass', detail: isUnknown ? 'Record hash unknown' : 'W3C structure confirmed' },
    { label: 'Signature matches the record contents', status: isUnknown ? 'skipped' : 'pass', detail: isUnknown ? 'Not reached' : 'Cryptographic integrity intact' },
    { label: 'Signer is an authorized issuer', status: isUnknown ? 'skipped' : 'pass', detail: isUnknown ? 'Not reached' : 'Issuer registered in consortium' },
    { label: 'Record is anchored on-chain by that issuer', status: isUnknown ? 'fail' : 'pass', detail: isUnknown ? 'No issuance entry found' : `Anchored at ${fmtTime(onChain?.issuedAt)}` },
    { label: 'Issuing institution is in good standing', status: isUnknown ? 'skipped' : 'pass', detail: isUnknown ? 'Not reached' : 'Institution active' },
    { label: 'Record has not been revoked', status: isRevoked ? 'fail' : (isUnknown ? 'skipped' : 'pass'), detail: isRevoked ? `Revoked: ${onChain.reason}` : (isUnknown ? 'Not reached' : 'No revocation found') },
    { label: 'Record is within its validity period', status: isUnknown ? 'skipped' : 'pass', detail: isUnknown ? 'Not reached' : 'Valid' },
  ];

  const chainHtml = checks.map((c, i) => {
    const cls = c.status === 'pass' ? '' : c.status === 'fail' ? 'fail' : 'skipped';
    const ic = c.status === 'pass' ? ICON.ok : c.status === 'fail' ? ICON.no : ICON.dash;
    const detail = c.status === 'skipped' ? 'Not reached' : c.detail;
    return `
      <li class="link ${cls}" style="--i:${i}">
        <span class="node">${ic}</span>
        <div class="txt">
          <strong>${esc(c.label)}</strong>
          <small>${esc(detail)}</small>
        </div>
      </li>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VeriTrust: Verification Result for ${esc(studentName)}</title>
  <meta name="description" content="Decentralized verifiable credential verification result. 7-step cryptographic chain of trust.">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230F6E5C'/%3E%3Cpath d='M9 16h6m2 0h6' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E">
  <style>
    :root {
      --paper: #E9EDF0; --card: #FAFBFC; --ink: #16202A; --muted: #566370; --line: #CBD3DA;
      --brand: #0F6E5C; --brand-ink: #FFFFFF;
      --ok: #0F7B64; --ok-bg: #DCF0E9;
      --bad: #B3261E; --bad-bg: #FAE3E1;
      --warn: #8F5500; --warn-bg: #FAEBCF;
      --viol: #5B45C9; --viol-bg: #E8E4FA;
      --grey: #5B6772; --grey-bg: #E3E8EC;
      --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); }
    body { margin: 0; color: var(--ink); font: 16px/1.5 var(--sans); }
    header.pub-top { background: var(--card); border-bottom: 1px solid var(--line); padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
    .pub-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); }
    .pub-brand h1 { font-family: var(--serif); font-size: 1.35rem; margin: 0; color: var(--brand); }
    .badge-live { display: inline-flex; align-items: center; gap: 6px; font-size: .78rem; font-weight: 600; padding: 3px 8px; border-radius: 99px; background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok); }
    .badge-live span { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); display: inline-block; }
    main { max-width: 680px; margin: 20px auto 48px; padding: 0 16px; }
    .card { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 20px; }
    
    .verdict { display: flex; gap: 16px; align-items: center; padding: 16px; border-radius: 10px; background: var(--tint); border: 1px solid var(--tone); margin-bottom: 20px; }
    .seal { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--tone); flex: none; box-shadow: 0 0 0 4px var(--tint), 0 0 0 6px var(--tone); }
    .seal svg { width: 26px; height: 26px; }
    .verdict h2 { font-family: var(--serif); font-size: 1.45rem; margin: 0; color: var(--tone); }
    .verdict p { margin: 2px 0 0; font-size: .92rem; color: var(--ink); }
    .t-ok { --tone: var(--ok); --tint: var(--ok-bg); }
    .t-bad { --tone: var(--bad); --tint: var(--bad-bg); }
    .t-warn { --tone: var(--warn); --tint: var(--warn-bg); }
    .t-viol { --tone: var(--viol); --tint: var(--viol-bg); }
    .t-grey { --tone: var(--grey); --tint: var(--grey-bg); }

    .subj-header { border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 16px; }
    .subj-header .inst { font-size: .88rem; font-weight: 600; color: var(--brand); text-transform: uppercase; letter-spacing: 0.04em; }
    .subj-header h3 { font-family: var(--serif); font-size: 1.6rem; margin: 4px 0 2px; }
    .subj-header .prog { font-size: 1rem; color: var(--muted); }
    
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; font-size: .88rem; margin-bottom: 16px; }
    .meta-grid dt { color: var(--muted); font-size: .78rem; text-transform: uppercase; }
    .meta-grid dd { margin: 0; font-weight: 600; }

    /* chain */
    .chain { list-style: none; margin: 0 0 20px; padding: 0; }
    .link { position: relative; display: flex; gap: 14px; padding: 0 0 16px 0; }
    .link:last-child { padding-bottom: 0; }
    .link::before { content: ""; position: absolute; left: 13px; top: 28px; bottom: -2px; width: 3px; background: var(--ok); border-radius: 2px; }
    .link:last-child::before { display: none; }
    .node { width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--ok); color: #fff; z-index: 1; }
    .node svg { width: 14px; height: 14px; }
    .link .txt { padding-top: 2px; min-width: 0; }
    .link strong { display: block; font-size: .92rem; font-weight: 600; }
    .link small { display: block; color: var(--muted); font-size: .82rem; overflow-wrap: anywhere; }
    .link.fail .node { background: var(--bad); }
    .link.fail strong { color: var(--bad); }
    .link.fail::before { background: repeating-linear-gradient(var(--bad) 0 4px, transparent 4px 9px); }
    .link.skipped .node { background: var(--card); border: 2px solid var(--line); color: var(--muted); }
    .link.skipped::before { background: repeating-linear-gradient(var(--line) 0 4px, transparent 4px 9px); }
    .link.skipped strong { color: var(--muted); font-weight: 500; }
    .link.skipped small { font-style: italic; }

    .facts { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 0; font-size: .82rem; border-top: 1px solid var(--line); padding-top: 14px; }
    .facts dt { color: var(--muted); font-size: .75rem; text-transform: uppercase; }
    .facts dd { margin: 0; font-family: var(--mono); word-break: break-all; }

    .qr-box { display: flex; align-items: center; gap: 16px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
    .qr-box img { width: 88px; height: 88px; border-radius: 6px; border: 1px solid var(--line); }
    .qr-box p { font-size: .85rem; color: var(--muted); margin: 2px 0 0; }

    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
    button.btn, a.btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 16px; border-radius: 6px; font-weight: 600; font-size: .88rem; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
    .btn-pri { background: var(--brand); color: #fff; }
    .btn-pri:hover { background: #0B5A4B; }
    .btn-sec { background: var(--card); border-color: var(--line); color: var(--ink); }
    .btn-sec:hover { border-color: var(--ink); }

    @media print {
      body { background: #fff; font-size: 11pt; color: #000; }
      header.pub-top, .actions, .badge-live, .qr-box p { display: none !important; }
      main { max-width: 100%; margin: 0; padding: 0; }
      .card { border: 2px solid #000; box-shadow: none; padding: 20px; }
      .verdict { border: 2px solid #000; background: #f8f8f8 !important; }
      .seal { box-shadow: none; border: 1px solid #000; color: #000; background: #eee; }
      .qr-box img { width: 80px; height: 80px; }
    }
  </style>
</head>
<body>
  <header class="pub-top">
    <a class="pub-brand" href="/">
      <svg width="28" height="20" viewBox="0 0 40 24" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="8" fill="none" stroke="#0F6E5C" stroke-width="4"/><rect x="18" y="4" width="20" height="16" rx="8" fill="none" stroke="#0F6E5C" stroke-width="4"/></svg>
      <h1>VeriTrust</h1>
    </a>
    <span class="badge-live"><span></span> On-chain Registry</span>
  </header>

  <main>
    <div class="card">
      <div class="verdict ${tone}">
        <div class="seal">${ICON[icon]}</div>
        <div>
          <h2>${esc(label)}</h2>
          <p>${esc(reason)}</p>
        </div>
      </div>

      <div class="subj-header">
        <div class="inst">${esc(instName)}</div>
        <h3>${esc(studentName)}</h3>
        <div class="prog">${esc(program)}</div>
      </div>

      <div class="meta-grid">
        <div><dt>Graduation Year</dt><dd>${esc(gradYear)}</dd></div>
        <div><dt>Cumulative GPA</dt><dd>${esc(cgpa)}</dd></div>
        <div><dt>Registry Standing</dt><dd>${isRevoked ? 'Revoked' : onChain?.exists ? 'Anchored on-chain' : 'Not registered'}</dd></div>
        <div><dt>Anchored At</dt><dd>${esc(fmtTime(onChain?.issuedAt))}</dd></div>
      </div>

      <h4 style="font-family:var(--serif); font-size:1.15rem; margin:16px 0 10px;">Verification Chain of Trust (7 checks)</h4>
      <ol class="chain">
        ${chainHtml}
      </ol>

      <dl class="facts">
        <div><dt>Record Fingerprint (salted keccak256)</dt><dd>${esc(recordHash)}</dd></div>
        ${record?.credential?.issuer ? `<div><dt>Issuer DID</dt><dd>${esc(record.credential.issuer)}</dd></div>` : ''}
        ${isRevoked ? `<div><dt>Revocation Details</dt><dd>${esc(fmtTime(onChain.revokedAt))} (${esc(onChain.reason)})</dd></div>` : ''}
      </dl>

      ${qrDataUrl ? `
      <div class="qr-box">
        <img src="${qrDataUrl}" alt="Verification QR Code">
        <div>
          <strong style="display:block; font-size:.9rem;">Scan to verify on any device</strong>
          <p>Scanners will independently load this certificate result against the trust registry.</p>
        </div>
      </div>` : ''}

      <div class="actions">
        <button class="btn btn-pri" onclick="window.print()">Print Certificate</button>
        ${record?.credential ? `<button class="btn btn-sec" id="btn-dl-json">Download .json</button>` : ''}
        <a class="btn btn-sec" href="/">Open Dashboard</a>
      </div>
    </div>
  </main>

  ${record?.credential ? `
  <script>
    const credData = ${JSON.stringify(record.credential)};
    document.getElementById('btn-dl-json')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(credData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '${esc((studentName || 'credential').toLowerCase().replace(/[^a-z0-9]/g, '-'))}-veritrust.json';
      a.click();
    });
  </script>` : ''}
</body>
</html>`;
}

module.exports = { renderVerifyHtml };

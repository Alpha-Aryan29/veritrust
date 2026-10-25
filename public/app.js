'use strict';

/* ---------- state ---------- */
const V = {
  status: null,
  records: [],
  blocks: [],
  currentCred: null,
  currentHash: null,
  currentResult: null,
  baseCred: null,
  batchRecords: [],
  analytics: null,
  explainMode: false,
  sse: null,
  live: false,
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (h, a = 8, b = 6) => (h && h.length > a + b + 2 ? `${h.slice(0, a)}…${h.slice(-b)}` : h || '');
const fmtTime = (s) => (s ? new Date(s * 1000).toLocaleString() : 'N/A');

async function api(path, body) {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3000);
}

const ICON = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M7 12h10"/></svg>',
  bang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v9M12 19v.5"/></svg>',
};

const TONE = {
  VALID: ['t-ok', 'ok', 'stamp-valid'],
  TAMPERED: ['t-bad', 'no', 'stamp-altered'],
  ISSUER_MISMATCH: ['t-bad', 'no', 'stamp-altered'],
  UNAUTHORIZED_ISSUER: ['t-viol', 'no', 'stamp-unauthorized'],
  NOT_ANCHORED: ['t-viol', 'bang', 'stamp-unauthorized'],
  REVOKED: ['t-warn', 'no', 'stamp-revoked'],
  EXPIRED: ['t-warn', 'bang', 'stamp-revoked'],
  INSTITUTION_SUSPENDED: ['t-warn', 'bang', 'stamp-revoked'],
  MALFORMED: ['t-grey', 'bang', 'stamp-malformed'],
};

const ERR_TEXT = {
  NotAuthorizedIssuer: 'This key is not an authorized issuer in the registry.',
  InstitutionInactive: 'The issuing institution is suspended.',
  RecordExists: 'This record is already registered.',
  NotRecordAuthority: 'Only an issuer or admin of the issuing institution can revoke this record.',
  AlreadyRevoked: 'This record is already revoked.',
  RecordUnknown: 'The registry has no such record.',
  NotOwner: 'Only the registry owner can do this.',
  NotInstitutionAdmin: 'Only this institution\'s admin can do this.',
};
const errText = (code) => (ERR_TEXT[code] ? `${ERR_TEXT[code]} (${code})` : code);

/* ---------- tabs ---------- */
const TABS = ['verify', 'issue', 'records', 'network', 'analytics', 'scenarios'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'verify';
  for (const t of TABS) {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`#p-${t}`).hidden = t !== name;
  }
  if (name === 'records') loadRecords();
  if (name === 'network') loadNetwork();
  if (name === 'analytics') loadAnalytics();
  history.replaceState(null, '', `#${name}`);
}
for (const t of TABS) $(`#tab-${t}`).addEventListener('click', () => showTab(t));

/* ---------- status strip with animated counters ---------- */
async function loadStatus() {
  const next = await api('/api/status');
  updateStatusStrip(next);
  V.status = next;
  const sel = $('#i-actor');
  const bSel = $('#b-actor');
  if (sel && !sel.options.length) {
    for (const a of next.actors.filter((x) => x.key !== 'registrar' && /Issuer|issuer|mill/.test(x.label))) {
      sel.add(new Option(a.label, a.key));
    }
  }
  if (bSel && !bSel.options.length) {
    for (const a of next.actors.filter((x) => x.key !== 'registrar' && /Issuer|issuer/.test(x.label))) {
      bSel.add(new Option(a.label, a.key));
    }
  }
}

function updateStatusStrip(next) {
  const prev = V.status;
  const items = [
    { key: 'contract', label: 'Registry contract', val: short(next.contract, 8, 4) },
    { key: 'block', label: 'Block height', val: next.block },
    { key: 'records', label: 'Records anchored', val: next.records },
    { key: 'revocations', label: 'Revocations', val: next.revocations },
  ];

  $('#strip').innerHTML = items.map((it) => {
    const changed = prev && prev[it.key] !== undefined && prev[it.key] !== next[it.key];
    const cls = changed ? 'pulse-num' : '';
    return `<div><dt>${esc(it.label)}</dt><dd class="${cls}">${esc(it.val)}</dd></div>`;
  }).join('');

  // Remove animation class after pulse
  setTimeout(() => {
    $('#strip').querySelectorAll('.pulse-num').forEach((el) => el.classList.remove('pulse-num'));
  }, 600);
}

/* ---------- certificate preview, QR & download ---------- */
function downloadJson(obj, filename = 'credential.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function certHTML(cred, verdict = null, qrDataUrl = null) {
  if (!cred || !cred.credentialSubject) return '';
  const subj = cred.credentialSubject;
  const name = subj.name || 'Unnamed Student';
  const prog = subj.program || 'Degree Certificate';
  const year = subj.graduationYear || '2026';
  const cgpa = subj.cgpa !== undefined ? subj.cgpa : 'N/A';
  const inst = cred.issuer ? short(cred.issuer, 12, 6) : 'Institutional Trust Network';

  let stampHtml = '';
  if (verdict) {
    const [, , stampClass] = TONE[verdict.verdict] || ['t-grey', 'bang', 'stamp-malformed'];
    stampHtml = `<div class="stamp ${stampClass} stamped" aria-label="Verdict stamp: ${esc(verdict.label)}">${esc(verdict.label)}</div>`;
  }

  const hash = V.currentHash;
  const qrSection = qrDataUrl && hash ? `
    <div class="cert-qr-wrap">
      <div>
        <div style="font-size:.78rem; color:var(--muted); text-transform:uppercase; font-weight:600;">Scan to verify on mobile</div>
        <a href="/v/${esc(hash)}" target="_blank" rel="noopener" style="font-size:.82rem; color:var(--brand); text-decoration:underline;">Public link: /v/${esc(short(hash, 6, 4))}</a>
      </div>
      <img src="${qrDataUrl}" alt="Verification QR Code" class="cert-qr-img">
    </div>` : '';

  return `
    <div class="cert-card" aria-label="Credential certificate preview">
      ${stampHtml}
      <div class="cert-head">
        <div>
          <div class="cert-badge">Official Institutional Record</div>
          <div class="cert-inst">${esc(inst)}</div>
        </div>
        <svg width="28" height="28" viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="3" style="color:var(--brand);"><rect x="2" y="4" width="20" height="16" rx="8"/><rect x="18" y="4" width="20" height="16" rx="8"/></svg>
      </div>
      <div class="cert-body">
        <h4>${esc(name)}</h4>
        <div class="cert-prog">${esc(prog)}</div>
      </div>
      <div class="cert-meta">
        <div><span>Graduation Year:</span><strong>${esc(year)}</strong></div>
        <div><span>CGPA:</span><strong>${esc(cgpa)}</strong></div>
        ${cred.expirationDate ? `<div><span>Valid Until:</span><strong>${esc(cred.expirationDate.slice(0, 10))}</strong></div>` : ''}
      </div>
      ${hash ? `<div class="cert-hash" title="On-chain fingerprint">Hash: ${esc(hash)}</div>` : ''}
      ${qrSection}
    </div>`;
}

/* ---------- Explain mode metadata (Tier 2 Item G) ---------- */
const EXPLAIN_MAP = {
  format: {
    why: 'Conforms the record to the W3C Verifiable Credentials Data Model v1.0 standard with an ECDSA cryptographic proof.',
    attack: 'Malformed JSON injection, missing signature fields, or arbitrary unsigned schemas.',
  },
  signature: {
    why: 'Cryptographic ECDSA secp256k1 recovery matches the canonical keccak256 hash against the issuer public key.',
    attack: 'Grade alteration, student name forgery, or payload mutation after the certificate was signed.',
  },
  issuer: {
    why: 'Reads TrustRegistry.sol mappings to verify the signing key is actively accredited by a registered institution.',
    attack: 'Rogue keyholders or impostors fabricating fake credentials in the name of an accredited university.',
  },
  anchor: {
    why: 'Verifies the cryptographic fingerprint was committed on the immutable EVM ledger by the authorized institutional key.',
    attack: 'Off-chain diplomas minted without an on-chain ledger timestamp and registry commitment.',
  },
  institution: {
    why: 'Queries registrar governance state on-chain to ensure the university is in good standing and not suspended.',
    attack: 'Suspended, revoked, or unaccredited institutions continuing to issue valid degrees.',
  },
  status: {
    why: 'Real-time query of contract revocation state; only the issuing institution can revoke on-chain.',
    attack: 'Presentation of withdrawn, superseded, or revoked degrees without calling the university.',
  },
  validity: {
    why: 'Enforces timestamp bounds for time-limited licenses, certifications, and temporary credentials.',
    attack: 'Expired certifications or degrees presented past their authorized expiration date.',
  },
};

const SECURITY_ANALYSIS = {
  TAMPERED: {
    threat: 'Post-Issuance Grade / Payload Alteration',
    layer: 'Layer 2: ECDSA Signature Recovery & Canonical Keccak-256 Hash Integrity',
    contrast: 'Conventional Web2 systems (PDFs, static databases) cannot detect post-issuance edits without an active API query to the issuing university. VeriTrust detects alterations mathematically in milliseconds offline.',
  },
  UNAUTHORIZED_ISSUER: {
    threat: 'Diploma Mill / Impostor University Forgery',
    layer: 'Layer 3: On-Chain Issuer Key Registry Authorization (TrustRegistry.sol)',
    contrast: 'Anyone can generate a valid cryptographic signature using their own private key, but without authorization in the smart contract trust registry, the signature has zero institutional standing.',
  },
  NOT_ANCHORED: {
    threat: 'Uncommitted / Zombie Off-Chain Credential',
    layer: 'Layer 4: Immutable EVM Blockchain Ledger Anchoring',
    contrast: 'Ensures credentials cannot be fabricated in secret without entering the public registry and immutable audit trail.',
  },
  REVOKED: {
    threat: 'Presentation of Revoked / Withdrawn Credential',
    layer: 'Layer 6: Decentralized Smart Contract Revocation State',
    contrast: 'No central database or phone call needed to check revocation; any verifier globally sees the immutable revocation transaction instantly.',
  },
  INSTITUTION_SUSPENDED: {
    threat: 'Operations by Suspended / Unaccredited Institution',
    layer: 'Layer 5: Consortium Governance & Regulatory Enforcement',
    contrast: 'Consortium regulators can suspend rogue universities on-chain, halting verification of all their issued credentials instantly across the network.',
  },
  EXPIRED: {
    threat: 'Presentation of Expired Qualification',
    layer: 'Layer 7: Time-Bound Validity Window Check',
    contrast: 'Guarantees time-limited certifications cannot be passed off as indefinitely valid.',
  },
};

/* ---------- verify panel ---------- */
function renderResult(r) {
  V.currentResult = r;
  if (r.recordHash) V.currentHash = r.recordHash;

  const [tone, icon] = TONE[r.verdict] || ['t-grey', 'bang'];
  const chain = r.checks.map((c, i) => {
    const cls = c.status === 'pass' ? '' : c.status === 'fail' ? 'fail' : 'skipped';
    const ic = c.status === 'pass' ? ICON.ok : c.status === 'fail' ? ICON.no : ICON.dash;
    const detail = c.status === 'skipped' ? 'Not reached' : c.detail;

    let explainHtml = '';
    if (V.explainMode && EXPLAIN_MAP[c.id]) {
      const exp = EXPLAIN_MAP[c.id];
      explainHtml = `
        <div class="explain-note">
          <div><strong>Why this matters:</strong> ${esc(exp.why)}</div>
          <div><strong>Attack stopped:</strong> ${esc(exp.attack)}</div>
        </div>`;
    }

    return `<li class="link ${cls}" style="--i:${i}">
      <span class="node">${ic}</span>
      <div class="txt">
        <strong>${esc(c.label)}</strong>
        <small>${esc(detail)}</small>
        ${explainHtml}
      </div>
    </li>`;
  }).join('');

  let secAnalysisHtml = '';
  if (r.verdict !== 'VALID' && SECURITY_ANALYSIS[r.verdict]) {
    const sa = SECURITY_ANALYSIS[r.verdict];
    secAnalysisHtml = `
      <div class="security-analysis">
        <h4><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg> Security Layer Breach Analysis</h4>
        <dl>
          <dt>Threat Vector</dt>
          <dd>${esc(sa.threat)}</dd>
          <dt>Defensive Layer</dt>
          <dd><strong>${esc(sa.layer)}</strong></dd>
          <dt>Web2 Contrast</dt>
          <dd>${esc(sa.contrast)}</dd>
        </dl>
      </div>`;
  }

  const o = r.onChain;
  const facts = [];
  if (r.recordHash) facts.push(['Record fingerprint', `<dd>${esc(r.recordHash)}</dd>`]);
  if (o && o.institutionName) facts.push(['Issuing institution', `<dd class="plain">${esc(o.institutionName)}</dd>`]);
  if (o && o.issuedAt) facts.push(['Registered on-chain', `<dd class="plain">${esc(fmtTime(o.issuedAt))}</dd>`]);
  if (o && o.revoked) facts.push(['Revoked', `<dd class="plain">${esc(fmtTime(o.revokedAt))}, ${esc(o.reason)}</dd>`]);

  const certBoxHtml = V.currentCred ? certHTML(V.currentCred, r) : '';

  $('#result').className = 'reveal';
  $('#result').innerHTML = `
    ${certBoxHtml}
    ${secAnalysisHtml}
    <div class="verdict ${tone}">
      <div class="seal">${ICON[icon]}</div>
      <div><h3>${esc(r.label)}</h3><p>${esc(r.reason)}</p></div>
    </div>
    <ol class="chain">${chain}</ol>
    ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt>${v}`).join('')}</dl>` : ''}`;
}

async function runVerify() {
  const btn = $('#do-verify');
  btn.disabled = true;
  try {
    const text = $('#cred').value.trim();
    try {
      V.currentCred = JSON.parse(text);
      if (!V.baseCred) V.baseCred = JSON.parse(text);
    } catch (_) {
      V.currentCred = null;
    }
    const res = await api('/api/verify', { credential: text });
    renderResult(res);
    loadStatus();
    if (!$('#p-analytics').hidden) loadAnalytics();
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
}
$('#do-verify').addEventListener('click', runVerify);

const NAMES = ['Asha Patil', 'Rohan Mehta', 'Meera Joshi', 'Kabir Shah', 'Neha Kulkarni', 'Arjun Nair', 'Isha Deshmukh'];
const pick = () => NAMES[Math.floor(Math.random() * NAMES.length)];
async function sample(actor) {
  const r = await api('/api/issue', {
    actor, validDays: 3650,
    subject: { name: pick(), program: 'B.Tech in Computer Engineering', graduationYear: 2026, cgpa: 8.4 },
  });
  return r.credential;
}

function setCred(c) {
  V.currentCred = c;
  V.baseCred = JSON.parse(JSON.stringify(c));
  V.currentHash = null;
  V.currentResult = null;
  $('#cred').value = JSON.stringify(c, null, 2);
  $('#result').className = 'reveal';
  $('#result').innerHTML = `
    ${certHTML(c, null)}
    <div class="empty"><p>Record loaded into preview. Click <b>Verify record</b> to test against the on-chain registry.</p></div>`;
  if (typeof syncTamperFromCred === 'function') syncTamperFromCred();
}

$('#ld-valid').addEventListener('click', async () => { setCred(await sample('sitRegistry')); loadStatus(); });
$('#ld-alter').addEventListener('click', async () => {
  const c = await sample('sitRegistry');
  c.credentialSubject.cgpa = 9.9;
  setCred(c); toast('CGPA changed from 8.4 to 9.9 after signing');
  loadStatus();
});
/* ---------- file-based verify (Phase 5) ---------- */
function initDropZone() {
  const zone = $('#drop-zone');
  const fileInput = $('#file-input');
  const errBox = $('#drop-err');
  if (!zone || !fileInput) return;

  function showDropErr(msg) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
  function clearDropErr() {
    errBox.textContent = '';
    errBox.hidden = true;
  }

  function handleFile(file) {
    clearDropErr();
    if (!file) return;

    if (!file.name.endsWith('.json') && file.type && !file.type.includes('json')) {
      showDropErr('Invalid file type: please select a .json credential file.');
      return;
    }
    if (file.size > 512 * 1024) {
      showDropErr('File exceeds the 512 KB size limit. Please provide a standard credential JSON.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        let data;
        try {
          data = JSON.parse(text);
        } catch (_) {
          showDropErr('The selected file is not valid JSON. Please check formatting.');
          return;
        }

        if (!data || typeof data !== 'object') {
          showDropErr('Credential file must contain a JSON object.');
          return;
        }
        if (!data.issuer || !data.credentialSubject || !data.proof) {
          showDropErr('Missing required W3C credential fields (issuer, credentialSubject, or proof).');
          return;
        }

        setCred(data);
        toast(`Loaded ${file.name}`);
        clearDropErr();
        await runVerify();
      } catch (err) {
        showDropErr(`Could not read file: ${err.message}`);
      }
    };
    reader.onerror = () => showDropErr('Error reading file from disk.');
    reader.readAsText(file);
  }

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
    fileInput.value = '';
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
}

/* ---------- issue ---------- */
$('#issue-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = ev.submitter || $('#issue-form button[type=submit]'); btn.disabled = true;
  try {
    const r = await api('/api/issue', {
      actor: $('#i-actor').value,
      validDays: $('#i-days').value === '' ? null : Number($('#i-days').value),
      subject: { name: $('#i-name').value, program: $('#i-program').value, graduationYear: $('#i-year').value, cgpa: $('#i-cgpa').value },
    });
    const ok = r.anchored;
    V.currentHash = r.recordHash;
    V.currentCred = r.credential;

    let qrDataUrl = '';
    if (ok) {
      try {
        const qrUrl = `${location.origin}/v/${r.recordHash}`;
        const qRes = await api(`/api/qr?text=${encodeURIComponent(qrUrl)}`);
        qrDataUrl = qRes.dataUrl;
      } catch (_) {}
    }

    $('#issue-out').className = '';
    $('#issue-out').innerHTML = `
      <div class="msg ${ok ? 't-ok' : 't-viol'}"><b>${ok ? 'Registered on-chain' : 'Registry rejected this issuance'}</b>
        ${ok ? `Issued by ${esc(r.issuedBy)}. Gas used: ${r.tx.gasUsed.toLocaleString()}. Transaction ${esc(short(r.tx.txHash, 10, 8))}.`
             : `${esc(errText(r.tx.error))} The signed record still exists off-chain. Send it to Verify to see how it is caught.`}</div>
      ${ok && qrDataUrl ? `
      <div class="cert-qr-wrap" style="background:#fff; padding:12px 14px; border-radius:8px; border:1px solid var(--line); margin-bottom:12px;">
        <div>
          <strong style="display:block; font-size:.92rem; color:var(--ink);">Certificate QR Code</strong>
          <span style="font-size:.82rem; color:var(--muted);">Scan with any phone camera on this network to verify live</span>
          <div style="margin-top:6px;"><a href="/v/${esc(r.recordHash)}" target="_blank" rel="noopener" style="font-size:.84rem; color:var(--brand); text-decoration:underline; font-weight:600;">Open mobile verification page (/v/${esc(short(r.recordHash, 6, 4))})</a></div>
        </div>
        <img src="${qrDataUrl}" alt="QR code" class="cert-qr-img" style="width:80px; height:80px;">
      </div>` : ''}
      <dl class="facts"><dt>Record fingerprint</dt><dd>${esc(r.recordHash)}</dd></dl>
      <div class="row">
        <button class="ghost" id="to-verify">Send to Verify</button>
        <button class="ghost" id="to-cert">View certificate</button>
        <button class="ghost" id="dl-cred">Download .json</button>
        <button class="ghost" id="copy-cred">Copy record</button>
      </div>
      <pre class="code">${esc(JSON.stringify(r.credential, null, 2))}</pre>`;

    $('#to-verify').addEventListener('click', () => { setCred(r.credential); showTab('verify'); runVerify(); });
    $('#to-cert')?.addEventListener('click', () => openCertModal({ name: $('#i-name').value, credential: r.credential, recordHash: r.recordHash, issuedBy: r.issuedBy, anchored: ok, revoked: false }));
    $('#dl-cred')?.addEventListener('click', () => downloadJson(r.credential, `${$('#i-name').value.toLowerCase().replace(/[^a-z0-9]/g, '-')}-veritrust.json`));
    $('#copy-cred').addEventListener('click', () => navigator.clipboard.writeText(JSON.stringify(r.credential, null, 2)).then(() => toast('Record copied')));
    loadStatus();
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
});

/* ---------- records & live revocation ---------- */
const REASONS = ['Unspecified', 'Issued in error', 'Fraud or misconduct', 'Degree withdrawn', 'Superseded by a new record'];
async function loadRecords() {
  const rows = await api('/api/records');
  V.records = rows;
  const box = $('#records');
  if (!rows.length) { box.className = 'empty'; box.innerHTML = '<p>Nothing issued yet. Use the Issue tab.</p>'; return; }
  box.className = '';
  const actorOpts = V.status ? V.status.actors.filter((a) => a.key !== 'registrar').map((a) => `<option value="${a.key}">${esc(a.label)}</option>`).join('') : '';

  box.innerHTML = `<div class="scroll"><table><thead><tr><th>Record</th><th>Issued by</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((r, i) => {
    const [cls, label] = !r.anchored ? ['t-viol', 'Never registered'] : r.revoked ? ['t-warn', `Revoked: ${r.reason}`] : ['t-ok', 'Active'];
    return `<tr data-i="${i}" data-hash="${esc(r.recordHash)}">
      <td><b>${esc(r.name)}</b><br><span class="hash" title="${esc(r.recordHash)}">${esc(short(r.recordHash, 10, 8))}</span></td>
      <td>${esc(r.issuedBy)}</td>
      <td class="status-cell"><span class="badge ${cls}">${esc(label)}</span></td>
      <td class="action-cell">
        <button class="small ct">Certificate</button>
        <button class="small vf">Verify</button>
        ${r.anchored && !r.revoked ? `<button class="small rv">Revoke…</button>` : ''}
        <div class="rev-box" hidden>
          <select class="who" aria-label="Revoke as">${actorOpts}</select>
          <select class="why" aria-label="Reason">${REASONS.map((x, k) => `<option value="${k}">${x}</option>`).join('')}</select>
          <button class="small go">Confirm</button>
        </div><div class="note hint"></div></td></tr>`;
  }).join('')}</tbody></table></div>`;

  box.querySelectorAll('tr[data-i]').forEach((tr) => {
    const r = rows[Number(tr.dataset.i)];
    const rb = $('.rev-box', tr);
    if ($('.who', tr)) $('.who', tr).value = r.actor;
    $('.ct', tr)?.addEventListener('click', () => openCertModal(r));
    $('.rv', tr)?.addEventListener('click', () => { rb.hidden = !rb.hidden; });
    $('.vf', tr).addEventListener('click', () => { setCred(r.credential); showTab('verify'); runVerify(); });
    $('.go', tr)?.addEventListener('click', async () => {
      const out = await api('/api/revoke', { actor: $('.who', tr).value, recordHash: r.recordHash, reason: Number($('.why', tr).value) });
      if (out.revoked) {
        toast('Record revoked on-chain');
        loadStatus();
        loadRecords();
      } else {
        $('.note', tr).textContent = `Rejected by the contract: ${errText(out.tx.error)}`;
      }
    });
  });
}

/* Certificate inspection modal (Phase 4) */
async function openCertModal(record) {
  const modal = $('#cert-modal');
  $('#cm-title').textContent = `${record.name || 'Student'} - Credential Certificate`;
  const qrUrl = `${location.origin}/v/${record.recordHash}`;
  let qrDataUrl = '';
  try {
    const res = await api(`/api/qr?text=${encodeURIComponent(qrUrl)}`);
    qrDataUrl = res.dataUrl;
  } catch (_) {}

  const verdict = {
    verdict: record.revoked ? 'REVOKED' : record.anchored ? 'VALID' : 'NOT_ANCHORED',
    label: record.revoked ? `Revoked: ${record.reason}` : record.anchored ? 'Valid' : 'Not registered',
  };

  $('#cm-body').innerHTML = `
    ${certHTML(record.credential, verdict, qrDataUrl)}
    <div style="font-size:.84rem; color:var(--muted); margin-top:8px;">
      Issued by <b>${esc(record.issuedBy)}</b> &bull; Status: <b>${record.revoked ? 'Revoked' : record.anchored ? 'Active' : 'Unregistered'}</b>
    </div>`;

  $('#cm-dl').onclick = () => downloadJson(record.credential, `${(record.name || 'credential').toLowerCase().replace(/[^a-z0-9]/g, '-')}-veritrust.json`);
  $('#cm-print').onclick = () => window.print();
  $('#cm-open').href = `/v/${record.recordHash}`;

  modal.showModal();
}

$('#cm-close')?.addEventListener('click', () => $('#cert-modal').close());
$('#cert-modal')?.addEventListener('click', (e) => {
  if (e.target === $('#cert-modal')) $('#cert-modal').close();
});

/* Handle live revocation broadcast across windows */
function handleLiveRevocation(ev) {
  // 1. Update Records table row if present
  const tr = $(`tr[data-hash="${ev.recordHash}"]`);
  if (tr) {
    const statusCell = $('.status-cell', tr);
    if (statusCell) {
      statusCell.innerHTML = `<span class="badge t-warn">Revoked: ${esc(ev.reason)}</span>`;
    }
    const rvBtn = $('.rv', tr);
    if (rvBtn) rvBtn.remove();
    const revBox = $('.rev-box', tr);
    if (revBox) revBox.remove();
    tr.classList.add('flash-revoked');
    setTimeout(() => tr.classList.remove('flash-revoked'), 2000);
  }

  // 2. If Verify panel is showing this exact record, live flip to Revoked!
  if (V.currentHash && V.currentHash.toLowerCase() === ev.recordHash.toLowerCase()) {
    toast(`Active record was revoked on-chain (${ev.reason})`);
    runVerify();
  }
}

/* Handle live record issued broadcast across windows */
function handleLiveRecordIssued(ev) {
  loadStatus();
  if (!$('#p-records').hidden) {
    loadRecords();
  }
}

/* ---------- blockchain ribbon (Phase 2) ---------- */
function renderRibbon(blocks) {
  V.blocks = blocks || [];
  const track = $('#ribbon-track');
  if (!track) return;
  track.innerHTML = V.blocks.slice(0, 10).map((b) => createBlockChipHtml(b)).join('');
  attachBlockChipListeners();
}

function createBlockChipHtml(b, isNew = false) {
  const eventCls = b.event === 'RecordIssued' ? 't-ok' : b.event === 'RecordRevoked' ? 't-warn' : 't-viol';
  return `
    <button class="block-chip ${isNew ? 'slide-in' : ''}" data-hash="${esc(b.txHash)}" aria-label="Block ${b.blockNumber}: ${esc(b.event)}">
      <span class="chip-num">#${b.blockNumber}</span>
      <span class="chip-event badge ${eventCls}">${esc(b.event || 'Mined')}</span>
      <span class="chip-tx">${esc(short(b.txHash, 6, 4))}</span>
    </button>`;
}

function addBlockToRibbon(b) {
  V.blocks.unshift(b);
  if (V.blocks.length > 25) V.blocks.pop();
  const track = $('#ribbon-track');
  if (!track) return;
  track.insertAdjacentHTML('afterbegin', createBlockChipHtml(b, true));
  attachBlockChipListeners();
}

function attachBlockChipListeners() {
  $('#ribbon-track').querySelectorAll('.block-chip').forEach((btn) => {
    btn.onclick = () => {
      const txHash = btn.dataset.hash;
      const blk = V.blocks.find((x) => x.txHash === txHash);
      if (blk) showBlockModal(blk);
    };
  });
}

function showBlockModal(b) {
  const modal = $('#block-modal');
  $('#bm-title').textContent = `Block #${b.blockNumber} Details`;
  $('#bm-body').innerHTML = `
    <dl>
      <dt>Block Number</dt><dd><b>#${b.blockNumber}</b></dd>
      <dt>Event Type</dt><dd><span class="badge ${b.event === 'RecordIssued' ? 't-ok' : b.event === 'RecordRevoked' ? 't-warn' : 't-viol'}">${esc(b.event)}</span></dd>
      <dt>Summary</dt><dd class="plain">${esc(b.summary || 'Transaction confirmed on ledger')}</dd>
      <dt>Transaction Hash</dt><dd>${esc(b.txHash)}</dd>
      <dt>Gas Used</dt><dd>${(b.gasUsed || 0).toLocaleString()} gas</dd>
      <dt>Mined At</dt><dd>${esc(fmtTime(b.timestamp))}</dd>
      ${b.actor ? `<dt>Actor / Signer</dt><dd class="plain">${esc(b.actor)}</dd>` : ''}
    </dl>`;
  modal.showModal();
}

$('#bm-close')?.addEventListener('click', () => $('#block-modal').close());
$('#bm-ok')?.addEventListener('click', () => $('#block-modal').close());
$('#block-modal')?.addEventListener('click', (e) => {
  if (e.target === $('#block-modal')) $('#block-modal').close();
});

/* ---------- network & trust graph (Phase 1) ---------- */
function drawTrustGraph(institutions) {
  const svg = $('#trust-graph');
  if (!svg || !institutions || !institutions.length) return;

  const sit = institutions.find((x) => x.id === 'SIT') || { active: true, name: 'SIT' };
  const ksu = institutions.find((x) => x.id === 'KSU') || { active: true, name: 'KSU' };

  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#0F6E5C" />
      </marker>
    </defs>

    <!-- Connector lines -->
    <!-- Registrar to SIT -->
    <path d="M 380 40 L 220 95" class="edge-line ${sit.active ? 'active' : 'suspended'}" />
    <!-- Registrar to KSU -->
    <path d="M 380 40 L 540 95" class="edge-line ${ksu.active ? 'active' : 'suspended'}" />

    <!-- SIT to issuers -->
    <path d="M 220 135 L 130 185" class="edge-line ${sit.active ? 'active' : 'suspended'}" />
    <path d="M 220 135 L 290 185" class="edge-line ${sit.active ? 'active' : 'suspended'}" />

    <!-- KSU to issuers -->
    <path d="M 540 135 L 540 185" class="edge-line ${ksu.active ? 'active' : 'suspended'}" />

    <!-- Root: Consortium Registrar -->
    <g transform="translate(280, 10)">
      <rect width="200" height="34" class="node-box active" />
      <text x="100" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="#0F6E5C">Trust Registrar (Consortium)</text>
    </g>

    <!-- Institution 1: SIT -->
    <g transform="translate(110, 95)">
      <rect width="220" height="38" class="node-box ${sit.active ? 'active' : 'suspended'}" />
      <text x="110" y="20" text-anchor="middle" font-size="12" font-weight="600" fill="#16202A">Sahyadri Institute (SIT)</text>
      <text x="110" y="32" text-anchor="middle" font-size="10" fill="${sit.active ? '#0F7B64' : '#8F5500'}">${sit.active ? 'Active in consortium' : 'Suspended by registrar'}</text>
    </g>

    <!-- Institution 2: KSU -->
    <g transform="translate(430, 95)">
      <rect width="220" height="38" class="node-box ${ksu.active ? 'active' : 'suspended'}" />
      <text x="110" y="20" text-anchor="middle" font-size="12" font-weight="600" fill="#16202A">Konkan State Univ (KSU)</text>
      <text x="110" y="32" text-anchor="middle" font-size="10" fill="${ksu.active ? '#0F7B64' : '#8F5500'}">${ksu.active ? 'Active in consortium' : 'Suspended by registrar'}</text>
    </g>

    <!-- SIT Issuers -->
    <g transform="translate(50, 185)">
      <rect width="150" height="28" class="node-box" />
      <text x="75" y="18" text-anchor="middle" font-size="10" fill="#566370">SIT Registrar Key</text>
    </g>
    <g transform="translate(220, 185)">
      <rect width="140" height="28" class="node-box" />
      <text x="70" y="18" text-anchor="middle" font-size="10" fill="#566370">SIT Exam Cell Key</text>
    </g>

    <!-- KSU Issuer -->
    <g transform="translate(465, 185)">
      <rect width="150" height="28" class="node-box" />
      <text x="75" y="18" text-anchor="middle" font-size="10" fill="#566370">KSU Registrar Key</text>
    </g>`;
}

async function loadNetwork() {
  await loadStatus();
  drawTrustGraph(V.status.institutions);

  $('#institutions').innerHTML = V.status.institutions.map((i) => `
    <div class="inst ${i.active ? 't-ok' : 't-warn'}">
      <div>
        <h3>${esc(i.name)} <span class="badge ${i.active ? 't-ok' : 't-warn'}">${i.active ? 'In good standing' : 'Suspended'}</span></h3>
        <div class="addr">Admin key ${esc(i.admin)}</div>
        <ul>${i.issuers.map((s) => `<li>${esc(s.label)}<span class="addr"> ${esc(short(s.address, 8, 6))}</span></li>`).join('')}</ul>
      </div>
      <div><button class="small" data-id="${esc(i.id)}" data-active="${i.active}">${i.active ? 'Suspend (registrar)' : 'Reinstate (registrar)'}</button></div>
    </div>`).join('');

  $('#institutions').querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', async () => {
    await api('/api/institution/status', { id: b.dataset.id, active: b.dataset.active !== 'true' });
    toast('Registrar updated the institution standing');
    loadNetwork();
  }));

  const log = await api('/api/audit');
  $('#audit tbody').innerHTML = log.map((e) => `
    <tr>
      <td>${e.block}</td>
      <td>${esc(fmtTime(e.time))}</td>
      <td>${esc(e.summary)}</td>
      <td class="hash">${esc(short(e.subject, 12, 6))}</td>
      <td class="hash">${esc(short(e.txHash, 10, 6))}</td>
    </tr>`).join('');
}

/* ---------- scenarios ---------- */
$('#run-scn').addEventListener('click', async (ev) => {
  const b = ev.currentTarget; b.disabled = true; b.textContent = 'Running…';
  try {
    const r = await api('/api/scenarios/run', {});
    const out = $('#scn-out'); out.className = '';
    out.innerHTML = `<p class="sum">${r.passed} of ${r.total} scenarios behaved as required</p>
      <div class="scroll"><table><thead><tr><th>Result</th><th>Scenario</th><th>Expected</th><th>Observed</th></tr></thead><tbody>${r.results.map((x) => `
        <tr><td><span class="badge ${x.pass ? 't-ok' : 't-bad'}">${x.pass ? 'Pass' : 'Fail'}</span></td>
        <td><b>${esc(x.title)}</b>${x.mandatory ? ' <span class="badge t-grey">Required</span>' : ''}<details><summary>What happened</summary><p>${esc(x.detail)}</p></details></td>
        <td>${esc(x.expected)}</td><td>${esc(x.actual)}</td></tr>`).join('')}</tbody></table></div>`;
    loadStatus();
  } catch (e) { toast(e.message); } finally { b.disabled = false; b.textContent = 'Run all scenarios'; }
});

/* ---------- SSE real-time stream (Phase 1) ---------- */
function initSSE() {
  if (V.sse) V.sse.close();

  const ind = $('#live-indicator');
  const txt = $('#live-text');

  try {
    const sse = new EventSource('/api/events');
    V.sse = sse;

    sse.onopen = () => {
      V.live = true;
      ind.classList.remove('off');
      txt.textContent = 'Live';
    };

    sse.addEventListener('init', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.recentBlocks) renderRibbon(d.recentBlocks);
      } catch (_) {}
    });

    sse.addEventListener('block', (e) => {
      try {
        const blockItem = JSON.parse(e.data);
        addBlockToRibbon(blockItem);
        loadStatus();
      } catch (_) {}
    });

    sse.addEventListener('record_issued', (e) => {
      try {
        const data = JSON.parse(e.data);
        handleLiveRecordIssued(data);
        if (!$('#p-analytics').hidden) loadAnalytics();
      } catch (_) {}
    });

    sse.addEventListener('batch_issued', (e) => {
      try {
        loadStatus();
        if (!$('#p-analytics').hidden) loadAnalytics();
        if (!$('#p-records').hidden) loadRecords();
      } catch (_) {}
    });

    sse.addEventListener('verification', () => {
      if (!$('#p-analytics').hidden) loadAnalytics();
    });

    sse.addEventListener('record_revoked', (e) => {
      try {
        const data = JSON.parse(e.data);
        handleLiveRevocation(data);
        if (!$('#p-analytics').hidden) loadAnalytics();
      } catch (_) {}
    });

    sse.addEventListener('institution_status', () => {
      loadStatus();
      if (!$('#p-network').hidden) loadNetwork();
      if (!$('#p-analytics').hidden) loadAnalytics();
    });

    sse.addEventListener('audit', (e) => {
      try {
        const ev = JSON.parse(e.data);
        const tbody = $('#audit tbody');
        if (tbody) {
          const rowHtml = `
            <tr class="flash-new">
              <td>${ev.block}</td>
              <td>${esc(fmtTime(ev.time))}</td>
              <td>${esc(ev.summary)}</td>
              <td class="hash">${esc(short(ev.subject, 12, 6))}</td>
              <td class="hash">${esc(short(ev.txHash, 10, 6))}</td>
            </tr>`;
          tbody.insertAdjacentHTML('afterbegin', rowHtml);
          setTimeout(() => {
            const tr = tbody.querySelector('.flash-new');
            if (tr) tr.classList.remove('flash-new');
          }, 1800);
        }
      } catch (_) {}
    });

    sse.addEventListener('status', (e) => {
      try {
        const snap = JSON.parse(e.data);
        updateStatusStrip(snap);
        V.status = snap;
      } catch (_) {}
    });

    sse.onerror = () => {
      V.live = false;
      ind.classList.add('off');
      txt.textContent = 'Reconnecting…';
    };
  } catch (_) {
    ind.classList.add('off');
    txt.textContent = 'Disconnected';
  }
}

/* ---------- guided demo mode (Phase 3) ---------- */
V.demo = {
  active: false,
  step: 0,
  autoplay: false,
  timer: null,
  progressTimer: null,
  progress: 0,
};

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Valid Record Accepted',
    desc: 'Sahyadri Institute issues a credential; a verifier checks the 7 cryptographic links using only the shared registry.',
    run: async () => {
      showTab('verify');
      const c = await sample('sitRegistry');
      setCred(c);
      await runVerify();
    },
  },
  {
    step: 2,
    title: 'Altered Record Detected',
    desc: 'When an attacker modifies the CGPA from 8.4 to 9.9, the fingerprint changes and breaks the chain at the signature check.',
    run: async () => {
      showTab('verify');
      const c = await sample('sitRegistry');
      c.credentialSubject.cgpa = 9.9;
      setCred(c);
      await runVerify();
    },
  },
  {
    step: 3,
    title: 'Unauthorized Issuer Rejected',
    desc: 'An unregistered degree mill signs a forged diploma; the smart contract rejects issuance on-chain, and its self-signed record fails verification.',
    run: async () => {
      showTab('issue');
      $('#i-actor').value = 'rogue';
      $('#i-name').value = 'Forged Graduate';
      $('#i-program').value = 'MBA in Management';
      const r = await api('/api/issue', {
        actor: 'rogue',
        subject: { name: 'Forged Graduate', program: 'MBA in Management' },
      });
      $('#issue-out').className = '';
      $('#issue-out').innerHTML = `
        <div class="msg t-viol"><b>Registry rejected this issuance</b>
          ${esc(errText(r.tx.error))} The signed record still exists off-chain. Sending to Verify...</div>
        <dl class="facts"><dt>Record fingerprint</dt><dd>${esc(r.recordHash)}</dd></dl>`;
      await new Promise((res) => setTimeout(res, 1200));
      setCred(r.credential);
      showTab('verify');
      await runVerify();
    },
  },
  {
    step: 4,
    title: 'Unauthorized Revocation Rejected',
    desc: 'Konkan State University attempts to revoke SIT\'s record; the smart contract strictly enforces role authority and reverts NotRecordAuthority.',
    run: async () => {
      showTab('records');
      const good = await api('/api/issue', { actor: 'sitRegistry', subject: { name: 'Rohan Mehta', program: 'B.Tech CE' } });
      V.demoRecord = good;
      await loadRecords();
      const tr = $(`tr[data-hash="${good.recordHash}"]`);
      if (tr) {
        const rb = $('.rev-box', tr);
        if (rb) {
          rb.hidden = false;
          const who = $('.who', tr);
          if (who) who.value = 'ksuRegistry';
        }
      }
      const out = await api('/api/revoke', { actor: 'ksuRegistry', recordHash: good.recordHash, reason: 2 });
      if (tr) {
        $('.note', tr).textContent = `Rejected by the contract: ${errText(out.tx.error)}`;
      }
      toast(`Unauthorized revocation blocked: ${out.tx.error}`);
    },
  },
  {
    step: 5,
    title: 'Revoked Record Detected Live',
    desc: 'When the authentic SIT issuer revokes the certificate, the revocation anchors on-chain and verifiers immediately detect it.',
    run: async () => {
      showTab('records');
      let recHash = V.demoRecord?.recordHash;
      let cred = V.demoRecord?.credential;
      if (!recHash) {
        const fresh = await api('/api/issue', { actor: 'sitRegistry', subject: { name: 'Meera Joshi', program: 'B.Tech IT' } });
        recHash = fresh.recordHash;
        cred = fresh.credential;
      }
      await api('/api/revoke', { actor: 'sitRegistry', recordHash: recHash, reason: 3 });
      await loadRecords();
      toast('Record revoked by issuing institution');
      await new Promise((res) => setTimeout(res, 800));
      setCred(cred);
      showTab('verify');
      await runVerify();
    },
  },
];

function startDemo() {
  V.demo.active = true;
  V.demo.step = 0;
  const guide = $('#demo-guide');
  guide.hidden = false;

  // Render dots
  const dots = $('#dg-dots');
  dots.innerHTML = DEMO_STEPS.map((_, i) => `<button class="dg-dot" data-step="${i}" aria-label="Go to step ${i + 1}"></button>`).join('');
  dots.querySelectorAll('.dg-dot').forEach((d) => {
    d.onclick = () => loadDemoStep(Number(d.dataset.step));
  });

  loadDemoStep(0);
}

function stopDemo() {
  V.demo.active = false;
  clearTimeout(V.demo.timer);
  clearInterval(V.demo.progressTimer);
  $('#demo-guide').hidden = true;
  if (V.demo.autoplay) toggleAutoPlay();
}

async function loadDemoStep(idx) {
  if (idx < 0 || idx >= DEMO_STEPS.length) return;
  V.demo.step = idx;
  const s = DEMO_STEPS[idx];

  $('#dg-step-num').textContent = `Step ${idx + 1} of 5`;
  $('#dg-title').textContent = s.title;
  $('#dg-desc').textContent = s.desc;
  $('#dg-prev').disabled = idx === 0;
  $('#dg-next').textContent = idx === DEMO_STEPS.length - 1 ? 'Finish' : 'Next';

  $('#dg-dots').querySelectorAll('.dg-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });

  // Run the real action
  clearTimeout(V.demo.timer);
  clearInterval(V.demo.progressTimer);
  $('#dg-progress').style.width = '0%';

  try {
    await s.run();
  } catch (err) {
    console.error('Demo step error:', err);
  }

  // If autoplay is active, schedule next step after 6.5s with smooth progress bar
  if (V.demo.autoplay) {
    const totalMs = 6500;
    const interval = 50;
    let elapsed = 0;
    V.demo.progressTimer = setInterval(() => {
      elapsed += interval;
      const pct = Math.min(100, (elapsed / totalMs) * 100);
      $('#dg-progress').style.width = `${pct}%`;
      if (elapsed >= totalMs) {
        clearInterval(V.demo.progressTimer);
        if (V.demo.step < DEMO_STEPS.length - 1) {
          loadDemoStep(V.demo.step + 1);
        } else {
          stopDemo();
          toast('Demo walkthrough completed');
        }
      }
    }, interval);
  }
}

function toggleAutoPlay() {
  V.demo.autoplay = !V.demo.autoplay;
  const btn = $('#dg-autoplay-btn');
  $('.icon-play', btn).hidden = V.demo.autoplay;
  $('.icon-pause', btn).hidden = !V.demo.autoplay;
  btn.classList.toggle('active', V.demo.autoplay);

  if (V.demo.autoplay) {
    toast('Auto-play started (6s per step)');
    loadDemoStep(V.demo.step);
  } else {
    clearTimeout(V.demo.timer);
    clearInterval(V.demo.progressTimer);
    $('#dg-progress').style.width = '0%';
    toast('Auto-play paused');
  }
}

$('#btn-play-demo')?.addEventListener('click', startDemo);
$('#dg-close-btn')?.addEventListener('click', stopDemo);
$('#dg-autoplay-btn')?.addEventListener('click', toggleAutoPlay);
$('#dg-prev')?.addEventListener('click', () => {
  if (V.demo.step > 0) loadDemoStep(V.demo.step - 1);
});
$('#dg-next')?.addEventListener('click', () => {
  if (V.demo.step < DEMO_STEPS.length - 1) {
    loadDemoStep(V.demo.step + 1);
  } else {
    stopDemo();
    toast('Demo walkthrough finished');
  }
});

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (!V.demo.active) return;
  if (e.key === 'Escape') {
    stopDemo();
  } else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
    if (V.demo.step < DEMO_STEPS.length - 1) loadDemoStep(V.demo.step + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
    if (V.demo.step > 0) loadDemoStep(V.demo.step - 1);
  } else if (e.key === ' ') {
    e.preventDefault();
    toggleAutoPlay();
  }
});

/* ---------- Tamper Lab (Tier 2 Item F) ---------- */
let tamperDebounce = null;
function syncTamperFromCred() {
  if (!V.currentCred || !V.currentCred.credentialSubject) return;
  const s = V.currentCred.credentialSubject;
  const nameInput = $('#tl-name');
  const progInput = $('#tl-program');
  const yearInput = $('#tl-year');
  const cgpaInput = $('#tl-cgpa');
  const cgpaRange = $('#tl-cgpa-range');
  const cgpaVal = $('#tl-cgpa-val');

  if (nameInput) nameInput.value = s.name || '';
  if (progInput) progInput.value = s.program || '';
  if (yearInput) yearInput.value = s.graduationYear || 2026;
  const cgpa = Number(s.cgpa) || 8.4;
  if (cgpaInput) cgpaInput.value = cgpa.toFixed(2);
  if (cgpaRange) cgpaRange.value = cgpa;
  if (cgpaVal) cgpaVal.textContent = cgpa.toFixed(2);

  const origHashEl = $('#tl-orig-hash');
  if (origHashEl) origHashEl.textContent = V.currentHash ? short(V.currentHash, 14, 12) : '0x…';
  const mutHashEl = $('#tl-mut-hash');
  if (mutHashEl) mutHashEl.textContent = '—';
  const badge = $('#tl-avalanche-badge');
  if (badge) {
    badge.textContent = 'Original Hash (0 bits changed)';
    badge.className = 'avalanche-badge';
  }
}

function initTamperLab() {
  const box = $('#tamper-box');
  const toggleBtn = $('#btn-toggle-tamper');
  const closeBtn = $('#btn-close-tamper');
  const nameInput = $('#tl-name');
  const progInput = $('#tl-program');
  const yearInput = $('#tl-year');
  const cgpaInput = $('#tl-cgpa');
  const cgpaRange = $('#tl-cgpa-range');
  const cgpaVal = $('#tl-cgpa-val');
  const revertBtn = $('#tl-revert');
  const explainCheck = $('#chk-explain');

  if (explainCheck) {
    explainCheck.checked = V.explainMode;
    explainCheck.addEventListener('change', () => {
      V.explainMode = explainCheck.checked;
      if (V.currentResult) renderResult(V.currentResult);
      toast(V.explainMode ? 'Explain mode enabled' : 'Explain mode disabled');
    });
  }

  toggleBtn?.addEventListener('click', () => {
    box.hidden = !box.hidden;
    if (!box.hidden) {
      if (!V.currentCred) {
        $('#ld-valid').click();
      } else {
        syncTamperFromCred();
      }
    }
  });

  closeBtn?.addEventListener('click', () => { box.hidden = true; });

  async function triggerTamper() {
    if (!V.baseCred) return;
    clearTimeout(tamperDebounce);
    tamperDebounce = setTimeout(async () => {
      try {
        const val = parseFloat(cgpaInput.value) || 0;
        if (cgpaVal) cgpaVal.textContent = val.toFixed(2);
        if (cgpaRange) cgpaRange.value = val;

        const mutations = {
          name: nameInput.value.trim(),
          program: progInput.value.trim(),
          graduationYear: Number(yearInput.value),
          cgpa: val,
        };

        const res = await api('/api/tamper', {
          credential: V.baseCred,
          mutations,
        });

        const origEl = $('#tl-orig-hash');
        if (origEl) origEl.textContent = short(res.originalHash, 14, 12);
        const mutHashEl = $('#tl-mut-hash');
        if (mutHashEl) {
          mutHashEl.innerHTML = (res.charDiff || []).map((cd) =>
            `<span class="diff-char ${cd.diff ? 'diff' : ''}">${esc(cd.char2)}</span>`
          ).join('');
        }

        const badge = $('#tl-avalanche-badge');
        if (badge) {
          badge.textContent = `🔥 Avalanche: ${res.flippedBits}/256 bits inverted (${res.avalanchePercent}% variance)`;
          badge.className = `avalanche-badge ${res.flippedBits > 0 ? 'altered' : ''}`;
        }

        V.currentCred = res.mutatedCredential;
        $('#cred').value = JSON.stringify(res.mutatedCredential, null, 2);
        renderResult(res.verification);
        loadStatus();
        if (!$('#p-analytics').hidden) loadAnalytics();
      } catch (err) {
        toast(err.message);
      }
    }, 150);
  }

  cgpaRange?.addEventListener('input', () => {
    cgpaInput.value = parseFloat(cgpaRange.value).toFixed(2);
    triggerTamper();
  });
  cgpaInput?.addEventListener('input', () => {
    cgpaRange.value = cgpaInput.value;
    triggerTamper();
  });
  nameInput?.addEventListener('input', triggerTamper);
  progInput?.addEventListener('input', triggerTamper);
  yearInput?.addEventListener('input', triggerTamper);

  revertBtn?.addEventListener('click', () => {
    if (!V.baseCred) return;
    setCred(V.baseCred);
    syncTamperFromCred();
    runVerify();
    toast('Reverted to original valid credential');
  });
}

/* ---------- Batch Issuance (Tier 2 Item I) ---------- */
const SAMPLE_COHORT = [
  { name: 'Aditi Sharma', program: 'B.Tech in Computer Engineering', graduationYear: 2026, cgpa: 9.24 },
  { name: 'Rohan Deshmukh', program: 'B.Tech in Artificial Intelligence', graduationYear: 2026, cgpa: 8.85 },
  { name: 'Kavya Iyer', program: 'B.Tech in Data Science & Analytics', graduationYear: 2026, cgpa: 9.12 },
  { name: 'Arjun Kulkarni', program: 'B.Tech in Cyber Security', graduationYear: 2026, cgpa: 8.40 },
  { name: 'Pooja Nair', program: 'B.Tech in Computer Engineering', graduationYear: 2026, cgpa: 8.95 },
  { name: 'Vikram Joshi', program: 'B.Tech in Artificial Intelligence', graduationYear: 2026, cgpa: 8.35 },
  { name: 'Ananya Rao', program: 'B.Tech in Information Technology', graduationYear: 2026, cgpa: 9.45 },
  { name: 'Karthik Hegde', program: 'B.Tech in Cyber Security', graduationYear: 2026, cgpa: 8.60 },
  { name: 'Sneha Patil', program: 'B.Tech in Computer Engineering', graduationYear: 2026, cgpa: 8.78 },
  { name: 'Manish Bhat', program: 'B.Tech in Data Science & Analytics', graduationYear: 2026, cgpa: 8.90 },
  { name: 'Tanvi Gokhale', program: 'B.Tech in Artificial Intelligence', graduationYear: 2026, cgpa: 9.05 },
  { name: 'Siddharth Pillai', program: 'B.Tech in Information Technology', graduationYear: 2026, cgpa: 8.52 },
  { name: 'Rhea Fernandes', program: 'B.Tech in Computer Engineering', graduationYear: 2026, cgpa: 9.30 },
  { name: 'Pranav Sawant', program: 'B.Tech in Cyber Security', graduationYear: 2026, cgpa: 8.15 },
  { name: 'Deepa Kamath', program: 'B.Tech in Data Science & Analytics', graduationYear: 2026, cgpa: 9.18 },
];

function initBatchIssue() {
  const singleBtn = $('#btn-mode-single');
  const batchBtn = $('#btn-mode-batch');
  const singleWrap = $('#single-issue-wrap');
  const batchWrap = $('#batch-issue-wrap');
  const loadCohortBtn = $('#btn-load-cohort');
  const csvInput = $('#batch-csv-input');
  const doBatchBtn = $('#btn-do-batch-issue');
  const tableBody = $('#batch-preview-table tbody');
  const countEl = $('#batch-count');
  const clearBtn = $('#btn-clear-batch');

  singleBtn?.addEventListener('click', () => {
    singleBtn.classList.add('active');
    batchBtn.classList.remove('active');
    singleWrap.hidden = false;
    batchWrap.hidden = true;
  });

  batchBtn?.addEventListener('click', () => {
    batchBtn.classList.add('active');
    singleBtn.classList.remove('active');
    singleWrap.hidden = true;
    batchWrap.hidden = false;
  });

  function renderBatchPreview() {
    if (!countEl || !tableBody || !doBatchBtn) return;
    countEl.textContent = V.batchRecords.length;
    if (!V.batchRecords.length) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:18px;">Click "Load Sample Cohort" or upload a CSV file with columns: <code>name,program,graduationYear,cgpa</code></td></tr>`;
      doBatchBtn.disabled = true;
      doBatchBtn.textContent = 'Sign & Anchor 0 Records in 1 Transaction';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    if (clearBtn) clearBtn.style.display = 'inline-block';
    doBatchBtn.disabled = false;
    doBatchBtn.textContent = `Sign & Anchor ${V.batchRecords.length} Records in 1 Transaction (issueBatch)`;

    tableBody.innerHTML = V.batchRecords.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${esc(r.program)}</td>
        <td>${esc(r.graduationYear)}</td>
        <td><strong>${esc(r.cgpa)}</strong></td>
      </tr>
    `).join('');
  }

  loadCohortBtn?.addEventListener('click', () => {
    V.batchRecords = JSON.parse(JSON.stringify(SAMPLE_COHORT));
    renderBatchPreview();
    toast(`Loaded ${SAMPLE_COHORT.length} students from Class of 2026`);
  });

  clearBtn?.addEventListener('click', () => {
    V.batchRecords = [];
    renderBatchPreview();
  });

  csvInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const lines = evt.target.result.split(/\r?\n/).filter((x) => x.trim());
        const parsed = [];
        let startIdx = 0;
        if (lines[0]?.toLowerCase().includes('name')) startIdx = 1;
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 2) {
            parsed.push({
              name: parts[0] || `Student ${i}`,
              program: parts[1] || 'B.Tech in Computer Engineering',
              graduationYear: Number(parts[2]) || 2026,
              cgpa: parseFloat(parts[3]) || 8.0,
            });
          }
        }
        if (!parsed.length) throw new Error('No valid rows found in CSV');
        V.batchRecords = parsed.slice(0, 50);
        renderBatchPreview();
        toast(`Parsed ${V.batchRecords.length} rows from CSV`);
      } catch (err) {
        toast(`CSV Error: ${err.message}`);
      }
    };
    reader.readAsText(file);
  });

  doBatchBtn?.addEventListener('click', async () => {
    if (!V.batchRecords.length) return;
    doBatchBtn.disabled = true;
    doBatchBtn.textContent = 'Signing and anchoring batch on EVM…';
    const actor = $('#b-actor')?.value || $('#i-actor')?.value;
    try {
      const res = await api('/api/issue-batch', {
        actor,
        records: V.batchRecords,
        validDays: 3650,
      });

      const singleGasEst = 98200 * res.count;
      const gasSaved = singleGasEst - res.totalGas;

      const out = $('#issue-out');
      out.className = '';
      out.innerHTML = `
        <div class="batch-receipt">
          <div class="cert-head">
            <div>
              <div class="cert-badge" style="color:var(--ok);">Batch Anchored On-Chain</div>
              <h3 style="margin-top:2px;">${res.count} Credentials Issued</h3>
            </div>
            <span class="badge t-ok">EVM Transaction Confirmed</span>
          </div>
          <p class="hint" style="margin:6px 0 12px;">All ${res.count} credentials cryptographically signed by <b>${esc(res.issuedBy)}</b> and anchored in a single block using <code>issueBatch(bytes32[])</code>.</p>
          <div class="batch-receipt-grid">
            <div class="receipt-metric">
              <strong>${res.count}</strong>
              <small>Credentials</small>
            </div>
            <div class="receipt-metric">
              <strong>${Number(res.gasPerRecord).toLocaleString()}</strong>
              <small>Gas / Record</small>
            </div>
            <div class="receipt-metric">
              <strong>${Number(res.totalGas).toLocaleString()}</strong>
              <small>Total Gas Used</small>
            </div>
            <div class="receipt-metric">
              <strong style="color:var(--ok);">${res.savingsPercent}%</strong>
              <small>Gas Saved</small>
            </div>
          </div>
          <div class="facts" style="border:0; padding-top:0;">
            <dt>Tx Hash</dt>
            <dd><span class="hash">${esc(res.tx?.txHash || '—')}</span></dd>
            <dt>Gas Saved vs Single</dt>
            <dd class="plain"><strong>~${Number(gasSaved).toLocaleString()} gas</strong> saved compared to ${res.count} individual transactions</dd>
          </div>
          <div class="cert-actions" style="margin-top:14px;">
            <button class="primary small" id="btn-dl-cohort">Download Cohort Bundle (.json)</button>
            <button class="ghost small" id="btn-view-records-tab">View in Records Tab</button>
            <button class="ghost small" id="btn-verify-first">Verify First Record</button>
          </div>
        </div>`;

      $('#btn-dl-cohort')?.addEventListener('click', () => {
        const bundle = res.items.map((x) => x.credential);
        downloadJson(bundle, `cohort-${res.count}-credentials.json`);
      });
      $('#btn-view-records-tab')?.addEventListener('click', () => showTab('records'));
      $('#btn-verify-first')?.addEventListener('click', () => {
        if (res.items[0]?.credential) {
          setCred(res.items[0].credential);
          showTab('verify');
          runVerify();
        }
      });

      toast(`Batch of ${res.count} records successfully anchored!`);
      loadStatus();
      loadRecords();
      if (!$('#p-analytics').hidden) loadAnalytics();
    } catch (err) {
      toast(err.message);
    } finally {
      doBatchBtn.disabled = false;
      doBatchBtn.textContent = `Sign & Anchor ${V.batchRecords.length} Records in 1 Transaction (issueBatch)`;
    }
  });
}

/* ---------- Analytics (Tier 2 Item H) ---------- */
async function loadAnalytics() {
  try {
    const data = await api('/api/analytics');
    V.analytics = data;

    const kpiRec = $('#kpi-records');
    const kpiVer = $('#kpi-verifications');
    const kpiAtt = $('#kpi-attacks');
    const kpiSav = $('#kpi-savings');

    if (kpiRec) kpiRec.textContent = data.totalAnchored ?? 0;
    if (kpiVer) kpiVer.textContent = data.verifications.total ?? 0;
    const attacks = (data.verifications.TAMPERED || 0) + (data.verifications.UNAUTHORIZED_ISSUER || 0) + (data.verifications.REVOKED || 0) + (data.verifications.EXPIRED || 0);
    if (kpiAtt) kpiAtt.textContent = attacks;
    if (kpiSav) kpiSav.textContent = `${data.gas.savingsPercent}%`;

    renderChartInstitutions(data.institutions || []);
    renderChartVerdicts(data.verifications || {});
    renderChartGas(data.gas || {});
    renderChartReasons(data.reasonsBreakdown || {});
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

function renderChartInstitutions(insts) {
  const svg = $('#chart-inst');
  if (!svg) return;
  const max = Math.max(1, ...insts.map((x) => x.recordCount || 0));
  const barH = 26;
  const startY = 32;

  let bars = insts.map((inst, i) => {
    const y = startY + i * 44;
    const count = inst.recordCount || 0;
    const w = Math.round((count / max) * 220);
    return `
      <text x="16" y="${y + 14}" class="chart-text">${esc(inst.name)}</text>
      <rect x="150" y="${y}" width="220" height="${barH}" class="chart-bar-bg" />
      <rect x="150" y="${y}" width="${Math.max(w, 4)}" height="${barH}" class="chart-bar" fill="var(--brand)" />
      <text x="${158 + Math.max(w, 4)}" y="${y + 18}" class="chart-text-val">${count}</text>
    `;
  }).join('');

  svg.innerHTML = `
    <line x1="150" y1="20" x2="150" y2="150" stroke="var(--line)" stroke-width="1.5" />
    ${bars}
  `;
}

function renderChartVerdicts(verdicts) {
  const svg = $('#chart-verdicts');
  if (!svg) return;
  const items = [
    { label: 'Valid', count: verdicts.VALID || 0, color: 'var(--ok)' },
    { label: 'Altered', count: verdicts.TAMPERED || 0, color: 'var(--bad)' },
    { label: 'Revoked', count: verdicts.REVOKED || 0, color: 'var(--warn)' },
    { label: 'Rogue / Mill', count: verdicts.UNAUTHORIZED_ISSUER || 0, color: 'var(--viol)' },
    { label: 'Expired', count: verdicts.EXPIRED || 0, color: '#D97706' },
  ];
  const total = items.reduce((acc, x) => acc + x.count, 0);

  if (total === 0) {
    svg.innerHTML = `
      <circle cx="90" cy="90" r="54" fill="none" stroke="#E7ECF0" stroke-width="24" />
      <text x="90" y="94" text-anchor="middle" class="chart-text-muted">No verifications</text>
      <g transform="translate(180, 45)">
        ${items.map((it, i) => `
          <circle cx="10" cy="${i * 22 + 8}" r="5" fill="${it.color}" />
          <text x="24" y="${i * 22 + 12}" class="chart-text">${esc(it.label)}: 0</text>
        `).join('')}
      </g>
    `;
    return;
  }

  const r = 54;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = items.map((it) => {
    const frac = it.count / total;
    const dash = frac * circ;
    const strokeOffset = -offset;
    offset += dash;
    return `<circle cx="90" cy="90" r="${r}" fill="none" stroke="${it.color}" stroke-width="24" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${strokeOffset}" transform="rotate(-90 90 90)" />`;
  }).join('');

  svg.innerHTML = `
    <circle cx="90" cy="90" r="${r}" fill="none" stroke="#E7ECF0" stroke-width="24" />
    ${arcs}
    <text x="90" y="86" text-anchor="middle" class="chart-text-val" font-size="16">${total}</text>
    <text x="90" y="102" text-anchor="middle" class="chart-text-muted" font-size="10">TOTAL</text>
    <g transform="translate(195, 30)">
      ${items.map((it, i) => `
        <circle cx="8" cy="${i * 22 + 8}" r="5" fill="${it.color}" />
        <text x="20" y="${i * 22 + 12}" class="chart-text">${esc(it.label)}</text>
        <text x="140" y="${i * 22 + 12}" class="chart-text-val" text-anchor="end">${it.count}</text>
      `).join('')}
    </g>
  `;
}

function renderChartGas(gas) {
  const svg = $('#chart-gas');
  if (!svg) return;
  const single = gas.singleGasAvg || 98200;
  const batch = gas.batchGasAvg || 52100;
  const maxGas = 120000;

  const wSingle = Math.round((single / maxGas) * 230);
  const wBatch = Math.round((batch / maxGas) * 230);

  svg.innerHTML = `
    <text x="14" y="44" class="chart-text">Single Issuance</text>
    <rect x="130" y="28" width="230" height="24" class="chart-bar-bg" />
    <rect x="130" y="28" width="${wSingle}" height="24" class="chart-bar" fill="#5B6772" />
    <text x="${136 + wSingle}" y="45" class="chart-text-val">${(single / 1000).toFixed(1)}k</text>

    <text x="14" y="94" class="chart-text">Batch (per record)</text>
    <rect x="130" y="78" width="230" height="24" class="chart-bar-bg" />
    <rect x="130" y="78" width="${wBatch}" height="24" class="chart-bar" fill="var(--ok)" />
    <text x="${136 + wBatch}" y="95" class="chart-text-val" fill="var(--ok)">${(batch / 1000).toFixed(1)}k</text>

    <g transform="translate(130, 126)">
      <rect x="0" y="0" width="230" height="28" rx="6" fill="var(--ok-bg)" stroke="var(--ok)" stroke-width="1" />
      <text x="115" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ok)">
        ⚡ 46.9% Less Gas via Calldata Packing
      </text>
    </g>
  `;
}

function renderChartReasons(reasons) {
  const svg = $('#chart-reasons');
  if (!svg) return;
  const entries = Object.entries(reasons);
  const max = Math.max(1, ...entries.map(([_, v]) => v));

  svg.innerHTML = entries.map(([reason, count], i) => {
    const y = 20 + i * 30;
    const w = Math.round((count / max) * 160);
    return `
      <text x="14" y="${y + 14}" class="chart-text" font-size="10">${esc(reason)}</text>
      <rect x="180" y="${y}" width="160" height="18" class="chart-bar-bg" />
      <rect x="180" y="${y}" width="${Math.max(w, count > 0 ? 6 : 0)}" height="18" class="chart-bar" fill="var(--warn)" />
      <text x="${186 + Math.max(w, count > 0 ? 6 : 0)}" y="${y + 14}" class="chart-text-val">${count}</text>
    `;
  }).join('');
}

/* ---------- boot ---------- */
async function boot() {
  await loadStatus();
  try {
    const blocks = await api('/api/blocks');
    renderRibbon(blocks);
  } catch (_) {}
  initSSE();
  initDropZone();
  initTamperLab();
  initBatchIssue();
  $('#btn-refresh-analytics')?.addEventListener('click', loadAnalytics);
  showTab((location.hash || '#verify').slice(1));
}

boot().catch((e) => toast(e.message));

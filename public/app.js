'use strict';

/* ---------- state ---------- */
const V = {
  status: null,
  records: [],
  blocks: [],
  currentCred: null,
  currentHash: null,
  currentResult: null,
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
const TABS = ['verify', 'issue', 'records', 'network', 'scenarios'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'verify';
  for (const t of TABS) {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`#p-${t}`).hidden = t !== name;
  }
  if (name === 'records') loadRecords();
  if (name === 'network') loadNetwork();
  history.replaceState(null, '', `#${name}`);
}
for (const t of TABS) $(`#tab-${t}`).addEventListener('click', () => showTab(t));

/* ---------- status strip with animated counters ---------- */
async function loadStatus() {
  const next = await api('/api/status');
  updateStatusStrip(next);
  V.status = next;
  const sel = $('#i-actor');
  if (!sel.options.length) {
    for (const a of next.actors.filter((x) => x.key !== 'registrar' && /Issuer|issuer|mill/.test(x.label))) {
      sel.add(new Option(a.label, a.key));
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

/* ---------- verify panel ---------- */
function renderResult(r) {
  V.currentResult = r;
  if (r.recordHash) V.currentHash = r.recordHash;

  const [tone, icon] = TONE[r.verdict] || ['t-grey', 'bang'];
  const chain = r.checks.map((c, i) => {
    const cls = c.status === 'pass' ? '' : c.status === 'fail' ? 'fail' : 'skipped';
    const ic = c.status === 'pass' ? ICON.ok : c.status === 'fail' ? ICON.no : ICON.dash;
    const detail = c.status === 'skipped' ? 'Not reached' : c.detail;
    return `<li class="link ${cls}" style="--i:${i}"><span class="node">${ic}</span><div class="txt"><strong>${esc(c.label)}</strong><small>${esc(detail)}</small></div></li>`;
  }).join('');

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
    } catch (_) {
      V.currentCred = null;
    }
    const res = await api('/api/verify', { credential: text });
    renderResult(res);
    loadStatus();
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
  V.currentHash = null;
  V.currentResult = null;
  $('#cred').value = JSON.stringify(c, null, 2);
  $('#result').className = 'reveal';
  $('#result').innerHTML = `
    ${certHTML(c, null)}
    <div class="empty"><p>Record loaded into preview. Click <b>Verify record</b> to test against the on-chain registry.</p></div>`;
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
      } catch (_) {}
    });

    sse.addEventListener('record_revoked', (e) => {
      try {
        const data = JSON.parse(e.data);
        handleLiveRevocation(data);
      } catch (_) {}
    });

    sse.addEventListener('institution_status', () => {
      loadStatus();
      if (!$('#p-network').hidden) loadNetwork();
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

/* ---------- boot ---------- */
async function boot() {
  await loadStatus();
  try {
    const blocks = await api('/api/blocks');
    renderRibbon(blocks);
  } catch (_) {}
  initSSE();
  initDropZone();
  showTab((location.hash || '#verify').slice(1));
}

boot().catch((e) => toast(e.message));

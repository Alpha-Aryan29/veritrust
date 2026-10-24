'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (h, a = 8, b = 6) => (h && h.length > a + b + 2 ? `${h.slice(0, a)}…${h.slice(-b)}` : h || '');
const fmtTime = (s) => new Date(s * 1000).toLocaleString();

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
  toastTimer = setTimeout(() => t.classList.remove('on'), 2800);
}

const ICON = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M7 12h10"/></svg>',
  bang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v9M12 19v.5"/></svg>',
};

const TONE = {
  VALID: ['t-ok', 'ok'], TAMPERED: ['t-bad', 'no'], ISSUER_MISMATCH: ['t-bad', 'no'], UNAUTHORIZED_ISSUER: ['t-viol', 'no'],
  NOT_ANCHORED: ['t-viol', 'bang'], REVOKED: ['t-warn', 'no'], EXPIRED: ['t-warn', 'bang'], INSTITUTION_SUSPENDED: ['t-warn', 'bang'], MALFORMED: ['t-grey', 'bang'],
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

/* ---------- status strip ---------- */
let status;
async function loadStatus() {
  status = await api('/api/status');
  $('#strip').innerHTML = [
    ['Registry contract', short(status.contract, 8, 4)],
    ['Block height', status.block],
    ['Records anchored', status.records],
    ['Revocations', status.revocations],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  const sel = $('#i-actor');
  if (!sel.options.length) {
    for (const a of status.actors.filter((x) => x.key !== 'registrar' && /Issuer|issuer|mill/.test(x.label))) {
      sel.add(new Option(a.label, a.key));
    }
  }
}

/* ---------- verify ---------- */
function renderResult(r) {
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
  $('#result').className = 'reveal';
  $('#result').innerHTML = `
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
    renderResult(await api('/api/verify', { credential: text }));
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
const setCred = (c) => { $('#cred').value = JSON.stringify(c, null, 2); $('#result').className = 'empty'; $('#result').innerHTML = '<p>Record loaded. Choose Verify record.</p>'; };
$('#ld-valid').addEventListener('click', async () => { setCred(await sample('sitRegistry')); loadStatus(); });
$('#ld-alter').addEventListener('click', async () => {
  const c = await sample('sitRegistry');
  c.credentialSubject.cgpa = 9.9; // edited after signing
  setCred(c); toast('CGPA changed from 8.4 to 9.9 after signing');
  loadStatus();
});
$('#ld-forged').addEventListener('click', async () => { setCred(await sample('rogue')); toast('Signed by an unregistered key'); loadStatus(); });

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
    $('#issue-out').className = '';
    $('#issue-out').innerHTML = `
      <div class="msg ${ok ? 't-ok' : 't-viol'}"><b>${ok ? 'Registered on-chain' : 'Registry rejected this issuance'}</b>
        ${ok ? `Issued by ${esc(r.issuedBy)}. Gas used: ${r.tx.gasUsed.toLocaleString()}. Transaction ${esc(short(r.tx.txHash, 10, 8))}.`
             : `${esc(errText(r.tx.error))} The signed record still exists off-chain. Send it to Verify to see how it is caught.`}</div>
      <dl class="facts"><dt>Record fingerprint</dt><dd>${esc(r.recordHash)}</dd></dl>
      <div class="row"><button class="ghost" id="to-verify">Send to Verify</button><button class="ghost" id="copy-cred">Copy record</button></div>
      <pre class="code">${esc(JSON.stringify(r.credential, null, 2))}</pre>`;
    $('#to-verify').addEventListener('click', () => { setCred(r.credential); showTab('verify'); });
    $('#copy-cred').addEventListener('click', () => navigator.clipboard.writeText(JSON.stringify(r.credential, null, 2)).then(() => toast('Record copied')));
    loadStatus();
  } catch (e) { toast(e.message); } finally { btn.disabled = false; }
});

/* ---------- records & revocation ---------- */
const REASONS = ['Unspecified', 'Issued in error', 'Fraud or misconduct', 'Degree withdrawn', 'Superseded by a new record'];
async function loadRecords() {
  const rows = await api('/api/records');
  const box = $('#records');
  if (!rows.length) { box.className = 'empty'; box.innerHTML = '<p>Nothing issued yet. Use the Issue tab.</p>'; return; }
  box.className = '';
  const actorOpts = status.actors.filter((a) => a.key !== 'registrar').map((a) => `<option value="${a.key}">${esc(a.label)}</option>`).join('');
  box.innerHTML = `<div class="scroll"><table><thead><tr><th>Record</th><th>Issued by</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((r, i) => {
    const [cls, label] = !r.anchored ? ['t-viol', 'Never registered'] : r.revoked ? ['t-warn', `Revoked: ${r.reason}`] : ['t-ok', 'Active'];
    return `<tr data-i="${i}">
      <td><b>${esc(r.name)}</b><br><span class="hash" title="${esc(r.recordHash)}">${esc(short(r.recordHash, 10, 8))}</span></td>
      <td>${esc(r.issuedBy)}</td>
      <td><span class="badge ${cls}">${esc(label)}</span></td>
      <td>${r.anchored && !r.revoked ? `<button class="small rv">Revoke…</button>` : ''}
        <button class="small vf">Verify</button>
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
    $('.rv', tr)?.addEventListener('click', () => { rb.hidden = !rb.hidden; });
    $('.vf', tr).addEventListener('click', () => { setCred(r.credential); showTab('verify'); runVerify(); });
    $('.go', tr).addEventListener('click', async () => {
      const out = await api('/api/revoke', { actor: $('.who', tr).value, recordHash: r.recordHash, reason: Number($('.why', tr).value) });
      if (out.revoked) { toast('Record revoked'); loadStatus(); loadRecords(); }
      else $('.note', tr).textContent = `Rejected by the contract: ${errText(out.tx.error)}`;
    });
  });
}

/* ---------- network & audit ---------- */
async function loadNetwork() {
  await loadStatus();
  $('#institutions').innerHTML = status.institutions.map((i) => `
    <div class="inst ${i.active ? 't-ok' : 't-warn'}">
      <div>
        <h3>${esc(i.name)} <span class="badge">${i.active ? 'In good standing' : 'Suspended'}</span></h3>
        <div class="addr">Admin key ${esc(i.admin)}</div>
        <ul>${i.issuers.map((s) => `<li>${esc(s.label)}<span class="addr"> ${esc(short(s.address, 8, 6))}</span></li>`).join('')}</ul>
      </div>
      <div><button class="small" data-id="${esc(i.id)}" data-active="${i.active}">${i.active ? 'Suspend (registrar)' : 'Reinstate (registrar)'}</button></div>
    </div>`).join('');
  $('#institutions').querySelectorAll('button[data-id]').forEach((b) => b.addEventListener('click', async () => {
    await api('/api/institution/status', { id: b.dataset.id, active: b.dataset.active !== 'true' });
    toast('Registrar updated the institution'); loadNetwork();
  }));
  const log = await api('/api/audit');
  $('#audit tbody').innerHTML = log.map((e) => `<tr><td>${e.block}</td><td>${esc(fmtTime(e.time))}</td><td>${esc(e.summary)}</td><td class="hash">${esc(short(e.subject, 12, 6))}</td><td class="hash">${esc(short(e.txHash, 10, 6))}</td></tr>`).join('');
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

/* ---------- boot ---------- */
loadStatus().then(() => showTab((location.hash || '#verify').slice(1))).catch((e) => toast(e.message));

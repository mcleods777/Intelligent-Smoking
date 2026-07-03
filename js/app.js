// ============ Smoker AI — application UI ============

import {
  getDb, Meats, Vendors, Cooks, Reviews, Checklist, Settings,
  exportJson, importJson, resetDb, loadDemoData,
} from './store.js';
import { drawTempChart } from './charts.js';
import { computeInsights, analyzeCook, askClaude, hasApiKey } from './ai.js';

// ---------- tiny helpers ----------
const $ = sel => document.querySelector(sel);
const container = $('#view-container');

const state = { view: 'dashboard', cookId: null };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// render **bold** in insight lines (already-escaped input)
function mdBold(s) { return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
}
function closeModal() {
  $('#modal-overlay').classList.add('hidden');
  $('#modal-content').innerHTML = '';
}
$('#modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

const fmtDate = d => (d ? new Date(d + (d.length === 10 ? 'T12:00' : '')).toLocaleDateString() : '—');
const fmtTime = ts => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const money = n => '$' + (Number(n) || 0).toFixed(2);
const num = n => (n == null || n === '' ? null : Number(n));
const round1 = n => Math.round(n * 10) / 10;

function scorePill(avgScore, count) {
  if (avgScore == null) return '<span class="muted">no reviews</span>';
  const cls = avgScore >= 8 ? 'high' : avgScore < 6 ? 'low' : '';
  return `<span class="score-pill ${cls}">★ ${round1(avgScore)}/10${count ? ` <span class="muted">(${count})</span>` : ''}</span>`;
}

const MEAT_TYPES = ['Beef', 'Pork', 'Poultry', 'Lamb', 'Fish', 'Game', 'Other'];
const GRADES = ['Prime', 'Choice', 'Select', 'Wagyu', 'Organic', 'Heritage', 'N/A'];
const METHODS = ['Low & Slow', 'Hot & Fast', 'Reverse Sear', 'Smoke + Braise', '3-2-1', 'Cold Smoke', 'Other'];
const ACTION_TYPES = ['💦 Spritz', '📦 Wrap', '🔄 Flip/Rotate', '🌡️ Temp Change', '🧂 Season', '🔥 Fire', '🥩 Meat On', '🛌 Rest', '🍽️ Pulled Off', '📝 Note'];
const PROBE_COLORS = ['#ff6b35', '#7cb342', '#42a5f5', '#f4b942', '#ab47bc', '#26c6da', '#ef5350', '#8d99ae'];

// ---------- navigation ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    state.cookId = null;
    render();
  });
});

function setActiveNav() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
}

function render() {
  setActiveNav();
  const views = {
    dashboard: renderDashboard,
    meats: renderMeats,
    cooks: renderCooks,
    reviews: renderReviews,
    checklist: renderChecklist,
    vendors: renderVendors,
    insights: renderInsights,
    settings: renderSettings,
  };
  (views[state.view] || renderDashboard)();
  window.scrollTo(0, 0);
}

// ================= DASHBOARD =================
function renderDashboard() {
  const db = getDb();
  const done = db.cooks.filter(c => c.status === 'done');
  const active = db.cooks.filter(c => c.status === 'active');
  const rated = done.map(c => Reviews.avgForCook(c.id)).filter(v => v != null);
  const overallAvg = rated.length ? rated.reduce((s, v) => s + v, 0) / rated.length : null;
  const spent = db.meats.reduce((s, m) => s + (Number(m.price) || 0), 0);
  const lbs = db.meats.reduce((s, m) => s + (Number(m.weightLbs) || 0), 0);
  const insights = computeInsights().slice(0, 3);

  const recentCooks = [...db.cooks].sort((a, b) => (b.startTime || 0) - (a.startTime || 0)).slice(0, 5);

  container.innerHTML = `
    <div class="view-header">
      <div><h2>Dashboard</h2><p class="sub">The state of your smoking journey</p></div>
      <button class="btn" id="quick-smoke">💨 Start a Smoke</button>
    </div>
    ${active.length ? `
      <div class="card mb" style="border-color:#8a4a22">
        <h3>🔥 Smoking right now</h3>
        ${active.map(c => `<div class="flex spread"><span>${esc(Meats.get(c.meatId)?.name || 'Unknown meat')} — started ${fmtTime(c.startTime)}</span>
          <button class="btn small" data-open-cook="${c.id}">Open session</button></div>`).join('')}
      </div>` : ''}
    <div class="grid cols-4 mb">
      <div class="card"><h3>💨 Smokes Completed</h3><div class="big">${done.length}</div><div class="hint">${active.length} active, ${db.cooks.filter(c => c.status === 'planned').length} planned</div></div>
      <div class="card"><h3>⭐ Average Score</h3><div class="big">${overallAvg != null ? round1(overallAvg) + '/10' : '—'}</div><div class="hint">across ${rated.length} rated smoke(s)</div></div>
      <div class="card"><h3>🥩 Meat Purchased</h3><div class="big">${round1(lbs)} lbs</div><div class="hint">${db.meats.filter(m => m.status === 'inventory').length} in the freezer queue</div></div>
      <div class="card"><h3>💰 Total Invested</h3><div class="big">${money(spent)}</div><div class="hint">${lbs ? money(spent / lbs) + '/lb blended' : 'log purchases to track'}</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>🕑 Recent Smokes</h3>
        ${recentCooks.length ? recentCooks.map(c => {
          const avgScore = Reviews.avgForCook(c.id);
          return `<div class="flex spread" style="padding:.35rem 0;border-bottom:1px solid var(--border)">
            <span>${esc(Meats.get(c.meatId)?.name || 'Unknown')} <span class="badge ${c.status}">${c.status}</span></span>
            <span class="flex">${scorePill(avgScore)} <button class="btn small secondary" data-open-cook="${c.id}">View</button></span>
          </div>`;
        }).join('') : '<div class="empty">No smokes yet — fire one up!</div>'}
      </div>
      <div class="card">
        <h3>🤖 AI Insights <button class="btn small secondary" id="go-insights" style="margin-left:auto">See all</button></h3>
        ${insights.map(i => `<div class="ai-block"><h4>${i.icon} ${esc(i.title)}</h4>${i.lines.map(l => `<p>${mdBold(esc(l))}</p>`).join('')}</div>`).join('')}
      </div>
    </div>`;

  $('#quick-smoke').onclick = () => { state.view = 'cooks'; render(); openCookForm(); };
  $('#go-insights').onclick = () => { state.view = 'insights'; render(); };
  bindOpenCookButtons();
}

function bindOpenCookButtons() {
  container.querySelectorAll('[data-open-cook]').forEach(b => {
    b.onclick = () => { state.view = 'cooks'; state.cookId = b.dataset.openCook; render(); };
  });
}

// ================= MEATS =================
function renderMeats() {
  const meats = Meats.all();
  container.innerHTML = `
    <div class="view-header">
      <div><h2>Meat Inventory</h2><p class="sub">Every cut you've bought — quality, poundage, price, and source</p></div>
      <button class="btn" id="add-meat">＋ Add Meat</button>
    </div>
    ${meats.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Type / Cut</th><th>Grade</th><th>Weight</th><th>Price</th><th>$/lb</th><th>Vendor</th><th>Quality</th><th>Purchased</th><th>Status</th><th></th></tr></thead>
      <tbody>${meats.map(m => {
        const v = Vendors.get(m.vendorId);
        const perLb = m.price && m.weightLbs ? money(m.price / m.weightLbs) : '—';
        return `<tr>
          <td class="wrap"><strong>${esc(m.name)}</strong>${m.notes ? `<br><span class="muted">${esc(m.notes)}</span>` : ''}</td>
          <td>${esc(m.type || '—')} / ${esc(m.cut || '—')}</td>
          <td>${esc(m.grade || '—')}</td>
          <td>${m.weightLbs ? m.weightLbs + ' lbs' : '—'}</td>
          <td>${m.price ? money(m.price) : '—'}</td>
          <td>${perLb}</td>
          <td>${esc(v?.name || '—')}</td>
          <td>${m.qualityRating ? `${m.qualityRating}/10` : '—'}</td>
          <td>${fmtDate(m.purchaseDate)}</td>
          <td><span class="badge ${m.status}">${m.status}</span></td>
          <td class="flex">
            <button class="btn small secondary" data-edit="${m.id}">Edit</button>
            <button class="btn small danger" data-del="${m.id}">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`
    : '<div class="empty">No meats logged yet. Add your first cut to start tracking quality, price, and vendors.</div>'}`;

  $('#add-meat').onclick = () => openMeatForm();
  container.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openMeatForm(Meats.get(b.dataset.edit)));
  container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('Delete this meat? Its smoke sessions and reviews will be removed too.')) {
      Meats.remove(b.dataset.del); toast('Meat deleted'); render();
    }
  });
}

function openMeatForm(meat = null) {
  const vendors = Vendors.all();
  openModal(`
    <h3>${meat ? 'Edit' : 'Add'} Meat</h3>
    <form class="form" id="meat-form">
      <label class="field">Name
        <input name="name" required placeholder="e.g. Whole Packer Brisket" value="${esc(meat?.name || '')}">
      </label>
      <div class="form-row">
        <label class="field">Type
          <select name="type">${MEAT_TYPES.map(t => `<option ${meat?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
        <label class="field">Cut <input name="cut" placeholder="Brisket, Ribs…" value="${esc(meat?.cut || '')}"></label>
        <label class="field">Grade
          <select name="grade">${GRADES.map(g => `<option ${meat?.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select>
        </label>
      </div>
      <div class="form-row">
        <label class="field">Weight (lbs) <input name="weightLbs" type="number" step="0.1" min="0" value="${meat?.weightLbs ?? ''}"></label>
        <label class="field">Price ($) <input name="price" type="number" step="0.01" min="0" value="${meat?.price ?? ''}"></label>
        <label class="field">Meat quality (1–10) <input name="qualityRating" type="number" min="1" max="10" step="0.5" value="${meat?.qualityRating ?? ''}"></label>
      </div>
      <div class="form-row">
        <label class="field">Vendor
          <select name="vendorId">
            <option value="">— none —</option>
            ${vendors.map(v => `<option value="${v.id}" ${meat?.vendorId === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">Purchase date <input name="purchaseDate" type="date" value="${meat?.purchaseDate || new Date().toISOString().slice(0, 10)}"></label>
        <label class="field">Status
          <select name="status">
            <option value="inventory" ${meat?.status !== 'smoked' ? 'selected' : ''}>In inventory</option>
            <option value="smoked" ${meat?.status === 'smoked' ? 'selected' : ''}>Smoked</option>
          </select>
        </label>
      </div>
      <label class="field">Notes <textarea name="notes" placeholder="Marbling, thickness, anything notable…">${esc(meat?.notes || '')}</textarea></label>
      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
        <button class="btn">${meat ? 'Save' : 'Add Meat'}</button>
      </div>
    </form>`);
  $('#cancel-modal').onclick = closeModal;
  $('#meat-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const data = { ...f, weightLbs: num(f.weightLbs), price: num(f.price), qualityRating: num(f.qualityRating) };
    if (meat) { Meats.update(meat.id, data); toast('Meat updated', 'good'); }
    else { Meats.add(data); toast('Meat added', 'good'); }
    closeModal(); render();
  };
}

// ================= COOKS (SMOKES) =================
function renderCooks() {
  if (state.cookId) return renderCookDetail(state.cookId);
  const cooks = [...Cooks.all()].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  container.innerHTML = `
    <div class="view-header">
      <div><h2>Smoke Sessions</h2><p class="sub">Method, pellets, temperature curves, and every action along the way</p></div>
      <button class="btn" id="add-cook">💨 New Smoke</button>
    </div>
    ${cooks.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Meat</th><th>Date</th><th>Method</th><th>Pellets</th><th>Duration</th><th>Probes</th><th>Score</th><th>Status</th><th></th></tr></thead>
      <tbody>${cooks.map(c => {
        const meat = Meats.get(c.meatId);
        const dur = c.startTime && c.endTime ? round1((c.endTime - c.startTime) / 3600e3) + ' h' : '—';
        return `<tr>
          <td class="wrap"><strong>${esc(meat?.name || 'Unknown')}</strong></td>
          <td>${fmtDate(c.date)}</td>
          <td>${esc(c.method || '—')}</td>
          <td>${esc([c.pelletBrand, c.pelletFlavor].filter(Boolean).join(' — ') || '—')}</td>
          <td>${dur}</td>
          <td>${(c.probes || []).length}</td>
          <td>${scorePill(Reviews.avgForCook(c.id), Reviews.forCook(c.id).length)}</td>
          <td><span class="badge ${c.status}">${c.status}</span></td>
          <td class="flex">
            <button class="btn small" data-open-cook="${c.id}">Open</button>
            <button class="btn small danger" data-del="${c.id}">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`
    : '<div class="empty">No smoke sessions yet. Start one to track temps, pellets, and actions in real time.</div>'}`;

  $('#add-cook').onclick = () => openCookForm();
  bindOpenCookButtons();
  container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('Delete this smoke session and its reviews?')) { Cooks.remove(b.dataset.del); toast('Smoke deleted'); render(); }
  });
}

function openCookForm(cook = null) {
  const meats = Meats.all();
  if (!meats.length && !cook) {
    toast('Add a meat first — a smoke session needs a meat.', 'bad');
    state.view = 'meats'; render(); openMeatForm();
    return;
  }
  openModal(`
    <h3>${cook ? 'Edit' : 'New'} Smoke Session</h3>
    <form class="form" id="cook-form">
      <div class="form-row">
        <label class="field">Meat
          <select name="meatId" required>
            ${meats.map(m => `<option value="${m.id}" ${cook?.meatId === m.id ? 'selected' : ''}>${esc(m.name)} (${m.weightLbs || '?'} lbs)</option>`).join('')}
          </select>
        </label>
        <label class="field">Date <input name="date" type="date" value="${cook?.date || new Date().toISOString().slice(0, 10)}"></label>
        <label class="field">Method
          <select name="method">${METHODS.map(m => `<option ${cook?.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </label>
      </div>
      <div class="form-row">
        <label class="field">Pellet brand <input name="pelletBrand" placeholder="Lumber Jack, Traeger…" value="${esc(cook?.pelletBrand || '')}"></label>
        <label class="field">Pellet flavor <input name="pelletFlavor" placeholder="Hickory, Cherry…" value="${esc(cook?.pelletFlavor || '')}"></label>
        <label class="field">Pellets used (lbs) <input name="pelletLbs" type="number" step="0.5" min="0" value="${cook?.pelletLbs ?? ''}"></label>
      </div>
      <div class="form-row">
        <label class="field">Target grill temp (°F) <input name="targetGrillTemp" type="number" min="0" value="${cook?.targetGrillTemp ?? 250}"></label>
        <label class="field">Target internal temp (°F) <input name="targetInternalTemp" type="number" min="0" value="${cook?.targetInternalTemp ?? 203}"></label>
      </div>
      <label class="field">Notes <textarea name="notes">${esc(cook?.notes || '')}</textarea></label>
      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
        <button class="btn">${cook ? 'Save' : 'Create & Open'}</button>
      </div>
    </form>`);
  $('#cancel-modal').onclick = closeModal;
  $('#cook-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const data = {
      ...f,
      pelletLbs: num(f.pelletLbs),
      targetGrillTemp: num(f.targetGrillTemp),
      targetInternalTemp: num(f.targetInternalTemp),
    };
    if (cook) {
      Cooks.update(cook.id, data);
      toast('Smoke updated', 'good');
    } else {
      const created = Cooks.add({
        ...data, status: 'planned', probes: [], readings: [], actions: [],
        startTime: null, endTime: null,
      });
      // sensible default probes so temp tracking works immediately
      Cooks.addProbe(created.id, 'Grill Temp', PROBE_COLORS[0]);
      Cooks.addProbe(created.id, 'Meat Probe 1', PROBE_COLORS[1]);
      state.cookId = created.id;
      toast('Smoke session created — probes ready', 'good');
    }
    closeModal(); state.view = 'cooks'; render();
  };
}

function renderCookDetail(cookId) {
  const cook = Cooks.get(cookId);
  if (!cook) { state.cookId = null; return renderCooks(); }
  const meat = Meats.get(cook.meatId);
  const reviews = Reviews.forCook(cook.id);
  const avgScore = Reviews.avgForCook(cook.id);
  const analysis = analyzeCook(cook);
  const people = Settings.get().people;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>💨 ${esc(meat?.name || 'Unknown meat')} <span class="badge ${cook.status}">${cook.status}</span></h2>
        <p class="sub">${esc(cook.method || '')} · ${fmtDate(cook.date)} · ${esc([cook.pelletBrand, cook.pelletFlavor].filter(Boolean).join(' — ') || 'pellets not logged')}${cook.pelletLbs ? ` · ${cook.pelletLbs} lbs pellets` : ''}</p>
      </div>
      <div class="flex">
        <button class="btn secondary small" id="back-cooks">← All smokes</button>
        <button class="btn secondary small" id="edit-cook">Edit details</button>
        ${cook.status === 'planned' ? '<button class="btn small" id="start-cook">🔥 Start Smoke</button>' : ''}
        ${cook.status === 'active' ? '<button class="btn small" id="finish-cook">🏁 Finish Smoke</button>' : ''}
      </div>
    </div>

    <div class="grid cols-2 mb">
      <div class="card">
        <h3>🌡️ Temperature Tracking</h3>
        <div class="chart-box"><canvas class="temp-chart" id="temp-chart"></canvas></div>
        <div class="flex mt" id="probe-chips">
          ${(cook.probes || []).map(p => `
            <span class="probe-chip"><span class="probe-dot" style="background:${p.color}"></span>${esc(p.name)}
              <button class="btn small ghost" data-del-probe="${p.id}" title="Remove probe">✕</button></span>`).join('')}
          <button class="btn small secondary" id="add-probe">＋ Add probe</button>
        </div>
        <hr class="sep">
        <form class="form" id="reading-form">
          <div class="form-row">
            <label class="field">Probe
              <select name="probeId">${(cook.probes || []).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
            </label>
            <label class="field">Temp (°F) <input name="temp" type="number" step="1" required placeholder="e.g. 250"></label>
            <label class="field">Time <input name="time" type="datetime-local" value="${localDatetime(Date.now())}"></label>
          </div>
          <div class="form-actions"><button class="btn small" ${cook.probes?.length ? '' : 'disabled'}>Log reading</button></div>
        </form>
      </div>

      <div class="card">
        <h3>📋 Action Log <span class="muted">(${(cook.actions || []).length})</span></h3>
        <form class="form mb" id="action-form">
          <div class="form-row">
            <label class="field">Action
              <select name="type">${ACTION_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
            </label>
            <label class="field">Time <input name="time" type="datetime-local" value="${localDatetime(Date.now())}"></label>
          </div>
          <label class="field">Details <input name="text" placeholder="e.g. Wrapped in butcher paper at 165°F internal"></label>
          <div class="form-actions"><button class="btn small">Log action</button></div>
        </form>
        <ul class="timeline">
          ${[...(cook.actions || [])].reverse().map(a => `
            <li><span class="t-time">${fmtTime(a.ts)}</span><span class="t-type">${esc(a.type)}</span>
              <span style="flex:1">${esc(a.text || '')}</span>
              <button class="btn small ghost" data-del-action="${a.ts}">✕</button></li>`).join('')
            || '<li class="muted" style="border:none;background:none">No actions logged yet.</li>'}
        </ul>
      </div>
    </div>

    <div class="grid cols-2 mb">
      <div class="card">
        <h3>🤖 AI Cook Analysis</h3>
        ${analysis.map(l => `<p style="margin:.3rem 0;font-size:.87rem">${mdBold(esc(l))}</p>`).join('')}
      </div>
      <div class="card">
        <h3>⭐ Reviews ${avgScore != null ? scorePill(avgScore, reviews.length) : ''}</h3>
        ${reviews.map(r => `
          <div class="flex spread" style="padding:.4rem 0;border-bottom:1px solid var(--border)">
            <span><strong>${esc(r.reviewer)}</strong> — <span class="stars">${'★'.repeat(Math.round(r.score / 2))}</span> ${r.score}/10
              ${r.comments ? `<br><span class="muted">${esc(r.comments)}</span>` : ''}</span>
            <button class="btn small ghost" data-del-review="${r.id}">✕</button>
          </div>`).join('') || '<p class="muted">No reviews yet — get the crowd\'s verdict below.</p>'}
        <hr class="sep">
        <form class="form" id="review-form">
          <div class="form-row">
            <label class="field">Reviewer
              <input name="reviewer" required list="people-list" placeholder="Who's rating?">
              <datalist id="people-list">${people.map(p => `<option>${esc(p)}</option>`).join('')}</datalist>
            </label>
            <label class="field">Score (1–10) <input name="score" type="number" min="1" max="10" step="0.5" required></label>
          </div>
          <label class="field">Comments <input name="comments" placeholder="Bark, smoke ring, tenderness…"></label>
          <div class="form-actions"><button class="btn small">Add review</button></div>
        </form>
      </div>
    </div>
    ${cook.notes ? `<div class="card"><h3>📝 Notes</h3><p style="font-size:.88rem">${esc(cook.notes)}</p></div>` : ''}`;

  drawTempChart($('#temp-chart'), cook);
  window.onresize = () => { const c = $('#temp-chart'); if (c) drawTempChart(c, Cooks.get(cookId) || cook); };

  $('#back-cooks').onclick = () => { state.cookId = null; render(); };
  $('#edit-cook').onclick = () => openCookForm(cook);
  const startBtn = $('#start-cook');
  if (startBtn) startBtn.onclick = () => {
    Cooks.update(cook.id, { status: 'active', startTime: Date.now() });
    Cooks.addAction(cook.id, '🔥 Fire', 'Smoke started');
    toast('Smoke started — log those temps! 🔥', 'good'); render();
  };
  const finishBtn = $('#finish-cook');
  if (finishBtn) finishBtn.onclick = () => {
    Cooks.update(cook.id, { status: 'done', endTime: Date.now() });
    if (meat) Meats.update(meat.id, { status: 'smoked' });
    Cooks.addAction(cook.id, '🍽️ Pulled Off', 'Smoke finished');
    toast('Smoke complete — time for reviews! 🏁', 'good'); render();
  };

  $('#add-probe').onclick = () => {
    const name = prompt('Probe name (e.g. "Grill Temp", "Brisket Flat", "Ambient"):');
    if (!name) return;
    const color = PROBE_COLORS[(cook.probes || []).length % PROBE_COLORS.length];
    Cooks.addProbe(cook.id, name.trim(), color);
    toast('Probe added', 'good'); render();
  };
  container.querySelectorAll('[data-del-probe]').forEach(b => b.onclick = () => {
    if (confirm('Remove this probe and its readings?')) { Cooks.removeProbe(cook.id, b.dataset.delProbe); render(); }
  });

  $('#reading-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.probeId) return;
    const ts = f.time ? new Date(f.time).getTime() : Date.now();
    Cooks.addReading(cook.id, f.probeId, f.temp, ts);
    toast(`Logged ${f.temp}°F`, 'good'); render();
  };

  $('#action-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const ts = f.time ? new Date(f.time).getTime() : Date.now();
    Cooks.addAction(cook.id, f.type, f.text, ts);
    toast('Action logged', 'good'); render();
  };
  container.querySelectorAll('[data-del-action]').forEach(b => b.onclick = () => {
    Cooks.removeAction(cook.id, Number(b.dataset.delAction)); render();
  });

  $('#review-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    Reviews.add({ cookId: cook.id, reviewer: f.reviewer.trim(), score: Number(f.score), comments: f.comments, date: new Date().toISOString().slice(0, 10) });
    const ppl = Settings.get().people;
    if (f.reviewer.trim() && !ppl.includes(f.reviewer.trim())) Settings.update({ people: [...ppl, f.reviewer.trim()] });
    toast('Review added', 'good'); render();
  };
  container.querySelectorAll('[data-del-review]').forEach(b => b.onclick = () => {
    Reviews.remove(b.dataset.delReview); render();
  });
}

function localDatetime(ts) {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ================= REVIEWS =================
function renderReviews() {
  const cooks = Cooks.all().filter(c => Reviews.forCook(c.id).length || c.status === 'done');
  const ranked = cooks
    .map(c => ({ cook: c, meat: Meats.get(c.meatId), reviews: Reviews.forCook(c.id), avg: Reviews.avgForCook(c.id) }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  container.innerHTML = `
    <div class="view-header">
      <div><h2>Reviews & Rankings</h2><p class="sub">Every smoke, rated by the whole crew — ranked by average score</p></div>
    </div>
    ${ranked.length ? ranked.map((x, i) => `
      <div class="card mb">
        <div class="flex spread">
          <h3>${i === 0 && x.avg != null ? '👑' : '🍖'} ${esc(x.meat?.name || 'Unknown')} <span class="muted">${esc(x.cook.method || '')} · ${fmtDate(x.cook.date)}</span></h3>
          <span class="flex">${scorePill(x.avg, x.reviews.length)} <button class="btn small secondary" data-open-cook="${x.cook.id}">Open smoke</button></span>
        </div>
        ${x.reviews.map(r => `<div style="padding:.35rem 0;border-top:1px solid var(--border);font-size:.86rem">
          <strong>${esc(r.reviewer)}</strong> <span class="stars">${'★'.repeat(Math.round(r.score / 2))}</span> ${r.score}/10
          ${r.comments ? `— <span class="muted">${esc(r.comments)}</span>` : ''}</div>`).join('')
          || '<p class="muted mt">No reviews yet — open the smoke to add some.</p>'}
      </div>`).join('')
    : '<div class="empty">Finish a smoke and gather the crew — every reviewer scores it out of 10 and the average decides the rankings.</div>'}`;
  bindOpenCookButtons();
}

// ================= CHECKLIST =================
function renderChecklist() {
  const items = Checklist.all();
  const loved = items.filter(i => i.status === 'love');
  const toTry = items.filter(i => i.status === 'try');
  const tried = items.filter(i => i.status === 'tried');

  const list = (arr, empty) => arr.length ? arr.map(i => `
    <div class="flex spread" style="padding:.4rem 0;border-bottom:1px solid var(--border)">
      <span><strong>${esc(i.name)}</strong>${i.notes ? ` <span class="muted">— ${esc(i.notes)}</span>` : ''}</span>
      <span class="flex">
        ${i.status !== 'love' ? `<button class="btn small secondary" data-move="${i.id}:love" title="Mark as loved">❤️</button>` : ''}
        ${i.status !== 'try' ? `<button class="btn small secondary" data-move="${i.id}:try" title="Move to want-to-try">🎯</button>` : ''}
        ${i.status !== 'tried' ? `<button class="btn small secondary" data-move="${i.id}:tried" title="Mark as tried">✅</button>` : ''}
        <button class="btn small ghost" data-del="${i.id}">✕</button>
      </span>
    </div>`).join('') : `<p class="muted">${empty}</p>`;

  container.innerHTML = `
    <div class="view-header">
      <div><h2>Meat Checklist</h2><p class="sub">What we love, what we've tried, and what's next on the smoker</p></div>
      <button class="btn" id="add-item">＋ Add to list</button>
    </div>
    <div class="grid cols-3">
      <div class="card"><h3>❤️ Meats We Love (${loved.length})</h3>${list(loved, 'Nothing here yet — promote your favorites.')}</div>
      <div class="card"><h3>🎯 Want to Try (${toTry.length})</h3>${list(toTry, 'Add the smokes on your bucket list.')}</div>
      <div class="card"><h3>✅ Tried (${tried.length})</h3>${list(tried, 'Items you\'ve smoked land here.')}</div>
    </div>`;

  $('#add-item').onclick = () => {
    openModal(`
      <h3>Add to Checklist</h3>
      <form class="form" id="cl-form">
        <label class="field">Meat / dish <input name="name" required placeholder="e.g. Pork Belly Burnt Ends"></label>
        <div class="form-row">
          <label class="field">List
            <select name="status">
              <option value="try">🎯 Want to try</option>
              <option value="love">❤️ We love it</option>
              <option value="tried">✅ Tried</option>
            </select>
          </label>
        </div>
        <label class="field">Notes <input name="notes" placeholder="Why it's on the list…"></label>
        <div class="form-actions">
          <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
          <button class="btn">Add</button>
        </div>
      </form>`);
    $('#cancel-modal').onclick = closeModal;
    $('#cl-form').onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      Checklist.add(f); toast('Added to checklist', 'good'); closeModal(); render();
    };
  };
  container.querySelectorAll('[data-move]').forEach(b => b.onclick = () => {
    const [id, status] = b.dataset.move.split(':');
    Checklist.update(id, { status }); render();
  });
  container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { Checklist.remove(b.dataset.del); render(); });
}

// ================= VENDORS =================
function renderVendors() {
  const vendors = Vendors.all();
  const meats = Meats.all();
  container.innerHTML = `
    <div class="view-header">
      <div><h2>Vendors & Economics</h2><p class="sub">Track price and quality by store so every dollar buys better meat</p></div>
      <button class="btn" id="add-vendor">＋ Add Vendor</button>
    </div>
    ${vendors.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Vendor</th><th>Location</th><th>Purchases</th><th>Total Spent</th><th>Avg $/lb</th><th>Avg Quality</th><th>Value Index</th><th></th></tr></thead>
      <tbody>${vendors.map(v => {
        const ms = meats.filter(m => m.vendorId === v.id);
        const spent = ms.reduce((s, m) => s + (Number(m.price) || 0), 0);
        const lbs = ms.reduce((s, m) => s + (Number(m.weightLbs) || 0), 0);
        const perLb = lbs ? spent / lbs : null;
        const qs = ms.filter(m => m.qualityRating).map(m => Number(m.qualityRating));
        const q = qs.length ? qs.reduce((s, x) => s + x, 0) / qs.length : null;
        const value = perLb && q ? round1(q / perLb) : null;
        return `<tr>
          <td><strong>${esc(v.name)}</strong>${v.notes ? `<br><span class="muted">${esc(v.notes)}</span>` : ''}</td>
          <td>${esc(v.location || '—')}</td>
          <td>${ms.length}</td>
          <td>${money(spent)}</td>
          <td>${perLb ? money(perLb) : '—'}</td>
          <td>${q ? round1(q) + '/10' : '—'}</td>
          <td>${value != null ? `<span class="score-pill">${value}</span>` : '—'}</td>
          <td class="flex">
            <button class="btn small secondary" data-edit="${v.id}">Edit</button>
            <button class="btn small danger" data-del="${v.id}">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="muted mt">Value Index = average quality ÷ average $/lb — higher means more quality per dollar.</p>`
    : '<div class="empty">Add the stores and butchers you buy from — the app computes $/lb and quality-per-dollar so you can shop smart.</div>'}`;

  $('#add-vendor').onclick = () => openVendorForm();
  container.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openVendorForm(Vendors.get(b.dataset.edit)));
  container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if (confirm('Delete this vendor? Meats will keep their data but lose the vendor link.')) {
      Vendors.remove(b.dataset.del); toast('Vendor deleted'); render();
    }
  });
}

function openVendorForm(vendor = null) {
  openModal(`
    <h3>${vendor ? 'Edit' : 'Add'} Vendor</h3>
    <form class="form" id="vendor-form">
      <label class="field">Name <input name="name" required placeholder="Costco, local butcher…" value="${esc(vendor?.name || '')}"></label>
      <label class="field">Location <input name="location" value="${esc(vendor?.location || '')}"></label>
      <label class="field">Notes <textarea name="notes">${esc(vendor?.notes || '')}</textarea></label>
      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
        <button class="btn">${vendor ? 'Save' : 'Add Vendor'}</button>
      </div>
    </form>`);
  $('#cancel-modal').onclick = closeModal;
  $('#vendor-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (vendor) { Vendors.update(vendor.id, f); toast('Vendor updated', 'good'); }
    else { Vendors.add(f); toast('Vendor added', 'good'); }
    closeModal(); render();
  };
}

// ================= AI INSIGHTS =================
function renderInsights() {
  const insights = computeInsights();
  const keySet = hasApiKey();
  container.innerHTML = `
    <div class="view-header">
      <div><h2>🤖 AI Insights</h2><p class="sub">Analysis of your journal — plus ask Claude anything about your smoking data</p></div>
    </div>
    <div class="grid cols-2 mb">
      ${insights.map(i => `<div class="ai-block"><h4>${i.icon} ${esc(i.title)}</h4>${i.lines.map(l => `<p>${mdBold(esc(l))}</p>`).join('')}</div>`).join('')}
    </div>
    <div class="card">
      <h3>💬 Ask Claude about your smoking journey</h3>
      ${keySet ? `
        <form class="form" id="ask-form">
          <label class="field">Your question
            <textarea name="q" placeholder="e.g. What should I smoke next weekend and how should I cook it based on what we've loved? Where should I buy the meat?"></textarea>
          </label>
          <div class="flex">
            <button class="btn">Ask Claude</button>
            <button type="button" class="btn secondary small" data-preset="What should I smoke next, and what method, pellets, and temps should I use based on our history?">Suggest my next smoke</button>
            <button type="button" class="btn secondary small" data-preset="Analyze my vendor spending — where am I getting the best quality per dollar, and what should I change?">Analyze my spending</button>
            <button type="button" class="btn secondary small" data-preset="Review my temperature management across smokes. What patterns separate our best-rated cooks from the rest?">Critique my temp control</button>
          </div>
        </form>
        <div id="ai-answer" class="mt"></div>`
      : `<p class="muted">Add your Anthropic API key in <strong>Settings</strong> to unlock conversational analysis. Your full journal (meats, temps, actions, reviews, prices) is sent to Claude so answers are grounded in your actual data. The built-in insights above work without a key.</p>
         <button class="btn secondary mt" id="go-settings">Open Settings</button>`}
    </div>`;

  if (!keySet) { $('#go-settings').onclick = () => { state.view = 'settings'; render(); }; return; }

  const form = $('#ask-form');
  const answerBox = $('#ai-answer');
  const ask = async q => {
    if (!q?.trim()) return;
    answerBox.innerHTML = '<p class="muted"><span class="spinner"></span>Claude is thinking about your smokes…</p>';
    try {
      const answer = await askClaude(q.trim());
      answerBox.innerHTML = `<div class="ai-block"><h4>🤖 Claude says</h4><div class="ai-answer">${esc(answer)}</div></div>`;
    } catch (err) {
      answerBox.innerHTML = `<div class="ai-block" style="border-color:#7a2a2a"><h4>⚠️ Error</h4><p>${esc(err.message)}</p></div>`;
    }
  };
  form.onsubmit = e => { e.preventDefault(); ask(new FormData(form).get('q')); };
  form.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
    form.querySelector('textarea').value = b.dataset.preset;
    ask(b.dataset.preset);
  });
}

// ================= SETTINGS =================
function renderSettings() {
  const s = Settings.get();
  const db = getDb();
  const isEmpty = !db.meats.length && !db.cooks.length && !db.checklist.length && !db.vendors.length;
  container.innerHTML = `
    <div class="view-header"><div><h2>Settings</h2><p class="sub">Crew, AI, and your data</p></div></div>
    <div class="grid cols-2">
      <div class="card">
        <h3>👥 Review Crew</h3>
        <p class="muted mb">People who rate your smokes. Names auto-add when someone leaves a review.</p>
        <div class="flex mb">${s.people.map(p => `<span class="probe-chip">${esc(p)} <button class="btn small ghost" data-rm-person="${esc(p)}">✕</button></span>`).join('') || '<span class="muted">No crew yet</span>'}</div>
        <form class="form" id="person-form">
          <div class="form-row">
            <label class="field">Add person <input name="name" placeholder="Name"></label>
          </div>
          <div class="form-actions"><button class="btn small">Add</button></div>
        </form>
      </div>
      <div class="card">
        <h3>🤖 Claude AI</h3>
        <p class="muted mb">Optional: add an <a href="https://console.anthropic.com/" target="_blank" rel="noopener" style="color:var(--gold)">Anthropic API key</a> to ask Claude questions grounded in your journal. Stored only in this browser's localStorage and never included in exports.</p>
        <form class="form" id="ai-form">
          <label class="field">API key <input name="apiKey" type="password" placeholder="sk-ant-…" value="${esc(s.apiKey || '')}"></label>
          <label class="field">Model <input name="model" value="${esc(s.model || 'claude-opus-4-8')}"></label>
          <div class="form-actions"><button class="btn small">Save</button></div>
        </form>
      </div>
      <div class="card">
        <h3>💾 Your Data</h3>
        <p class="muted mb">Everything lives in this browser (localStorage). Export regularly to back up or move devices.</p>
        <div class="flex">
          <button class="btn secondary" id="export-btn">⬇ Export JSON</button>
          <button class="btn secondary" id="import-btn">⬆ Import JSON</button>
          <input type="file" id="import-file" accept="application/json" style="display:none">
          <button class="btn danger" id="reset-btn">Reset everything</button>
        </div>
        ${isEmpty ? '<hr class="sep"><p class="muted mb">New here? Load a sample brisket smoke to see how everything works.</p><button class="btn" id="demo-btn">🍖 Load demo data</button>' : ''}
      </div>
    </div>`;

  $('#person-form').onsubmit = e => {
    e.preventDefault();
    const name = new FormData(e.target).get('name')?.trim();
    if (name && !s.people.includes(name)) { Settings.update({ people: [...s.people, name] }); render(); }
  };
  container.querySelectorAll('[data-rm-person]').forEach(b => b.onclick = () => {
    Settings.update({ people: s.people.filter(p => p !== b.dataset.rmPerson) }); render();
  });

  $('#ai-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    Settings.update({ apiKey: f.apiKey.trim(), model: f.model.trim() || 'claude-opus-4-8' });
    toast('AI settings saved', 'good'); render();
  };

  $('#export-btn').onclick = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smoker-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#import-btn').onclick = () => $('#import-file').click();
  $('#import-file').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      importJson(await file.text());
      toast('Data imported', 'good'); render();
    } catch (err) {
      toast('Import failed: ' + err.message, 'bad');
    }
  };
  $('#reset-btn').onclick = () => {
    if (confirm('Delete ALL data — meats, smokes, reviews, everything? This cannot be undone.')) {
      resetDb(); toast('All data cleared'); render();
    }
  };
  const demoBtn = $('#demo-btn');
  if (demoBtn) demoBtn.onclick = () => { loadDemoData(); toast('Demo data loaded — explore!', 'good'); state.view = 'dashboard'; render(); };
}

// ---------- first run ----------
render();

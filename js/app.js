// ============ Smoker AI — application UI ============

import {
  getDb, Meats, Vendors, Cooks, Reviews, Checklist, Recipes, Pellets, Settings,
  exportJson, importJson, resetDb, loadDemoData,
} from './store.js';
import { drawTempChart } from './charts.js';
import { computeInsights, analyzeCook, askClaude, hasApiKey, scanMeatLabel } from './ai.js';
import { CUT_CATALOG, CUT_ANIMALS } from './cuts.js';
import { WOOD_GUIDE } from './woods.js';
import { compressPhoto, savePhoto, getPhotos, deletePhoto } from './photos.js';
import { renderShareCard } from './share.js';
import { uid } from './store.js';
import { initSync, enableSync, disableSync, pushNow, pullNow, syncStatus, onSyncStatus } from './sync.js';

// ---------- tiny helpers ----------
const $ = sel => document.querySelector(sel);
const container = $('#view-container');

const state = { view: 'dashboard', cookId: null, cutFilter: 'All' };

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

// ---------- reminder engine ----------
// Checks active cooks' reminders every 15s while the app is open.
// Fires a toast and (if permitted) a browser notification.
function checkReminders() {
  const now = Date.now();
  for (const cook of Cooks.all()) {
    if (cook.status !== 'active' || !cook.reminders?.length) continue;
    let changed = false;
    for (const r of cook.reminders) {
      if (!r.enabled || !r.nextDue || r.nextDue > now) continue;
      const meatName = Meats.get(cook.meatId)?.name || 'your smoke';
      toast(`⏰ ${r.label} — ${meatName}`, 'good');
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('🔥 Smoker AI', { body: `${r.label} — ${meatName}` }); } catch { /* ignore */ }
      }
      if (r.once) r.enabled = false;
      else r.nextDue = now + r.intervalMin * 60e3;
      changed = true;
    }
    if (changed) {
      Cooks.update(cook.id, { reminders: cook.reminders });
      if (state.view === 'cooks' && state.cookId === cook.id) render();
    }
  }
}
setInterval(checkReminders, 15000);

function requestNotifyPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

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
    cutlibrary: renderCutLibrary,
    recipes: renderRecipes,
    pellets: renderPellets,
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
    ${!meat ? `
    <div class="scan-box">
      <button type="button" class="btn secondary" id="scan-label" ${hasApiKey() ? '' : 'disabled'}>📷 Scan package label with AI</button>
      <input type="file" id="scan-file" accept="image/*" capture="environment" style="display:none">
      <span class="muted" id="scan-status">${hasApiKey()
        ? 'Snap or upload a photo of the label — Claude fills in the cut, weight, and price.'
        : 'Add an API key in Settings to enable label scanning.'}</span>
    </div>` : ''}
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
  const scanBtn = $('#scan-label');
  if (scanBtn) {
    const fileInput = $('#scan-file');
    const status = $('#scan-status');
    scanBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      scanBtn.disabled = true;
      status.innerHTML = '<span class="spinner"></span>Reading the label…';
      try {
        const r = await scanMeatLabel(file);
        const form = $('#meat-form');
        if (r.name) form.name.value = r.name;
        if (r.type && MEAT_TYPES.includes(r.type)) form.type.value = r.type;
        if (r.cut) form.cut.value = r.cut;
        if (r.grade && GRADES.includes(r.grade)) form.grade.value = r.grade;
        if (r.weightLbs != null) form.weightLbs.value = r.weightLbs;
        if (r.price != null) form.price.value = r.price;
        if (r.notes) form.notes.value = r.notes;
        status.textContent = '✅ Label read — double-check the values, then save.';
        toast('Label scanned', 'good');
      } catch (err) {
        status.textContent = `⚠️ ${err.message}`;
      } finally {
        scanBtn.disabled = false;
        fileInput.value = '';
      }
    };
  }
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
      <div class="flex">
        <button class="btn secondary" id="plan-cook">🗓️ Plan a Cook</button>
        <button class="btn" id="add-cook">💨 New Smoke</button>
      </div>
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
  $('#plan-cook').onclick = () => openPlannerModal();
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
        <label class="field">Pellet brand
          <input name="pelletBrand" list="cook-pellet-brands" placeholder="Lumber Jack, Traeger…" value="${esc(cook?.pelletBrand || '')}">
          <datalist id="cook-pellet-brands">${[...new Set(Pellets.all().map(p => p.brand).filter(Boolean))].map(b => `<option>${esc(b)}</option>`).join('')}</datalist>
        </label>
        <label class="field">Pellet flavor
          <input name="pelletFlavor" list="cook-pellet-flavors" placeholder="Hickory, Cherry…" value="${esc(cook?.pelletFlavor || '')}">
          <datalist id="cook-pellet-flavors">${[...new Set(Pellets.all().map(p => p.flavor).filter(Boolean))].map(f => `<option>${esc(f)}</option>`).join('')}</datalist>
        </label>
        <label class="field">Pellets used (lbs) <input name="pelletLbs" type="number" step="0.5" min="0" value="${cook?.pelletLbs ?? ''}"></label>
      </div>
      ${Recipes.all().length ? `
      <label class="field">Rubs & sauces used
        <div class="recipe-checks">
          ${Recipes.all().map(r => `
            <label class="recipe-check">
              <input type="checkbox" name="recipeIds" value="${r.id}" ${(cook?.recipeIds || []).includes(r.id) ? 'checked' : ''}>
              ${esc(r.name)} <span class="muted">(${esc(r.type)})</span>
            </label>`).join('')}
        </div>
      </label>` : ''}
      <div class="form-row">
        <label class="field">Target grill temp (°F) <input name="targetGrillTemp" type="number" min="0" value="${cook?.targetGrillTemp ?? 250}"></label>
        <label class="field">Target internal temp (°F) <input name="targetInternalTemp" type="number" min="0" value="${cook?.targetInternalTemp ?? 203}"></label>
        <label class="field">Serving how many? <input name="servings" type="number" min="1" step="1" placeholder="e.g. 8" value="${cook?.servings ?? ''}"></label>
      </div>
      <div class="form-row" style="align-items:end">
        <label class="field">Outside temp (°F) <input name="weatherTempF" type="number" step="1" value="${cook?.weather?.tempF ?? ''}"></label>
        <label class="field">Wind (mph) <input name="weatherWindMph" type="number" step="1" min="0" value="${cook?.weather?.windMph ?? ''}"></label>
        <label class="field">Humidity (%) <input name="weatherHumidity" type="number" step="1" min="0" max="100" value="${cook?.weather?.humidity ?? ''}"></label>
        <label class="field">Conditions
          <select name="weatherConditions">
            ${['', 'Sunny', 'Partly cloudy', 'Cloudy', 'Rain', 'Snow', 'Windy', 'Fog'].map(c => `<option ${cook?.weather?.conditions === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="btn small secondary" id="fetch-weather" title="Uses your location and open-meteo.com">🌤️ Auto-fill weather</button>
      </div>
      <label class="field">Notes <textarea name="notes">${esc(cook?.notes || '')}</textarea></label>
      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
        <button class="btn">${cook ? 'Save' : 'Create & Open'}</button>
      </div>
    </form>`);
  $('#cancel-modal').onclick = closeModal;
  $('#fetch-weather').onclick = () => {
    const btn = $('#fetch-weather');
    if (!navigator.geolocation) { toast('Geolocation not available in this browser', 'bad'); return; }
    btn.disabled = true; btn.textContent = '⏳ Locating…';
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const { latitude, longitude } = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`
          + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
          + '&temperature_unit=fahrenheit&wind_speed_unit=mph';
        const cur = (await (await fetch(url)).json()).current;
        const form = $('#cook-form');
        form.weatherTempF.value = Math.round(cur.temperature_2m);
        form.weatherWindMph.value = Math.round(cur.wind_speed_10m);
        form.weatherHumidity.value = Math.round(cur.relative_humidity_2m);
        const code = cur.weather_code;
        form.weatherConditions.value =
          code === 0 ? 'Sunny' : code <= 2 ? 'Partly cloudy' : code === 3 ? 'Cloudy'
          : (code >= 45 && code <= 48) ? 'Fog' : (code >= 71 && code <= 77) ? 'Snow'
          : (code >= 51 && code <= 99) ? 'Rain' : 'Cloudy';
        btn.textContent = '✅ Weather filled';
      } catch {
        toast('Could not fetch weather — fill it in manually', 'bad');
        btn.textContent = '🌤️ Auto-fill weather'; btn.disabled = false;
      }
    }, () => {
      toast('Location permission denied — fill weather in manually', 'bad');
      btn.textContent = '🌤️ Auto-fill weather'; btn.disabled = false;
    }, { timeout: 10000 });
  };
  $('#cook-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const data = {
      ...f,
      pelletLbs: num(f.pelletLbs),
      targetGrillTemp: num(f.targetGrillTemp),
      targetInternalTemp: num(f.targetInternalTemp),
      servings: num(f.servings),
      weather: {
        tempF: num(f.weatherTempF),
        windMph: num(f.weatherWindMph),
        humidity: num(f.weatherHumidity),
        conditions: f.weatherConditions || '',
      },
      recipeIds: [...e.target.querySelectorAll('[name="recipeIds"]:checked')].map(cb => cb.value),
    };
    delete data.weatherTempF; delete data.weatherWindMph; delete data.weatherHumidity; delete data.weatherConditions;
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

// ---- Cook Planner: work backward from serving time ----
function parseCookHours(timeStr) {
  // "12–18 hrs" -> 15, "~1 hr" -> 1, "20–30 min" -> 0.42, "1.5–2 hrs" -> 1.75
  const nums = (timeStr.match(/[\d.]+/g) || []).map(Number);
  if (!nums.length) return null;
  const mid = nums.reduce((s, n) => s + n, 0) / nums.length;
  return /min/i.test(timeStr) ? mid / 60 : mid;
}

function openPlannerModal() {
  const inventory = Meats.all().filter(m => m.status === 'inventory');
  const defaultServe = new Date(Date.now() + 24 * 3600e3);
  defaultServe.setHours(18, 0, 0, 0);
  openModal(`
    <h3>🗓️ Plan a Cook</h3>
    <p class="muted mb">Pick what and when you're serving — the planner works backward to tell you when to thaw, season, fire up, wrap, and rest.</p>
    <form class="form" id="planner-form">
      <div class="form-row">
        <label class="field">Cut
          <select name="cutId">
            ${CUT_CATALOG.map(c => `<option value="${c.id}">${esc(c.name)} (${esc(c.time)})</option>`).join('')}
            <option value="custom">Custom…</option>
          </select>
        </label>
        <label class="field">Weight (lbs) <input name="weightLbs" type="number" step="0.5" min="0.5" value="10"></label>
        <label class="field" id="custom-hours-field" style="display:none">Cook hours <input name="customHours" type="number" step="0.5" min="0.5" value="8"></label>
      </div>
      <div class="form-row">
        <label class="field">Serving at <input name="serveAt" type="datetime-local" value="${localDatetime(defaultServe.getTime())}"></label>
        ${inventory.length ? `
        <label class="field">Link a meat from inventory (optional)
          <select name="meatId"><option value="">— none —</option>
            ${inventory.map(m => `<option value="${m.id}">${esc(m.name)} (${m.weightLbs || '?'} lbs)</option>`).join('')}
          </select>
        </label>` : ''}
      </div>
      <div class="form-actions"><button class="btn">Build schedule</button></div>
    </form>
    <div id="planner-result"></div>`);

  const form = $('#planner-form');
  form.cutId.onchange = () => {
    $('#custom-hours-field').style.display = form.cutId.value === 'custom' ? '' : 'none';
  };
  form.onsubmit = e => {
    e.preventDefault();
    const cut = CUT_CATALOG.find(c => c.id === form.cutId.value);
    const weight = Number(form.weightLbs.value) || 10;
    const serveAt = new Date(form.serveAt.value).getTime();
    if (!serveAt) { toast('Pick a serving time', 'bad'); return; }
    const hours = cut ? parseCookHours(cut.time) : Number(form.customHours.value);
    if (!hours) { toast('Could not determine cook time', 'bad'); return; }

    const restMin = hours >= 6 ? 60 : 30;
    const restStart = serveAt - restMin * 60e3;
    const meatOn = restStart - hours * 3600e3;
    const fireUp = meatOn - 45 * 60e3;
    const season = hours >= 8 ? meatOn - 12 * 3600e3 : meatOn - 60 * 60e3;
    const thawDays = Math.ceil(weight / 5);
    const thawStart = meatOn - thawDays * 24 * 3600e3;

    const fmtSched = ts => new Date(ts).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const steps = [
      { t: thawStart, icon: '🧊', label: `Move to fridge to thaw (~${thawDays} day${thawDays > 1 ? 's' : ''} for ${weight} lbs — skip if fresh)` },
      { t: season, icon: '🧂', label: hours >= 8 ? 'Trim & season (overnight dry brine recommended)' : 'Trim & season' },
      { t: fireUp, icon: '🔥', label: `Fire up the smoker${cut ? ` — target ${cut.pitTemp}°F` : ''}` },
      { t: meatOn, icon: '🥩', label: 'Meat on!' },
      ...(hours >= 6 ? [{ t: meatOn + hours * 3600e3 * 0.55, icon: '📦', label: 'Expect the stall — wrap window (~165°F internal)' }] : []),
      { t: restStart, icon: '🛌', label: `Pull${cut ? ` at ${cut.internalTemp}°F internal` : ''} & rest ${restMin} min (wrapped, in a cooler)` },
      { t: serveAt, icon: '🍽️', label: 'Serve & accept the applause' },
    ].sort((a, b) => a.t - b.t);

    const scheduleText = steps.map(s => `${fmtSched(s.t)} — ${s.icon} ${s.label}`).join('\n');
    $('#planner-result').innerHTML = `
      <hr class="sep">
      <h3 style="color:var(--gold)">Your schedule${cut ? ` — ${esc(cut.name)}` : ''}</h3>
      <ul class="timeline" style="max-height:none">
        ${steps.map(s => `<li><span class="t-time">${fmtSched(s.t)}</span><span class="t-type">${s.icon}</span><span>${esc(s.label)}</span></li>`).join('')}
      </ul>
      <div class="form-actions mt">
        <button class="btn" id="save-plan">💾 Save as planned smoke</button>
      </div>`;
    $('#save-plan').onclick = () => {
      const meatId = form.meatId?.value || '';
      const created = Cooks.add({
        meatId, date: new Date(meatOn).toISOString().slice(0, 10),
        method: cut?.method || 'Low & Slow',
        pelletBrand: '', pelletFlavor: '', pelletLbs: null,
        targetGrillTemp: cut?.pitTemp ?? 250, targetInternalTemp: cut?.internalTemp ?? 203,
        probes: [], readings: [], actions: [], reminders: [], recipeIds: [], photoIds: [],
        startTime: null, endTime: null, status: 'planned',
        notes: `📋 PLAN — ${cut?.name || 'Custom cook'} (${weight} lbs)\n${scheduleText}`,
      });
      Cooks.addProbe(created.id, 'Grill Temp', PROBE_COLORS[0]);
      Cooks.addProbe(created.id, 'Meat Probe 1', PROBE_COLORS[1]);
      closeModal();
      state.view = 'cooks'; state.cookId = created.id;
      toast('Planned smoke created 🗓️', 'good');
      render();
    };
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
        <p class="sub">${esc(cook.method || '')} · ${fmtDate(cook.date)} · ${esc([cook.pelletBrand, cook.pelletFlavor].filter(Boolean).join(' — ') || 'pellets not logged')}${cook.pelletLbs ? ` · ${cook.pelletLbs} lbs pellets` : ''}${(cook.recipeIds || []).length ? ` · 🧂 ${esc((cook.recipeIds || []).map(rid => Recipes.get(rid)?.name).filter(Boolean).join(', '))}` : ''}</p>
      </div>
      <div class="flex">
        <button class="btn secondary small" id="back-cooks">← All smokes</button>
        <button class="btn secondary small" id="edit-cook">Edit details</button>
        <button class="btn secondary small" id="share-cook">📤 Share card</button>
        ${cook.status === 'planned' ? '<button class="btn small" id="start-cook">🔥 Start Smoke</button>' : ''}
        ${cook.status === 'active' ? '<button class="btn small" id="finish-cook">🏁 Finish Smoke</button>' : ''}
      </div>
    </div>
    ${cook.weather && (cook.weather.tempF != null || cook.weather.conditions) ? `
      <p class="muted" style="margin:-.6rem 0 .9rem">🌤️ ${esc([cook.weather.conditions, cook.weather.tempF != null ? cook.weather.tempF + '°F' : null, cook.weather.windMph != null ? cook.weather.windMph + ' mph wind' : null, cook.weather.humidity != null ? cook.weather.humidity + '% humidity' : null].filter(Boolean).join(' · '))}</p>` : ''}

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
          <div class="form-actions">
            <button type="button" class="btn small secondary" id="import-csv-btn" title="Import a CSV export from a Meater, Fireboard, ThermoWorks or similar thermometer">📥 Import thermometer CSV</button>
            <input type="file" id="import-csv-file" accept=".csv,text/csv" style="display:none">
            <button class="btn small" ${cook.probes?.length ? '' : 'disabled'}>Log reading</button>
          </div>
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
        <h3>⏰ Reminders ${cook.status === 'active' ? '' : '<span class="muted">(fire while the smoke is active)</span>'}</h3>
        <ul class="timeline" style="max-height:180px">
          ${(cook.reminders || []).map(r => `
            <li>
              <span class="t-type">${r.enabled ? '🔔' : '🔕'}</span>
              <span style="flex:1">${esc(r.label)} <span class="muted">${r.once ? 'once' : `every ${r.intervalMin} min`}${r.enabled && r.nextDue ? ` · next ${fmtTime(r.nextDue)}` : ''}</span></span>
              <button class="btn small ghost" data-toggle-reminder="${r.id}">${r.enabled ? 'Pause' : 'Resume'}</button>
              <button class="btn small ghost" data-del-reminder="${r.id}">✕</button>
            </li>`).join('') || '<li class="muted" style="border:none;background:none">No reminders — add "spritz every 45 min" or "check wrap in 2 hours". They fire as notifications while the app is open.</li>'}
        </ul>
        <form class="form" id="reminder-form" style="margin-top:.5rem">
          <div class="form-row" style="align-items:end">
            <label class="field">Reminder <input name="label" required placeholder="💦 Spritz the brisket"></label>
            <label class="field">Every / in (min) <input name="intervalMin" type="number" min="1" step="1" value="45" required></label>
            <label class="field" style="flex:0 0 auto"><span>&nbsp;</span>
              <select name="mode"><option value="repeat">repeating</option><option value="once">one-time</option></select>
            </label>
            <button class="btn small" style="align-self:end">Add</button>
          </div>
        </form>
      </div>
      <div class="card">
        <h3>📸 Photo Journal <span class="muted" id="photo-count"></span></h3>
        <div class="photo-grid" id="photo-grid"><span class="muted">Loading…</span></div>
        <div class="flex mt">
          <button class="btn small secondary" id="add-photo-btn">📷 Add photo</button>
          <input type="file" id="add-photo-file" accept="image/*" capture="environment" style="display:none">
          <span class="muted" style="font-size:.75rem">Bark shots, smoke rings, plated glory — stored on this device.</span>
        </div>
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

  // ---- reminders ----
  $('#reminder-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const intervalMin = Math.max(1, Number(f.intervalMin));
    const reminders = [...(cook.reminders || []), {
      id: uid(), label: f.label.trim(), intervalMin,
      once: f.mode === 'once', enabled: true, nextDue: Date.now() + intervalMin * 60e3,
    }];
    Cooks.update(cook.id, { reminders });
    requestNotifyPermission();
    toast('Reminder set ⏰', 'good'); render();
  };
  container.querySelectorAll('[data-toggle-reminder]').forEach(b => b.onclick = () => {
    const r = (cook.reminders || []).find(x => x.id === b.dataset.toggleReminder);
    if (r) {
      r.enabled = !r.enabled;
      if (r.enabled) r.nextDue = Date.now() + r.intervalMin * 60e3;
      Cooks.update(cook.id, { reminders: cook.reminders });
      render();
    }
  });
  container.querySelectorAll('[data-del-reminder]').forEach(b => b.onclick = () => {
    Cooks.update(cook.id, { reminders: (cook.reminders || []).filter(x => x.id !== b.dataset.delReminder) });
    render();
  });

  // ---- photo journal ----
  const photoGrid = $('#photo-grid');
  const renderPhotos = async () => {
    const photos = await getPhotos(cook.photoIds || []);
    $('#photo-count').textContent = photos.length ? `(${photos.length})` : '';
    photoGrid.innerHTML = photos.length ? photos.map(p => `
      <figure class="photo-item">
        <img src="${p.dataUrl}" alt="cook photo" data-view-photo="${p.id}">
        <figcaption>${esc(p.caption || '')}</figcaption>
        <button class="btn small ghost photo-del" data-del-photo="${p.id}">✕</button>
      </figure>`).join('') : '<span class="muted">No photos yet.</span>';
    photoGrid.querySelectorAll('[data-del-photo]').forEach(b => b.onclick = async () => {
      await deletePhoto(b.dataset.delPhoto);
      Cooks.update(cook.id, { photoIds: (cook.photoIds || []).filter(id => id !== b.dataset.delPhoto) });
      renderPhotos();
    });
    photoGrid.querySelectorAll('[data-view-photo]').forEach(img => img.onclick = () => {
      openModal(`<img src="${img.src}" style="max-width:100%;border-radius:10px">`);
    });
  };
  renderPhotos();
  $('#add-photo-btn').onclick = () => $('#add-photo-file').click();
  $('#add-photo-file').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressPhoto(file);
      const caption = prompt('Caption (optional):') || '';
      const id = uid();
      await savePhoto(id, dataUrl, caption);
      Cooks.update(cook.id, { photoIds: [...(cook.photoIds || []), id] });
      toast('Photo added 📸', 'good');
      renderPhotos();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      e.target.value = '';
    }
  };

  // ---- thermometer CSV import ----
  $('#import-csv-btn').onclick = () => $('#import-csv-file').click();
  $('#import-csv-file').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const summary = importThermometerCsv(cook, await file.text());
      toast(summary, 'good'); render();
    } catch (err) {
      toast(`CSV import failed: ${err.message}`, 'bad');
    } finally {
      e.target.value = '';
    }
  };

  // ---- share card ----
  $('#share-cook').onclick = async () => {
    const btn = $('#share-cook');
    btn.disabled = true; btn.textContent = '⏳ Rendering…';
    try {
      const photos = await getPhotos(cook.photoIds || []);
      const blob = await renderShareCard(cook, photos[0]?.dataUrl);
      const filename = `smoke-${(meat?.name || 'cook').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cook.date || 'card'}.png`;
      const scoreBit = avgScore != null ? ` — ${round1(avgScore)}/10 crew score` : '';
      const shareText = `${meat?.name || 'A smoke'}${scoreBit}, ${cook.method || 'smoked'} on the pellet grill 🔥 #BBQ`;

      // 1) Native share sheet (phones/tablets): post straight to Instagram,
      //    Facebook, X, Messages, etc.
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Smoker AI', text: shareText });
          toast('Shared 📤', 'good');
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // user closed the sheet
          // fall through to clipboard/download
        }
      }

      // 2) Desktop fallback: copy to clipboard (paste into any post) + download
      let copied = false;
      try {
        if (navigator.clipboard?.write && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copied = true;
        }
      } catch { /* clipboard unavailable — download still happens */ }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(copied
        ? 'Card downloaded + copied to clipboard — paste it straight into your post 📤'
        : 'Share card downloaded 📤', 'good');
    } catch (err) {
      toast(`Could not render card: ${err.message}`, 'bad');
    } finally {
      btn.disabled = false; btn.textContent = '📤 Share card';
    }
  };
}

// Parse a thermometer CSV export and merge readings into the cook.
// Expected shape: first column = time (ISO datetime, epoch, or elapsed sec/min),
// each additional numeric column = one probe (named by its header).
function importThermometerCsv(cook, text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('file has no data rows');
  const delim = [',', ';', '\t'].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const headers = lines[0].split(delim).map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(l => l.split(delim).map(c => c.replace(/^"|"$/g, '').trim()));

  // resolve timestamps
  const base = cook.startTime || Date.now();
  const parseTime = v => {
    if (/^\d+(\.\d+)?$/.test(v)) {
      const n = Number(v);
      if (n > 1e12) return n;               // epoch ms
      if (n > 1e9) return n * 1000;         // epoch seconds
      const maxRaw = Number(rows[rows.length - 1][0]);
      return base + (maxRaw > 720 ? n * 1000 : n * 60e3); // elapsed sec vs min
    }
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    throw new Error(`unrecognized time value "${v}"`);
  };

  // map each temp column to a probe (create by header name if missing)
  const probeForCol = {};
  for (let col = 1; col < headers.length; col++) {
    const sample = rows.find(r => r[col] && r[col] !== '')?.[col];
    if (sample == null || Number.isNaN(Number(sample))) continue;
    const name = headers[col] || `Probe ${col}`;
    let probe = (cook.probes || []).find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!probe) probe = Cooks.addProbe(cook.id, name, PROBE_COLORS[(cook.probes || []).length % PROBE_COLORS.length]);
    probeForCol[col] = probe.id;
  }
  if (!Object.keys(probeForCol).length) throw new Error('no numeric temperature columns found');

  const newReadings = [];
  for (const r of rows) {
    if (!r[0]) continue;
    const ts = parseTime(r[0]);
    for (const [col, probeId] of Object.entries(probeForCol)) {
      const v = Number(r[col]);
      if (!Number.isNaN(v) && r[col] !== '') newReadings.push({ ts, probeId, temp: v });
    }
  }
  const readings = [...(cook.readings || []), ...newReadings].sort((a, b) => a.ts - b.ts);
  Cooks.update(cook.id, { readings });
  return `Imported ${newReadings.length} readings across ${Object.keys(probeForCol).length} probe(s) 📥`;
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
      <div class="flex">
        <button class="btn secondary" id="browse-cuts">📚 Browse Cut Library</button>
        <button class="btn" id="add-item">＋ Add to list</button>
      </div>
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
  $('#browse-cuts').onclick = () => { state.view = 'cutlibrary'; render(); };
}

// ================= CUT LIBRARY =================
function checklistEntryFor(cutName) {
  const target = cutName.trim().toLowerCase();
  return Checklist.all().find(i => i.name.trim().toLowerCase() === target) || null;
}

function renderCutLibrary() {
  if (state.cutMode === 'woods') return renderWoodGuide();
  const filters = ['All', ...CUT_ANIMALS];
  const cuts = state.cutFilter === 'All'
    ? CUT_CATALOG
    : CUT_CATALOG.filter(c => c.animal === state.cutFilter);
  const statusLabel = { love: '❤️ On your "We Love" list', try: '🎯 On your "Want to Try" list', tried: '✅ Already tried' };

  container.innerHTML = `
    <div class="view-header">
      <div><h2>📚 Cut Library</h2><p class="sub">${CUT_CATALOG.length} classic smoking cuts across every animal — tap one onto your want-to-try list</p></div>
      <button class="btn secondary" id="to-woods">🌳 Wood Pairing Guide</button>
    </div>
    <div class="filter-chips">
      ${filters.map(f => `<button class="filter-chip ${state.cutFilter === f ? 'active' : ''}" data-filter="${esc(f)}">${esc(f)}${f !== 'All' ? ` (${CUT_CATALOG.filter(c => c.animal === f).length})` : ''}</button>`).join('')}
    </div>
    <div class="cut-grid">
      ${cuts.map(c => {
        const entry = checklistEntryFor(c.name);
        return `
        <div class="cut-card">
          <div class="cut-photo">
            <img src="assets/cuts/${c.id}.jpg" alt="${esc(c.name)}" loading="lazy"
                 onerror="this.parentElement.insertAdjacentHTML('afterbegin', '<span class=&quot;cut-emoji-fallback&quot;>${c.emoji}</span>'); this.remove()">
            <span class="cut-animal-tag">${esc(c.animal)}</span>
          </div>
          <div class="cut-body">
            <div class="flex spread">
              <h4>${esc(c.name)}</h4>
              <span class="diff-pill diff-${c.difficulty}">${c.difficulty}</span>
            </div>
            <div class="cut-stats">
              <span class="cut-stat">🔥 <strong>${c.pitTemp}°F</strong> pit</span>
              <span class="cut-stat">🌡️ <strong>${c.internalTemp}°F</strong> internal</span>
              <span class="cut-stat">⏱️ <strong>${esc(c.time)}</strong></span>
              <span class="cut-stat">${esc(c.method)}</span>
            </div>
            <p class="cut-blurb">${esc(c.blurb)}</p>
            ${entry
              ? `<div class="on-list-note">${statusLabel[entry.status] || '✓ On your checklist'}</div>`
              : `<div class="cut-actions"><button class="btn small" data-try="${c.id}">🎯 Want to try</button></div>`}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  $('#to-woods').onclick = () => { state.cutMode = 'woods'; render(); };
  container.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
    state.cutFilter = b.dataset.filter;
    render();
  });
  container.querySelectorAll('[data-try]').forEach(b => b.onclick = () => {
    const cut = CUT_CATALOG.find(c => c.id === b.dataset.try);
    if (!cut || checklistEntryFor(cut.name)) return;
    Checklist.add({
      name: cut.name,
      status: 'try',
      notes: `${cut.method} · ${cut.pitTemp}°F pit → ${cut.internalTemp}°F internal · ${cut.time}`,
    });
    toast(`${cut.name} added to Want to Try 🎯`, 'good');
    render();
  });
}

function renderWoodGuide() {
  // per-wood: your average cook score where the pellet flavor/brand mentions this wood
  const done = Cooks.all().filter(c => c.status === 'done');
  const scoreFor = wood => {
    const key = wood.name.split(' ')[0].toLowerCase();
    const scores = done
      .filter(c => `${c.pelletFlavor || ''} ${c.pelletBrand || ''}`.toLowerCase().includes(key))
      .map(c => Reviews.avgForCook(c.id))
      .filter(v => v != null);
    return scores.length ? { avg: scores.reduce((s, v) => s + v, 0) / scores.length, n: scores.length } : null;
  };

  container.innerHTML = `
    <div class="view-header">
      <div><h2>🌳 Wood Pairing Guide</h2><p class="sub">Which smoke wood for which meat — with your own scores where you've burned it</p></div>
      <button class="btn secondary" id="to-cuts">📚 Cut Library</button>
    </div>
    <div class="grid cols-2">
      ${WOOD_GUIDE.map(w => {
        const mine = scoreFor(w);
        return `
        <div class="card">
          <div class="flex spread">
            <h3>${w.emoji} ${esc(w.name)}</h3>
            <span class="flex">
              <span class="strength-dots" title="Smoke strength ${w.strength}/5">${'●'.repeat(w.strength)}${'○'.repeat(5 - w.strength)}</span>
              ${mine ? `<span class="score-pill ${mine.avg >= 8 ? 'high' : ''}" title="Your average across ${mine.n} smoke(s)">you: ★ ${round1(mine.avg)}/10</span>` : ''}
            </span>
          </div>
          <p style="font-size:.87rem;margin:.3rem 0">${esc(w.flavor)}</p>
          <div class="cut-stats" style="margin:.4rem 0">${w.pairs.map(p => `<span class="cut-stat">${esc(p)}</span>`).join('')}</div>
          <p class="muted" style="font-size:.8rem">💡 ${esc(w.tip)}</p>
        </div>`;
      }).join('')}
    </div>
    <p class="muted mt">Strength dots = smoke intensity (● mild → bold). Your score appears once a finished smoke's pellet brand or flavor mentions the wood.</p>`;

  $('#to-cuts').onclick = () => { state.cutMode = 'cuts'; render(); };
}

// ================= RUBS & SAUCES =================
const RECIPE_TYPES = ['Rub', 'Sauce', 'Marinade', 'Brine', 'Glaze', 'Injection'];

function renderRecipes() {
  const recipes = [...Recipes.all()].sort((a, b) => (Recipes.avgScore(b) ?? -1) - (Recipes.avgScore(a) ?? -1));
  const people = Settings.get().people;
  const cooksUsing = id => Cooks.all().filter(c => (c.recipeIds || []).includes(id)).length;

  container.innerHTML = `
    <div class="view-header">
      <div><h2>🧂 Rubs & Sauces</h2><p class="sub">Your recipe book — ingredients, measurements, and the crew's verdict on each</p></div>
      <button class="btn" id="add-recipe">＋ New Recipe</button>
    </div>
    ${recipes.length ? `<div class="grid cols-2">
      ${recipes.map(r => {
        const avgScore = Recipes.avgScore(r);
        const used = cooksUsing(r.id);
        return `
        <div class="card">
          <div class="flex spread">
            <h3>${esc(r.name)} <span class="badge try">${esc(r.type)}</span></h3>
            <span class="flex">
              ${scorePill(avgScore, (r.ratings || []).length)}
              <button class="btn small secondary" data-edit-recipe="${r.id}">Edit</button>
              <button class="btn small danger" data-del-recipe="${r.id}">✕</button>
            </span>
          </div>
          ${(r.ingredients || []).length ? `
            <table class="ingredients-table">
              ${(r.ingredients || []).map(i => `<tr><td class="ing-amount">${esc(i.amount)}</td><td>${esc(i.item)}</td></tr>`).join('')}
            </table>` : '<p class="muted">No ingredients listed yet.</p>'}
          ${r.instructions ? `<p class="recipe-instructions">📋 ${esc(r.instructions)}</p>` : ''}
          ${r.notes ? `<p class="muted" style="margin-top:.3rem">${esc(r.notes)}</p>` : ''}
          ${used ? `<p class="muted" style="margin-top:.3rem">💨 Used on ${used} smoke${used > 1 ? 's' : ''}</p>` : ''}
          <hr class="sep">
          ${(r.ratings || []).map(x => `
            <div class="flex spread" style="padding:.25rem 0;font-size:.85rem">
              <span><strong>${esc(x.reviewer)}</strong> <span class="stars">${'★'.repeat(Math.round(x.score / 2))}</span> ${x.score}/10
                ${x.comments ? `— <span class="muted">${esc(x.comments)}</span>` : ''}</span>
              <button class="btn small ghost" data-del-rating="${r.id}:${x.id}">✕</button>
            </div>`).join('')}
          <form class="form" data-rating-form="${r.id}" style="margin-top:.4rem">
            <div class="form-row">
              <label class="field">Reviewer
                <input name="reviewer" required list="people-list-r" placeholder="Who's rating?">
              </label>
              <label class="field">Score (1–10) <input name="score" type="number" min="1" max="10" step="0.5" required></label>
            </div>
            <label class="field">Comments <input name="comments" placeholder="Too salty? Perfect heat?"></label>
            <div class="form-actions"><button class="btn small">Rate it</button></div>
          </form>
        </div>`;
      }).join('')}
    </div>
    <datalist id="people-list-r">${people.map(p => `<option>${esc(p)}</option>`).join('')}</datalist>`
    : '<div class="empty">No rubs or sauces yet. Save your secret recipes — ingredients, measurements, and all — and let the crew rate them.</div>'}`;

  $('#add-recipe').onclick = () => openRecipeForm();
  container.querySelectorAll('[data-edit-recipe]').forEach(b => b.onclick = () => openRecipeForm(Recipes.get(b.dataset.editRecipe)));
  container.querySelectorAll('[data-del-recipe]').forEach(b => b.onclick = () => {
    if (confirm('Delete this recipe and its ratings?')) { Recipes.remove(b.dataset.delRecipe); toast('Recipe deleted'); render(); }
  });
  container.querySelectorAll('[data-del-rating]').forEach(b => b.onclick = () => {
    const [rid, ratingId] = b.dataset.delRating.split(':');
    Recipes.removeRating(rid, ratingId); render();
  });
  container.querySelectorAll('[data-rating-form]').forEach(form => form.onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    Recipes.addRating(form.dataset.ratingForm, { reviewer: f.reviewer.trim(), score: Number(f.score), comments: f.comments });
    const ppl = Settings.get().people;
    if (f.reviewer.trim() && !ppl.includes(f.reviewer.trim())) Settings.update({ people: [...ppl, f.reviewer.trim()] });
    toast('Rating added', 'good'); render();
  });
}

function ingredientRowHtml(i = { item: '', amount: '' }) {
  return `<div class="form-row ingredient-row">
    <label class="field" style="flex:0 0 130px">Amount <input name="ing-amount" placeholder="2 tbsp" value="${esc(i.amount)}"></label>
    <label class="field">Ingredient <input name="ing-item" placeholder="Smoked paprika" value="${esc(i.item)}"></label>
    <button type="button" class="btn small ghost remove-ing" title="Remove" style="align-self:end">✕</button>
  </div>`;
}

function openRecipeForm(recipe = null) {
  const rows = (recipe?.ingredients?.length ? recipe.ingredients : [{}, {}, {}]).map(i => ingredientRowHtml(i)).join('');
  openModal(`
    <h3>${recipe ? 'Edit' : 'New'} Recipe</h3>
    <form class="form" id="recipe-form">
      <div class="form-row">
        <label class="field">Name <input name="name" required placeholder="e.g. Sweet Heat Rib Rub" value="${esc(recipe?.name || '')}"></label>
        <label class="field">Type
          <select name="type">${RECIPE_TYPES.map(t => `<option ${recipe?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>
      </div>
      <div id="ingredient-rows">${rows}</div>
      <button type="button" class="btn small secondary" id="add-ingredient">＋ Add ingredient</button>
      <label class="field">Instructions <textarea name="instructions" placeholder="Mix, rest, apply…">${esc(recipe?.instructions || '')}</textarea></label>
      <label class="field">Notes <input name="notes" placeholder="Origin, tweaks to try…" value="${esc(recipe?.notes || '')}"></label>
      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
        <button class="btn">${recipe ? 'Save' : 'Add Recipe'}</button>
      </div>
    </form>`);
  $('#cancel-modal').onclick = closeModal;
  const rowsBox = $('#ingredient-rows');
  const bindRemove = () => rowsBox.querySelectorAll('.remove-ing').forEach(b => b.onclick = () => b.parentElement.remove());
  bindRemove();
  $('#add-ingredient').onclick = () => {
    rowsBox.insertAdjacentHTML('beforeend', ingredientRowHtml());
    bindRemove();
  };
  $('#recipe-form').onsubmit = e => {
    e.preventDefault();
    const form = e.target;
    const ingredients = [...rowsBox.querySelectorAll('.ingredient-row')].map(row => ({
      amount: row.querySelector('[name="ing-amount"]').value.trim(),
      item: row.querySelector('[name="ing-item"]').value.trim(),
    })).filter(i => i.item);
    const data = {
      name: form.name.value.trim(),
      type: form.type.value,
      ingredients,
      instructions: form.instructions.value.trim(),
      notes: form.notes.value.trim(),
    };
    if (recipe) { Recipes.update(recipe.id, data); toast('Recipe updated', 'good'); }
    else { Recipes.add(data); toast('Recipe added', 'good'); }
    closeModal(); render();
  };
}

// ================= PELLETS =================
function renderPellets() {
  const pellets = [...Pellets.all()].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
  const totalLbs = pellets.reduce((s, p) => s + (Number(p.weightLbs) || 0), 0);
  const totalSpent = pellets.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const blended = Pellets.blendedPricePerLb();
  const burned = Cooks.all().reduce((s, c) => s + (Number(c.pelletLbs) || 0), 0);

  // per-brand rollup: bags, lbs, spend, your quality rating, and cook scores where used
  const brands = {};
  for (const p of pellets) {
    const key = (p.brand || 'Unknown').trim();
    brands[key] = brands[key] || { lbs: 0, spent: 0, q: [], n: 0 };
    brands[key].lbs += Number(p.weightLbs) || 0;
    brands[key].spent += Number(p.price) || 0;
    if (p.qualityRating) brands[key].q.push(Number(p.qualityRating));
    brands[key].n++;
  }
  const brandRows = Object.entries(brands).map(([name, b]) => {
    const cookScores = Cooks.all()
      .filter(c => c.status === 'done' && (c.pelletBrand || '').toLowerCase().includes(name.toLowerCase()))
      .map(c => Reviews.avgForCook(c.id)).filter(v => v != null);
    return {
      name, ...b,
      perLb: b.lbs ? b.spent / b.lbs : null,
      quality: b.q.length ? b.q.reduce((s, x) => s + x, 0) / b.q.length : null,
      cookAvg: cookScores.length ? cookScores.reduce((s, x) => s + x, 0) / cookScores.length : null,
      cooks: cookScores.length,
    };
  }).sort((a, b) => (b.cookAvg ?? b.quality ?? 0) - (a.cookAvg ?? a.quality ?? 0));

  container.innerHTML = `
    <div class="view-header">
      <div><h2>🌲 Pellets</h2><p class="sub">Every bag you buy — brand, quality, cost, and how it performs on the pit</p></div>
      <button class="btn" id="add-pellet">＋ Log a Bag</button>
    </div>
    <div class="grid cols-4 mb">
      <div class="card"><h3>⚖️ Purchased</h3><div class="big">${round1(totalLbs)} lbs</div><div class="hint">${pellets.length} bag${pellets.length === 1 ? '' : 's'} logged</div></div>
      <div class="card"><h3>💰 Spent</h3><div class="big">${money(totalSpent)}</div><div class="hint">${blended ? money(blended) + '/lb blended' : 'log prices to track'}</div></div>
      <div class="card"><h3>🔥 Burned</h3><div class="big">${round1(burned)} lbs</div><div class="hint">across all smoke sessions</div></div>
      <div class="card"><h3>🏠 On Hand (est.)</h3><div class="big">${round1(Math.max(0, totalLbs - burned))} lbs</div><div class="hint">purchased minus burned</div></div>
    </div>
    ${brandRows.length ? `
    <div class="card mb">
      <h3>🏷️ Brand Report Card</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Brand</th><th>Bags</th><th>Lbs</th><th>$/lb</th><th>Your Quality</th><th>Cook Score</th></tr></thead>
        <tbody>${brandRows.map(b => `<tr>
          <td><strong>${esc(b.name)}</strong></td>
          <td>${b.n}</td>
          <td>${round1(b.lbs)}</td>
          <td>${b.perLb ? money(b.perLb) : '—'}</td>
          <td>${b.quality ? round1(b.quality) + '/10' : '—'}</td>
          <td>${b.cookAvg ? `${scorePill(b.cookAvg, b.cooks)}` : '<span class="muted">no rated cooks yet</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}
    ${pellets.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Brand</th><th>Flavor</th><th>Weight</th><th>Price</th><th>$/lb</th><th>Quality</th><th>Vendor</th><th>Purchased</th><th></th></tr></thead>
      <tbody>${pellets.map(p => {
        const perLb = p.price && p.weightLbs ? money(p.price / p.weightLbs) : '—';
        return `<tr>
          <td><strong>${esc(p.brand || '—')}</strong>${p.notes ? `<br><span class="muted">${esc(p.notes)}</span>` : ''}</td>
          <td>${esc(p.flavor || '—')}</td>
          <td>${p.weightLbs ? p.weightLbs + ' lbs' : '—'}</td>
          <td>${p.price ? money(p.price) : '—'}</td>
          <td>${perLb}</td>
          <td>${p.qualityRating ? p.qualityRating + '/10' : '—'}</td>
          <td>${esc(Vendors.get(p.vendorId)?.name || '—')}</td>
          <td>${fmtDate(p.purchaseDate)}</td>
          <td class="flex">
            <button class="btn small secondary" data-edit-pellet="${p.id}">Edit</button>
            <button class="btn small danger" data-del-pellet="${p.id}">✕</button>
          </td></tr>`;
      }).join('')}</tbody></table></div>`
    : '<div class="empty">No pellet purchases logged yet. Track each bag — brand, flavor, pounds, price, and your quality rating — and the app tells you which pellets earn their price.</div>'}`;

  $('#add-pellet').onclick = () => openPelletForm();
  container.querySelectorAll('[data-edit-pellet]').forEach(b => b.onclick = () => openPelletForm(Pellets.get(b.dataset.editPellet)));
  container.querySelectorAll('[data-del-pellet]').forEach(b => b.onclick = () => {
    if (confirm('Delete this pellet purchase?')) { Pellets.remove(b.dataset.delPellet); toast('Purchase deleted'); render(); }
  });
}

function openPelletForm(pellet = null) {
  const vendors = Vendors.all();
  const knownBrands = [...new Set(Pellets.all().map(p => p.brand).filter(Boolean))];
  const knownFlavors = [...new Set(Pellets.all().map(p => p.flavor).filter(Boolean))];
  openModal(`
    <h3>${pellet ? 'Edit' : 'Log'} Pellet Purchase</h3>
    <form class="form" id="pellet-form">
      <div class="form-row">
        <label class="field">Brand
          <input name="brand" required list="pellet-brands" placeholder="Lumber Jack, Traeger, Bear Mountain…" value="${esc(pellet?.brand || '')}">
          <datalist id="pellet-brands">${knownBrands.map(b => `<option>${esc(b)}</option>`).join('')}</datalist>
        </label>
        <label class="field">Flavor / wood
          <input name="flavor" list="pellet-flavors" placeholder="Hickory, Oak, Competition blend…" value="${esc(pellet?.flavor || '')}">
          <datalist id="pellet-flavors">${knownFlavors.map(f => `<option>${esc(f)}</option>`).join('')}</datalist>
        </label>
      </div>
      <div class="form-row">
        <label class="field">Weight (lbs) <input name="weightLbs" type="number" step="0.5" min="0" required value="${pellet?.weightLbs ?? 20}"></label>
        <label class="field">Price ($) <input name="price" type="number" step="0.01" min="0" value="${pellet?.price ?? ''}"></label>
        <label class="field">Quality (1–10) <input name="qualityRating" type="number" min="1" max="10" step="0.5" value="${pellet?.qualityRating ?? ''}"></label>
      </div>
      <div class="form-row">
        <label class="field">Vendor
          <select name="vendorId">
            <option value="">— none —</option>
            ${vendors.map(v => `<option value="${v.id}" ${pellet?.vendorId === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field">Purchase date <input name="purchaseDate" type="date" value="${pellet?.purchaseDate || new Date().toISOString().slice(0, 10)}"></label>
      </div>
      <label class="field">Notes <input name="notes" placeholder="Ash output, dust in the bag, smoke flavor…" value="${esc(pellet?.notes || '')}"></label>
      <div class="form-actions">
        <button type="button" class="btn secondary" id="cancel-modal">Cancel</button>
        <button class="btn">${pellet ? 'Save' : 'Log Purchase'}</button>
      </div>
    </form>`);
  $('#cancel-modal').onclick = closeModal;
  $('#pellet-form').onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const data = { ...f, weightLbs: num(f.weightLbs), price: num(f.price), qualityRating: num(f.qualityRating) };
    if (pellet) { Pellets.update(pellet.id, data); toast('Purchase updated', 'good'); }
    else { Pellets.add(data); toast('Pellet purchase logged 🌲', 'good'); }
    closeModal(); render();
  };
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
        <h3>💵 Cost Defaults</h3>
        <p class="muted mb">Used for the cost-per-serving math on each smoke (meat price + pellets burned).</p>
        <form class="form" id="cost-form">
          <label class="field">Pellet price ($ per lb) <input name="pelletPricePerLb" type="number" step="0.05" min="0" value="${s.pelletPricePerLb ?? 1}"></label>
          <div class="form-actions"><button class="btn small">Save</button></div>
        </form>
      </div>
      <div class="card">
        <h3>☁️ Cross-Device Sync</h3>
        <p class="muted mb">Share one journal across your phone, tablet, and desktop. Pick a household passphrase and enter the same one on every device — the newest save wins everywhere. Photos and your API key stay on each device.</p>
        <form class="form" id="sync-form">
          <label class="field">Household passphrase
            <input name="passphrase" type="password" placeholder="e.g. brisket-crew-2026" value="${esc(s.syncPassphrase || '')}" ${s.syncEnabled ? 'disabled' : ''}>
          </label>
          <div class="flex">
            ${s.syncEnabled
              ? `<button type="button" class="btn danger small" id="sync-disconnect">Disconnect</button>
                 <button type="button" class="btn secondary small" id="sync-now">🔄 Sync now</button>`
              : '<button class="btn small">☁️ Connect</button>'}
          </div>
          <p class="muted" id="sync-status-line" style="font-size:.78rem"></p>
        </form>
      </div>
      <div class="card">
        <h3>💾 Your Data</h3>
        <p class="muted mb">Everything lives in this browser (localStorage). Export regularly to back up or move devices. Cook photos are stored separately on this device and aren't included in JSON exports.</p>
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

  $('#cost-form').onsubmit = e => {
    e.preventDefault();
    Settings.update({ pelletPricePerLb: Number(new FormData(e.target).get('pelletPricePerLb')) || 0 });
    toast('Cost defaults saved', 'good'); render();
  };

  const syncLine = $('#sync-status-line');
  if (syncLine) syncLine.textContent = syncStatusText(syncStatus());
  $('#sync-form').onsubmit = async e => {
    e.preventDefault();
    const pass = new FormData(e.target).get('passphrase');
    try {
      const result = await enableSync(pass);
      toast(result === 'adopted' ? 'Connected — journal pulled from the cloud ☁️' : 'Connected — journal pushed to the cloud ☁️', 'good');
      render();
    } catch (err) {
      if (err.message !== 'unconfigured') toast(err.message, 'bad');
      render();
    }
  };
  const disc = $('#sync-disconnect');
  if (disc) disc.onclick = () => { disableSync(); toast('Sync disconnected'); render(); };
  const syncNowBtn = $('#sync-now');
  if (syncNowBtn) syncNowBtn.onclick = async () => {
    try { const r = await pullNow(); toast(r === 'adopted' ? 'Updated from cloud ☁️' : 'Cloud is up to date ✅', 'good'); render(); }
    catch (err) { if (err.message !== 'unconfigured') toast(err.message, 'bad'); }
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
initSync(() => { toast('Journal updated from the cloud ☁️', 'good'); render(); });
onSyncStatus(s => {
  const el = document.getElementById('sync-status-line');
  if (el) el.textContent = syncStatusText(s);
});

function syncStatusText(s) {
  if (s.status === 'off') return 'Not connected.';
  if (s.status === 'syncing') return `☁️ ${s.detail}`;
  if (s.status === 'error') return `⚠️ Sync error: ${s.detail}`;
  if (s.status === 'unconfigured') return '⚠️ Sync storage not set up yet — see the note below.';
  return `✅ ${s.detail}${s.lastSyncTs ? ` · last sync ${new Date(s.lastSyncTs).toLocaleTimeString()}` : ''}`;
}

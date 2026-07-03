// ============ Smoker AI — data layer (localStorage) ============

const STORAGE_KEY = 'smoker-ai-db-v1';

const emptyDb = () => ({
  meats: [],      // {id, name, type, cut, grade, weightLbs, price, vendorId, purchaseDate, qualityRating, status, notes}
  vendors: [],    // {id, name, location, notes}
  cooks: [],      // {id, meatId, date, method, pelletBrand, pelletFlavor, pelletLbs, targetGrillTemp, targetInternalTemp,
                  //  probes:[{id,name,color}], readings:[{ts,probeId,temp}], actions:[{ts,type,text}],
                  //  startTime, endTime, status, notes}
  reviews: [],    // {id, cookId, reviewer, score, comments, date}
  checklist: [],  // {id, name, status: 'love'|'try'|'tried', notes}
  settings: { apiKey: '', model: 'claude-opus-4-8', people: [] },
});

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw);
    return { ...emptyDb(), ...parsed, settings: { ...emptyDb().settings, ...(parsed.settings || {}) } };
  } catch {
    return emptyDb();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function getDb() { return db; }

// ---- generic collection helpers ----
function add(coll, item) {
  item.id = item.id || uid();
  db[coll].push(item);
  save();
  return item;
}
function update(coll, id, patch) {
  const item = db[coll].find(x => x.id === id);
  if (item) { Object.assign(item, patch); save(); }
  return item;
}
function remove(coll, id) {
  db[coll] = db[coll].filter(x => x.id !== id);
  save();
}
function get(coll, id) { return db[coll].find(x => x.id === id); }

export const Meats = {
  all: () => db.meats,
  get: id => get('meats', id),
  add: m => add('meats', m),
  update: (id, p) => update('meats', id, p),
  remove: id => {
    // cascade: remove cooks (and their reviews) for this meat
    db.cooks.filter(c => c.meatId === id).forEach(c => Cooks.remove(c.id));
    remove('meats', id);
  },
};

export const Vendors = {
  all: () => db.vendors,
  get: id => get('vendors', id),
  add: v => add('vendors', v),
  update: (id, p) => update('vendors', id, p),
  remove: id => {
    db.meats.forEach(m => { if (m.vendorId === id) m.vendorId = ''; });
    remove('vendors', id);
  },
};

export const Cooks = {
  all: () => db.cooks,
  get: id => get('cooks', id),
  add: c => add('cooks', c),
  update: (id, p) => update('cooks', id, p),
  remove: id => {
    db.reviews = db.reviews.filter(r => r.cookId !== id);
    remove('cooks', id);
  },
  addProbe: (cookId, name, color) => {
    const c = get('cooks', cookId);
    if (!c) return null;
    const probe = { id: uid(), name, color };
    c.probes.push(probe);
    save();
    return probe;
  },
  removeProbe: (cookId, probeId) => {
    const c = get('cooks', cookId);
    if (!c) return;
    c.probes = c.probes.filter(p => p.id !== probeId);
    c.readings = c.readings.filter(r => r.probeId !== probeId);
    save();
  },
  addReading: (cookId, probeId, temp, ts = Date.now()) => {
    const c = get('cooks', cookId);
    if (!c) return;
    c.readings.push({ ts, probeId, temp: Number(temp) });
    c.readings.sort((a, b) => a.ts - b.ts);
    save();
  },
  addAction: (cookId, type, text, ts = Date.now()) => {
    const c = get('cooks', cookId);
    if (!c) return;
    c.actions.push({ ts, type, text });
    c.actions.sort((a, b) => a.ts - b.ts);
    save();
  },
  removeAction: (cookId, ts) => {
    const c = get('cooks', cookId);
    if (!c) return;
    c.actions = c.actions.filter(a => a.ts !== ts);
    save();
  },
};

export const Reviews = {
  all: () => db.reviews,
  forCook: cookId => db.reviews.filter(r => r.cookId === cookId),
  add: r => add('reviews', r),
  update: (id, p) => update('reviews', id, p),
  remove: id => remove('reviews', id),
  avgForCook: cookId => {
    const rs = db.reviews.filter(r => r.cookId === cookId);
    if (!rs.length) return null;
    return rs.reduce((s, r) => s + Number(r.score), 0) / rs.length;
  },
};

export const Checklist = {
  all: () => db.checklist,
  add: c => add('checklist', c),
  update: (id, p) => update('checklist', id, p),
  remove: id => remove('checklist', id),
};

export const Settings = {
  get: () => db.settings,
  update: p => { Object.assign(db.settings, p); save(); },
};

// ---- export / import / reset ----
export function exportJson() {
  const data = { ...db, settings: { ...db.settings, apiKey: '' } }; // never export the key
  return JSON.stringify(data, null, 2);
}
export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.meats)) {
    throw new Error('Not a valid Smoker AI export file');
  }
  const keepKey = db.settings.apiKey;
  db = { ...emptyDb(), ...parsed, settings: { ...emptyDb().settings, ...(parsed.settings || {}) } };
  if (keepKey && !db.settings.apiKey) db.settings.apiKey = keepKey;
  save();
}
export function resetDb() {
  db = emptyDb();
  save();
}

// ---- demo data so the app isn't empty on first run ----
export function loadDemoData() {
  const now = Date.now();
  const h = 3600e3;
  const v1 = { id: uid(), name: 'Costco', location: 'Warehouse', notes: 'Great prime briskets' };
  const v2 = { id: uid(), name: "Joe's Butcher Shop", location: 'Downtown', notes: 'Local, pricier, excellent pork' };
  const m1 = { id: uid(), name: 'Whole Packer Brisket', type: 'Beef', cut: 'Brisket', grade: 'Prime', weightLbs: 13.4, price: 52.9, vendorId: v1.id, purchaseDate: new Date(now - 96 * h).toISOString().slice(0, 10), qualityRating: 9, status: 'smoked', notes: 'Nice marbling, flexible flat' };
  const m2 = { id: uid(), name: 'Pork Shoulder (Boston Butt)', type: 'Pork', cut: 'Shoulder', grade: 'N/A', weightLbs: 8.2, price: 21.3, vendorId: v2.id, purchaseDate: new Date(now - 48 * h).toISOString().slice(0, 10), qualityRating: 8, status: 'inventory', notes: 'Bone-in' };
  const grill = { id: uid(), name: 'Grill Temp', color: '#ff6b35' };
  const flat = { id: uid(), name: 'Brisket Flat', color: '#7cb342' };
  const point = { id: uid(), name: 'Brisket Point', color: '#42a5f5' };
  const start = now - 90 * h;
  const readings = [];
  for (let i = 0; i <= 12; i++) {
    const ts = start + i * h;
    readings.push({ ts, probeId: grill.id, temp: 250 + Math.round(12 * Math.sin(i / 1.7)) });
    readings.push({ ts, probeId: flat.id, temp: Math.min(203, 45 + i * 14 + (i > 6 ? -8 : 0)) });
    readings.push({ ts, probeId: point.id, temp: Math.min(205, 45 + i * 15 + (i > 6 ? -6 : 0)) });
  }
  const c1 = {
    id: uid(), meatId: m1.id, date: new Date(start).toISOString().slice(0, 10),
    method: 'Low & Slow', pelletBrand: 'Lumber Jack', pelletFlavor: 'Oak/Hickory blend', pelletLbs: 16,
    targetGrillTemp: 250, targetInternalTemp: 203,
    probes: [grill, flat, point], readings,
    actions: [
      { ts: start, type: '🔥 Fire', text: 'Smoker up to 250°F, brisket on fat-side down' },
      { ts: start + 3 * h, type: '💦 Spritz', text: 'Spritzed with 50/50 apple cider vinegar & water' },
      { ts: start + 6 * h, type: '📦 Wrap', text: 'Wrapped in butcher paper at 165°F internal — stall hit' },
      { ts: start + 11 * h, type: '🛌 Rest', text: 'Pulled at 203°F, rested 1.5h in cooler' },
    ],
    startTime: start, endTime: start + 12 * h, status: 'done',
    notes: 'Best bark yet. Paper wrap kept it moist.',
  };
  const r1 = { id: uid(), cookId: c1.id, reviewer: 'Mac', score: 9, comments: 'Incredible bark, juicy point.', date: new Date(start + 14 * h).toISOString().slice(0, 10) };
  const r2 = { id: uid(), cookId: c1.id, reviewer: 'Sam', score: 8.5, comments: 'Flat slightly dry at the edge, otherwise superb.', date: new Date(start + 14 * h).toISOString().slice(0, 10) };
  const cl = [
    { id: uid(), name: 'Brisket', status: 'love', notes: 'The king' },
    { id: uid(), name: 'Pork Belly Burnt Ends', status: 'try', notes: 'Heard amazing things' },
    { id: uid(), name: 'Smoked Turkey Breast', status: 'try', notes: 'For Thanksgiving' },
  ];
  db.vendors.push(v1, v2);
  db.meats.push(m1, m2);
  db.cooks.push(c1);
  db.reviews.push(r1, r2);
  db.checklist.push(...cl);
  if (!db.settings.people.length) db.settings.people = ['Mac', 'Sam'];
  save();
}

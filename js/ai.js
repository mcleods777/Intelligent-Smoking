// ============ Smoker AI — insight engine ============
// Two layers:
//   1. Local analytics — always available, computed from your data.
//   2. Claude API — optional, plug in an API key in Settings for
//      conversational analysis and richer suggestions.

import { getDb, Meats, Vendors, Reviews, Settings } from './store.js';

const fmt = n => (Math.round(n * 100) / 100).toLocaleString();
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);

// ---------- Local analytics ----------

export function computeInsights() {
  const db = getDb();
  const insights = [];

  const doneCooks = db.cooks.filter(c => c.status === 'done');
  const rated = doneCooks
    .map(c => ({ cook: c, avg: Reviews.avgForCook(c.id), meat: Meats.get(c.meatId) }))
    .filter(x => x.avg != null);

  // --- Hall of fame ---
  if (rated.length) {
    const best = [...rated].sort((a, b) => b.avg - a.avg)[0];
    insights.push({
      icon: '🏆', title: 'Hall of Fame',
      lines: [
        `Your top-rated smoke is **${best.meat?.name || 'Unknown'}** (${best.cook.method || 'no method logged'}) with an average score of **${fmt(best.avg)}/10** across ${Reviews.forCook(best.cook.id).length} review(s).`,
        rated.length >= 3 ? `Across ${rated.length} rated smokes your overall average is **${fmt(rated.reduce((s, x) => s + x.avg, 0) / rated.length)}/10**.` : null,
      ].filter(Boolean),
    });
  }

  // --- Pellet performance ---
  const byPellet = groupBy(rated.filter(x => x.cook.pelletBrand), x => `${x.cook.pelletBrand} — ${x.cook.pelletFlavor || 'unspecified'}`);
  const pelletRank = Object.entries(byPellet)
    .map(([k, xs]) => ({ k, avg: avg(xs.map(x => x.avg)), n: xs.length }))
    .sort((a, b) => b.avg - a.avg);
  if (pelletRank.length) {
    insights.push({
      icon: '🌲', title: 'Pellet Performance',
      lines: [
        `Best-scoring pellets so far: **${pelletRank[0].k}** at **${fmt(pelletRank[0].avg)}/10** (${pelletRank[0].n} smoke${pelletRank[0].n > 1 ? 's' : ''}).`,
        pelletRank.length > 1 ? `Lowest: ${pelletRank[pelletRank.length - 1].k} at ${fmt(pelletRank[pelletRank.length - 1].avg)}/10 — consider retiring it or pairing it with a different cut.` : 'Log more smokes with different pellets to compare brands and flavors.',
      ],
    });
  }

  // --- Method performance ---
  const byMethod = groupBy(rated.filter(x => x.cook.method), x => x.cook.method);
  const methodRank = Object.entries(byMethod)
    .map(([k, xs]) => ({ k, avg: avg(xs.map(x => x.avg)), n: xs.length }))
    .sort((a, b) => b.avg - a.avg);
  if (methodRank.length > 1) {
    insights.push({
      icon: '🍖', title: 'Method Comparison',
      lines: methodRank.map(m => `**${m.k}** — ${fmt(m.avg)}/10 over ${m.n} smoke(s)`),
    });
  }

  // --- Temperature intelligence ---
  const withTemps = rated.filter(x => x.cook.readings?.length && x.cook.probes?.length);
  if (withTemps.length) {
    const grillAvgOf = c => {
      const grillProbe = c.probes.find(p => /grill|pit|chamber|smoker/i.test(p.name)) || c.probes[0];
      const rs = c.readings.filter(r => r.probeId === grillProbe.id);
      return rs.length ? avg(rs.map(r => r.temp)) : null;
    };
    const good = withTemps.filter(x => x.avg >= 8).map(x => grillAvgOf(x.cook)).filter(v => v != null);
    if (good.length) {
      insights.push({
        icon: '🌡️', title: 'Temperature Sweet Spot',
        lines: [
          `Your smokes rated **8+/10** ran an average pit temperature of **${Math.round(avg(good))}°F**. Aim near that on the next cook.`,
          swingWarning(withTemps),
        ].filter(Boolean),
      });
    }
  }

  // --- Vendor economics ---
  const meatsWithVendor = db.meats.filter(m => m.vendorId && m.price > 0 && m.weightLbs > 0);
  const byVendor = groupBy(meatsWithVendor, m => m.vendorId);
  const vendorRank = Object.entries(byVendor).map(([vid, ms]) => ({
    vendor: Vendors.get(vid),
    perLb: sum(ms.map(m => m.price)) / sum(ms.map(m => m.weightLbs)),
    quality: avg(ms.filter(m => m.qualityRating).map(m => m.qualityRating)) || null,
    n: ms.length,
  })).filter(v => v.vendor).sort((a, b) => a.perLb - b.perLb);
  if (vendorRank.length) {
    const cheapest = vendorRank[0];
    const bestValue = [...vendorRank].filter(v => v.quality).sort((a, b) => (b.quality / b.perLb) - (a.quality / a.perLb))[0];
    insights.push({
      icon: '💰', title: 'Vendor Economics',
      lines: [
        `Cheapest per pound: **${cheapest.vendor.name}** at **${money(cheapest.perLb)}/lb** (${cheapest.n} purchase${cheapest.n > 1 ? 's' : ''}).`,
        bestValue ? `Best quality-per-dollar: **${bestValue.vendor.name}** — quality ${fmt(bestValue.quality)}/10 at ${money(bestValue.perLb)}/lb.` : null,
        `Total invested in meat so far: **${money(sum(db.meats.map(m => Number(m.price) || 0)))}**.`,
      ].filter(Boolean),
    });
  }

  // --- Checklist nudges ---
  const toTry = db.checklist.filter(c => c.status === 'try');
  if (toTry.length) {
    insights.push({
      icon: '🎯', title: 'Next Adventure',
      lines: [`You have **${toTry.length}** meat(s) on your want-to-try list: ${toTry.map(c => c.name).join(', ')}. ${toTry[0].name} would make a great next smoke.`],
    });
  }

  // --- Inventory nudge ---
  const inFreezer = db.meats.filter(m => m.status === 'inventory');
  if (inFreezer.length) {
    insights.push({
      icon: '🧊', title: 'In the Queue',
      lines: [`${inFreezer.length} meat(s) waiting to be smoked: ${inFreezer.map(m => `${m.name} (${m.weightLbs} lbs)`).join(', ')}.`],
    });
  }

  if (!insights.length) {
    insights.push({
      icon: '🤖', title: 'Getting Started',
      lines: ['Log your meats, smokes, temperatures, and reviews — insights will appear here automatically as your smoking journal grows.'],
    });
  }
  return insights;
}

function swingWarning(withTemps) {
  // flag cooks with big pit temp swings
  let worst = null;
  for (const x of withTemps) {
    const grillProbe = x.cook.probes.find(p => /grill|pit|chamber|smoker/i.test(p.name));
    if (!grillProbe) continue;
    const temps = x.cook.readings.filter(r => r.probeId === grillProbe.id).map(r => r.temp);
    if (temps.length < 3) continue;
    const swing = Math.max(...temps) - Math.min(...temps);
    if (!worst || swing > worst.swing) worst = { swing, name: Meats.get(x.cook.meatId)?.name };
  }
  if (worst && worst.swing > 40) {
    return `Watch pit stability: your ${worst.name || 'recent'} smoke swung ${Math.round(worst.swing)}°F. Big swings extend the stall and dry the bark.`;
  }
  return null;
}

// ---------- Per-cook analysis ----------

export function analyzeCook(cook) {
  const lines = [];
  const meat = Meats.get(cook.meatId);
  const avgScore = Reviews.avgForCook(cook.id);

  if (cook.startTime && cook.endTime) {
    const hrs = (cook.endTime - cook.startTime) / 3600e3;
    lines.push(`Total cook time: **${fmt(hrs)} hours**${meat?.weightLbs ? ` (${fmt(hrs / meat.weightLbs)} hr/lb for ${meat.weightLbs} lbs)` : ''}.`);
  }
  for (const probe of cook.probes || []) {
    const temps = (cook.readings || []).filter(r => r.probeId === probe.id).map(r => r.temp);
    if (!temps.length) continue;
    lines.push(`**${probe.name}**: avg ${Math.round(avg(temps))}°F, range ${Math.min(...temps)}–${Math.max(...temps)}°F over ${temps.length} readings.`);
  }
  const grillProbe = (cook.probes || []).find(p => /grill|pit|chamber|smoker/i.test(p.name));
  if (grillProbe && cook.targetGrillTemp) {
    const temps = (cook.readings || []).filter(r => r.probeId === grillProbe.id).map(r => r.temp);
    if (temps.length) {
      const drift = avg(temps) - cook.targetGrillTemp;
      if (Math.abs(drift) > 15) lines.push(`⚠️ Pit ran **${Math.round(Math.abs(drift))}°F ${drift > 0 ? 'above' : 'below'}** your ${cook.targetGrillTemp}°F target on average.`);
      else lines.push(`✅ Pit held close to target (avg within ${Math.round(Math.abs(drift))}°F of ${cook.targetGrillTemp}°F).`);
    }
  }
  if (cook.pelletLbs && cook.startTime && cook.endTime) {
    const hrs = (cook.endTime - cook.startTime) / 3600e3;
    if (hrs > 0) lines.push(`Pellet burn rate: **${fmt(cook.pelletLbs / hrs)} lbs/hr** (${cook.pelletLbs} lbs of ${cook.pelletBrand || 'pellets'} total).`);
  }
  if (avgScore != null) lines.push(`Crowd verdict: **${fmt(avgScore)}/10** from ${Reviews.forCook(cook.id).length} reviewer(s).`);
  if (!lines.length) lines.push('Log temperatures, times, and reviews for this smoke to unlock analysis.');
  return lines;
}

// ---------- Claude API layer ----------

export function hasApiKey() {
  return Boolean(Settings.get().apiKey);
}

function buildContext() {
  const db = getDb();
  // Compact snapshot of the journal for the model (thin the readings to keep it small)
  const cooks = db.cooks.map(c => ({
    ...c,
    meat: Meats.get(c.meatId)?.name,
    readings: thin(c.readings || [], 40).map(r => ({
      t: new Date(r.ts).toISOString(),
      probe: c.probes.find(p => p.id === r.probeId)?.name,
      temp: r.temp,
    })),
    actions: (c.actions || []).map(a => ({ t: new Date(a.ts).toISOString(), type: a.type, text: a.text })),
    reviews: Reviews.forCook(c.id).map(r => ({ reviewer: r.reviewer, score: r.score, comments: r.comments })),
    avgScore: Reviews.avgForCook(c.id),
  }));
  const meats = db.meats.map(m => ({ ...m, vendor: Vendors.get(m.vendorId)?.name }));
  return JSON.stringify({ meats, cooks, checklist: db.checklist, vendors: db.vendors }, null, 1);
}

function thin(arr, max) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[Math.floor(i)]);
  return out;
}

export async function askClaude(question) {
  const { apiKey, model } = Settings.get();
  if (!apiKey) throw new Error('No API key set — add one in Settings to enable Claude-powered insights.');

  const system = [
    'You are Smoker AI, a pitmaster-grade BBQ analyst embedded in a meat-smoking journal app.',
    'You receive the user\'s full smoking journal as JSON: meats purchased (with price, weight, grade, vendor, quality rating), smoke sessions (method, pellets, target temps, multi-probe temperature readings, timestamped actions), multi-person reviews with scores out of 10, a love/want-to-try checklist, and vendors.',
    'Give specific, data-grounded analysis and practical suggestions: what to smoke next, how to improve technique, temperature management, pellet choices, and where to buy economically. Reference their actual data (names, scores, prices, temps). Be concise and use short paragraphs or bullet lists. Plain text only, no markdown headers.',
  ].join(' ');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-5',
      max_tokens: 1200,
      system,
      messages: [{
        role: 'user',
        content: `My smoking journal data:\n\n${buildContext()}\n\nQuestion: ${question}`,
      }],
    }),
  });

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`Claude API error (${resp.status}): ${detail || resp.statusText}`);
  }
  const data = await resp.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

// ---------- small utils ----------
function groupBy(arr, fn) {
  return arr.reduce((acc, x) => { const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
}
const sum = xs => xs.reduce((s, x) => s + Number(x), 0);
const avg = xs => (xs.length ? sum(xs) / xs.length : 0);

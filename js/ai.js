// ============ Smoker AI — insight engine ============
// Two layers:
//   1. Local analytics — always available, computed from your data.
//   2. Claude API — optional, plug in an API key in Settings for
//      conversational analysis and richer suggestions.

import { getDb, Meats, Vendors, Reviews, Recipes, Pellets, Settings } from './store.js';

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

  // --- Pellet economics ---
  const pelletBags = db.pellets.filter(p => p.price > 0 && p.weightLbs > 0);
  if (pelletBags.length) {
    const byBrand = groupBy(pelletBags, p => (p.brand || 'Unknown').trim());
    const brandStats = Object.entries(byBrand).map(([name, ps]) => ({
      name,
      perLb: sum(ps.map(p => p.price)) / sum(ps.map(p => p.weightLbs)),
      quality: avg(ps.filter(p => p.qualityRating).map(p => Number(p.qualityRating))) || null,
    }));
    const cheapest = [...brandStats].sort((a, b) => a.perLb - b.perLb)[0];
    const bestValue = [...brandStats].filter(b => b.quality).sort((a, b) => (b.quality / b.perLb) - (a.quality / a.perLb))[0];
    insights.push({
      icon: '🌲', title: 'Pellet Economics',
      lines: [
        `You've bought **${fmt(sum(pelletBags.map(p => Number(p.weightLbs))))} lbs** of pellets for **${money(sum(pelletBags.map(p => Number(p.price))))}** (${money(Pellets.blendedPricePerLb())}/lb blended).`,
        cheapest ? `Cheapest per pound: **${cheapest.name}** at **${money(cheapest.perLb)}/lb**.` : null,
        bestValue ? `Best quality-per-dollar: **${bestValue.name}** — ${fmt(bestValue.quality)}/10 quality at ${money(bestValue.perLb)}/lb.` : null,
      ].filter(Boolean),
    });
  }

  // --- Rub & sauce performance ---
  const ratedRecipes = db.recipes
    .map(r => ({ r, avg: Recipes.avgScore(r) }))
    .filter(x => x.avg != null)
    .sort((a, b) => b.avg - a.avg);
  const cookScoreByRecipe = db.recipes.map(r => {
    const cookAvgs = doneCooks
      .filter(c => (c.recipeIds || []).includes(r.id))
      .map(c => Reviews.avgForCook(c.id))
      .filter(v => v != null);
    return { r, n: cookAvgs.length, avg: cookAvgs.length ? avg(cookAvgs) : null };
  }).filter(x => x.avg != null).sort((a, b) => b.avg - a.avg);
  if (ratedRecipes.length || cookScoreByRecipe.length) {
    insights.push({
      icon: '🧂', title: 'Rub & Sauce Performance',
      lines: [
        ratedRecipes.length ? `Top-rated recipe: **${ratedRecipes[0].r.name}** (${ratedRecipes[0].r.type}) at **${fmt(ratedRecipes[0].avg)}/10**.` : null,
        cookScoreByRecipe.length ? `Best cook results: smokes using **${cookScoreByRecipe[0].r.name}** average **${fmt(cookScoreByRecipe[0].avg)}/10** across ${cookScoreByRecipe[0].n} cook(s).` : null,
      ].filter(Boolean),
    });
  }

  // --- Weather intelligence ---
  const withWeather = rated.filter(x => x.cook.weather && x.cook.weather.tempF != null);
  if (withWeather.length >= 2) {
    const cold = withWeather.filter(x => x.cook.weather.tempF < 50);
    const warm = withWeather.filter(x => x.cook.weather.tempF >= 50);
    if (cold.length && warm.length) {
      const coldAvg = avg(cold.map(x => x.avg));
      const warmAvg = avg(warm.map(x => x.avg));
      insights.push({
        icon: '🌤️', title: 'Weather Intelligence',
        lines: [
          `Cold-weather smokes (<50°F) average **${fmt(coldAvg)}/10** vs **${fmt(warmAvg)}/10** in warmer weather.`,
          coldAvg < warmAvg - 0.5 ? 'Cold hurts your pit stability — consider a welding blanket and budget extra pellets on chilly days.' : 'Weather isn\'t holding you back — nice pit management.',
        ],
      });
    }
  }

  // --- Cost per serving ---
  const pelletPricePerLb = Pellets.blendedPricePerLb() ?? (Number(db.settings.pelletPricePerLb) || 0);
  const costed = doneCooks.map(c => {
    const meat = Meats.get(c.meatId);
    const cost = (Number(meat?.price) || 0) + (Number(c.pelletLbs) || 0) * pelletPricePerLb;
    return { c, cost, per: c.servings > 0 ? cost / c.servings : null };
  }).filter(x => x.per != null);
  if (costed.length) {
    const cheapest = [...costed].sort((a, b) => a.per - b.per)[0];
    insights.push({
      icon: '🧮', title: 'Cost per Serving',
      lines: [
        `Average across ${costed.length} cook(s): **${money(avg(costed.map(x => x.per)))}/serving**.`,
        `Most economical: **${Meats.get(cheapest.c.meatId)?.name || 'Unknown'}** at **${money(cheapest.per)}/serving** for ${cheapest.c.servings} people.`,
      ],
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
  // cost breakdown: meat + pellets, per serving when guest count is logged
  const pelletPrice = Pellets.blendedPricePerLb() ?? (Number(Settings.get().pelletPricePerLb) || 0);
  const meatCost = Number(meat?.price) || 0;
  const pelletCost = (Number(cook.pelletLbs) || 0) * pelletPrice;
  const totalCost = meatCost + pelletCost;
  if (totalCost > 0) {
    const per = cook.servings > 0 ? ` — **${money(totalCost / cook.servings)}/serving** for ${cook.servings} people` : '';
    lines.push(`Cook cost: **${money(totalCost)}** (${money(meatCost)} meat + ${money(pelletCost)} pellets)${per}.`);
  }
  if (cook.weather && (cook.weather.tempF != null || cook.weather.conditions)) {
    const w = cook.weather;
    lines.push(`Weather: ${[w.conditions, w.tempF != null ? `${w.tempF}°F` : null, w.windMph != null ? `${w.windMph} mph wind` : null, w.humidity != null ? `${w.humidity}% humidity` : null].filter(Boolean).join(', ')}.`);
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
    rubsAndSauces: (c.recipeIds || []).map(rid => Recipes.get(rid)?.name).filter(Boolean),
    weather: c.weather || undefined,
    servings: c.servings || undefined,
    reviews: Reviews.forCook(c.id).map(r => ({ reviewer: r.reviewer, score: r.score, comments: r.comments })),
    avgScore: Reviews.avgForCook(c.id),
  }));
  const meats = db.meats.map(m => ({ ...m, vendor: Vendors.get(m.vendorId)?.name }));
  const recipes = db.recipes.map(r => ({
    name: r.name, type: r.type,
    ingredients: (r.ingredients || []).map(i => `${i.amount} ${i.item}`.trim()),
    avgRating: Recipes.avgScore(r),
    ratings: (r.ratings || []).map(x => ({ reviewer: x.reviewer, score: x.score, comments: x.comments })),
  }));
  const pellets = db.pellets.map(p => ({ ...p, vendor: Vendors.get(p.vendorId)?.name }));
  return JSON.stringify({ meats, cooks, recipes, pelletPurchases: pellets, checklist: db.checklist, vendors: db.vendors }, null, 1);
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
    'You receive the user\'s full smoking journal as JSON: meats purchased (with price, weight, grade, vendor, quality rating), smoke sessions (method, pellets, target temps, multi-probe temperature readings, timestamped actions), multi-person reviews with scores out of 10, rub/sauce recipes with ratings, pellet purchases (brand, flavor, pounds, price, quality), a love/want-to-try checklist, and vendors.',
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
      model: model || 'claude-opus-4-8',
      // Generous budget: on newer models adaptive thinking is on by default and
      // thinking tokens count against max_tokens — too small a cap can consume
      // the whole budget before any visible text is produced.
      max_tokens: 16000,
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
  if (data.stop_reason === 'refusal') {
    throw new Error('Claude declined to answer this request. Try rephrasing your question.');
  }
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) {
    if (data.stop_reason === 'max_tokens') {
      throw new Error('The response ran out of tokens before producing an answer. Try a shorter question, or check that the model in Settings is current (e.g. claude-opus-4-8).');
    }
    throw new Error(`Claude returned no text (stop_reason: ${data.stop_reason || 'unknown'}). Check the model name in Settings — current models include claude-opus-4-8 and claude-sonnet-5.`);
  }
  return text;
}

// ---------- Photo scan: extract meat details from a package label ----------

function downscaleImage(file, maxDim = 1568) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image file.')); };
    img.src = url;
  });
}

export async function scanMeatLabel(file) {
  const { apiKey, model } = Settings.get();
  if (!apiKey) throw new Error('No API key set — add one in Settings to enable label scanning.');

  const b64 = await downscaleImage(file);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-opus-4-8',
      max_tokens: 16000,
      system: 'You read grocery meat package labels for a BBQ tracking app. Respond ONLY with a single JSON object, no prose, no code fences.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          {
            type: 'text',
            text: 'Read this meat package label and extract the details. Respond with ONLY this JSON object:\n'
              + '{"name": "product name as a human would call it, e.g. Whole Packer Brisket",\n'
              + ' "type": "one of: Beef, Pork, Poultry, Lamb, Fish, Game, Other",\n'
              + ' "cut": "the cut, e.g. Brisket, Shoulder, Ribs",\n'
              + ' "grade": "one of: Prime, Choice, Select, Wagyu, Organic, Heritage, N/A",\n'
              + ' "weightLbs": <net weight in pounds as a number, convert from kg if needed, null if not visible>,\n'
              + ' "price": <total price in dollars as a number, NOT price per pound, null if not visible>,\n'
              + ' "pricePerLb": <price per pound as a number, null if not visible>,\n'
              + ' "notes": "anything notable: bone-in, sell-by date, marbling, etc., or empty string"}\n'
              + 'If total price is missing but weight and price/lb are visible, compute total = weight × price/lb.',
          },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`Claude API error (${resp.status}): ${detail || resp.statusText}`);
  }
  const data = await resp.json();
  if (data.stop_reason === 'refusal') throw new Error('Claude declined to read this image.');
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not find label details in the photo. Try a clearer, closer shot of the label.');
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { throw new Error('Claude returned an unreadable result — try again.'); }
  // derive total price if only per-lb was visible
  if ((parsed.price == null || parsed.price === 0) && parsed.pricePerLb && parsed.weightLbs) {
    parsed.price = Math.round(parsed.pricePerLb * parsed.weightLbs * 100) / 100;
  }
  return parsed;
}

// ---------- small utils ----------
function groupBy(arr, fn) {
  return arr.reduce((acc, x) => { const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
}
const sum = xs => xs.reduce((s, x) => s + Number(x), 0);
const avg = xs => (xs.length ? sum(xs) / xs.length : 0);

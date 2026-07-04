# 🔥 Smoker AI — Intelligent Smoking Journal

A smart, self-contained web app for tracking your meat-smoking journey on the pellet grill — with AI-powered analysis woven throughout.

## Features

### 🥩 Meat Inventory
Track every cut you buy: name, type, cut, grade (Prime/Choice/Wagyu/…), poundage, price, quality rating (1–10), purchase date, vendor, and notes. The app computes $/lb automatically.

### 💨 Smoke Sessions
Each smoke tracks the meat, cook method (Low & Slow, Hot & Fast, 3-2-1, …), pellet brand/flavor and pounds used, target grill and internal temps, start/finish times, and total duration.

- **Multi-input temperature tracking** — create as many probes as you like (Grill Temp, Brisket Flat, Brisket Point, Ambient, …), log readings over time, and see them all charted together against your target temps.
- **Action log** — timestamped record of everything you did during the smoke: spritz, wrap, flip, fuel, rest, and free-form notes. Actions appear as markers on the temperature chart.

### ⭐ Multi-Person Reviews
Everyone at the table scores each smoke out of 10 with comments. The app computes the average score per smoke and ranks your entire history so you always know what you loved most.

### ✅ Meat Checklist
Three lists — **Meats We Love**, **Want to Try**, and **Tried** — with one-click moves between them.

### 📚 Cut Library
A prepopulated, photo-backed catalog of 30+ classic smoking cuts across beef, pork, poultry, lamb, fish, and game. Each card shows a photo of the cut, difficulty, recommended method, pit temp, target internal temp, typical cook time, and a pitmaster tip — with a one-click **Want to Try** button that adds it to your checklist (pre-filled with the cooking targets). Photos are stored locally (`assets/cuts/`, sourced from Wikimedia Commons — see `assets/cuts/ATTRIBUTIONS.md`), so the library works offline.

### 🏪 Vendor Economics
Track every store and butcher. Per vendor the app computes purchase count, total spent, average $/lb, average meat quality, and a **Value Index** (quality ÷ $/lb) so you can shop where quality per dollar is best.

### 🤖 AI Throughout
- **Built-in insight engine** (no key required): hall-of-fame rankings, pellet brand/flavor performance, method comparison, the pit-temperature sweet spot of your best-rated cooks, pit-stability warnings, vendor economics, pellet burn rate, hr/lb pacing, and next-smoke nudges from your want-to-try list.
- **Claude-powered Q&A** (optional): add an [Anthropic API key](https://console.anthropic.com/) in Settings and ask anything — "What should I smoke next weekend and how?" — with answers grounded in your actual journal data (temps, actions, reviews, prices).

## Running it

No build step, no dependencies. Serve the folder with any static server:

```bash
cd Intelligent-Smoking
python3 -m http.server 8080
# or, with Node:
npx http-server -p 8080 -c-1
# open http://localhost:8080
```

(ES modules require http:// — opening index.html directly via file:// won't work in most browsers.)

**After pulling updates:** `http-server` caches files for an hour by default — the `-c-1` flag disables that. Either way, hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R) after a `git pull` so it picks up the new JavaScript instead of serving a cached copy.

## Data & privacy

- All data lives in your browser's `localStorage` — nothing is sent anywhere unless you use the optional Claude Q&A (which sends your journal to the Anthropic API).
- **Export/Import** JSON from Settings to back up or move devices. Your API key is never included in exports.
- First time? Hit **Settings → Load demo data** to explore with a sample brisket smoke.

## Project layout

```
index.html      app shell and navigation
styles.css      smoky BBQ theme
js/store.js     data layer (localStorage), export/import, demo data
js/app.js       all views: dashboard, meats, smokes, reviews, checklist, cut library, vendors, insights, settings
js/cuts.js      prepopulated cut catalog (30+ cuts with smoking guidance)
js/charts.js    dependency-free canvas temperature chart (multi-probe + action markers)
js/ai.js        local analytics engine + optional Claude API integration
assets/cuts/    cut photos (Wikimedia Commons, see ATTRIBUTIONS.md)
```

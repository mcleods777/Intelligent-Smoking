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
A prepopulated, photo-backed catalog of 45 classic smoking cuts across beef, pork, poultry, lamb, fish, and game — including every rib style (plate/dino, back, chuck short, flanken, baby backs, St. Louis spares, country-style, rib tips, lamb ribs). Each card shows a photo of the cut, difficulty, recommended method, pit temp, target internal temp, typical cook time, and a pitmaster tip — with a one-click **Want to Try** button that adds it to your checklist (pre-filled with the cooking targets). Photos are stored locally (`assets/cuts/`, sourced from Wikimedia Commons — see `assets/cuts/ATTRIBUTIONS.md`), so the library works offline.

### 🧂 Rubs & Sauces
Your recipe book: rubs, sauces, marinades, brines, glazes, and injections — each with exact ingredients and measurements, prep instructions, and notes. The whole crew can rate every recipe (average score shown), recipes can be tagged onto smoke sessions, and the AI insights track which rub or sauce produces your best-scoring cooks.

### 📷 AI Label Scanning
When adding a meat, snap or upload a photo of the package label and Claude reads it — filling in the name, cut, type, grade, weight, and price automatically (it even computes the total from price-per-pound when needed). Requires an Anthropic API key in Settings.

### ⏰ Cook Reminders
Set "spritz every 45 minutes" or one-time "check the wrap" alarms on an active smoke — they fire as in-app toasts and browser notifications while the app is open, and can be paused/resumed per reminder.

### 🌤️ Weather Logging
Each smoke can record outside temp, wind, humidity, and conditions — with one-click auto-fill from your location (via the free open-meteo.com API). The AI compares cold-weather vs warm-weather results.

### 📸 Photo Journal
Attach bark shots, smoke rings, and plated results to every cook. Photos are compressed and stored in the browser's IndexedDB (they don't count against localStorage and aren't included in JSON exports). The first photo also stars on the smoke's share card.

### 🧮 Cost per Serving
Log how many people you fed and your pellet price (Settings → Cost Defaults) and every cook shows its true cost — meat + pellets — per plate, with an insight tracking your most economical smokes.

### 🌳 Wood Pairing Guide
A reference of 10 smoke woods (post oak, hickory, cherry, alder, …) with strength ratings, flavor notes, and what each pairs with — plus *your own* average score next to any wood you've actually burned, matched from your pellet logs.

### 🗓️ Cook Planner
Pick a cut, weight, and serving time — the planner works backward through rest, cook hours, fire-up, seasoning/dry-brine, and thaw dates, then saves the whole schedule as a planned smoke.

### 📤 Shareable Cook Cards (social media ready)
One click renders a smoke into a polished PNG — meat, date, method and pellet chips, crew score, photo, and the full temperature chart. On phones and tablets it opens the native share sheet with a pre-written caption, so you can post directly to Instagram, Facebook, X, or a group chat. On desktop it copies the image to your clipboard (paste straight into a post) and downloads it.

### 📥 Thermometer CSV Import
Import CSV exports from Meater, Fireboard, ThermoWorks, or any logger. The first column is time (ISO, epoch, or elapsed), and each temperature column becomes its own probe automatically.

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
js/cuts.js      prepopulated cut catalog (45 cuts with smoking guidance)
js/woods.js     wood & pellet pairing guide data
js/charts.js    dependency-free canvas temperature chart (multi-probe + action markers)
js/ai.js        local analytics engine + optional Claude API integration
js/photos.js    photo journal storage (IndexedDB) + compression
js/share.js     shareable cook-card renderer (canvas -> PNG)
assets/cuts/    cut photos (Wikimedia Commons, see ATTRIBUTIONS.md)
```

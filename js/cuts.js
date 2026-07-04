// ============ Smoker AI — Cut Library ============
// Prepopulated catalog of classic smoking cuts across every typical animal.
// Photos live in assets/cuts/ (sourced from Wikimedia Commons — see
// assets/cuts/ATTRIBUTIONS.md). Temps in °F, times are rough guides.

export const CUT_ANIMALS = ['Beef', 'Pork', 'Poultry', 'Lamb', 'Fish', 'Game & Other'];

export const CUT_CATALOG = [
  // ---------------- BEEF ----------------
  {
    id: 'brisket', name: 'Brisket (Whole Packer)', animal: 'Beef', emoji: '🥩',
    difficulty: 'Hard', pitTemp: 250, internalTemp: 203, time: '12–18 hrs',
    method: 'Low & Slow',
    blurb: 'The king of BBQ. Point and flat in one cut — wrap at the stall (~165°F) in butcher paper, pull at probe-tender, rest at least an hour.',
  },
  {
    id: 'beef-plate-ribs', name: 'Beef Plate Ribs (Dino Ribs)', animal: 'Beef', emoji: '🦖',
    difficulty: 'Medium', pitTemp: 275, internalTemp: 203, time: '8–10 hrs',
    method: 'Low & Slow',
    blurb: 'Brisket on a stick. Huge, rich, and forgiving thanks to heavy marbling. Salt and pepper is all they need.',
  },
  {
    id: 'chuck-roast', name: 'Chuck Roast', animal: 'Beef', emoji: '🍖',
    difficulty: 'Easy', pitTemp: 250, internalTemp: 205, time: '6–8 hrs',
    method: 'Low & Slow',
    blurb: 'The poor man\'s brisket — smaller, cheaper, and great shredded for sandwiches or "burnt end" cubes.',
  },
  {
    id: 'tri-tip', name: 'Tri-Tip', animal: 'Beef', emoji: '🔺',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 130, time: '1.5–2 hrs',
    method: 'Reverse Sear',
    blurb: 'California classic. Smoke to ~115°F then sear hot for a medium-rare, steak-like finish. Slice against the grain — it changes direction!',
  },
  {
    id: 'beef-back-ribs', name: 'Beef Back Ribs', animal: 'Beef', emoji: '🍗',
    difficulty: 'Easy', pitTemp: 275, internalTemp: 200, time: '5–6 hrs',
    method: 'Low & Slow',
    blurb: 'What\'s left when the ribeye comes off. Less meat than plate ribs but big beefy flavor at a friendly price.',
  },
  {
    id: 'prime-rib', name: 'Prime Rib (Standing Rib Roast)', animal: 'Beef', emoji: '👑',
    difficulty: 'Medium', pitTemp: 225, internalTemp: 130, time: '3–4 hrs',
    method: 'Reverse Sear',
    blurb: 'Holiday showstopper. Smoke gently to ~120°F, rest, then blast to crust the outside. Worth every penny.',
  },
  {
    id: 'beef-cheeks', name: 'Beef Cheeks', animal: 'Beef', emoji: '😋',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 205, time: '6–8 hrs',
    method: 'Smoke + Braise',
    blurb: 'Collagen bombs that melt into the richest barbacoa you\'ve ever had. Smoke 3–4 hours then braise until spoon-tender.',
  },
  {
    id: 'beef-tenderloin', name: 'Beef Tenderloin', animal: 'Beef', emoji: '🎀',
    difficulty: 'Medium', pitTemp: 225, internalTemp: 130, time: '1.5–2 hrs',
    method: 'Reverse Sear',
    blurb: 'The most tender cut on the steer. Mild flavor loves smoke — keep it medium-rare and don\'t walk away.',
  },

  {
    id: 'chuck-short-ribs', name: 'Chuck Short Ribs (English Cut)', animal: 'Beef', emoji: '🧱',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 203, time: '6–8 hrs',
    method: 'Low & Slow',
    blurb: 'Thick single-bone blocks from the chuck — smaller than plate ribs but just as rich. Great when you can\'t find dinos.',
  },
  {
    id: 'flanken-ribs', name: 'Flanken Short Ribs (Korean Cut)', animal: 'Beef', emoji: '🇰🇷',
    difficulty: 'Easy', pitTemp: 400, internalTemp: 145, time: '10–15 min',
    method: 'Hot & Fast',
    blurb: 'Short ribs sliced thin ACROSS the bones. Marinate galbi-style, then flash them over high heat — a totally different rib experience.',
  },
  {
    id: 'picanha', name: 'Picanha (Sirloin Cap)', animal: 'Beef', emoji: '🇧🇷',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 130, time: '1–1.5 hrs',
    method: 'Reverse Sear',
    blurb: 'Brazil\'s favorite cut — a sirloin cap with a glorious fat cap. Score the fat, salt heavily, smoke then sear fat-side down.',
  },
  {
    id: 'top-round', name: 'Top Round (Smoked Roast Beef)', animal: 'Beef', emoji: '🥪',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 132, time: '3–4 hrs',
    method: 'Low & Slow',
    blurb: 'Budget cut, deli payoff. Smoke to 132°F, chill, and slice paper-thin for the best roast beef sandwiches of your life.',
  },
  // ---------------- PORK ----------------
  {
    id: 'pork-butt', name: 'Pork Shoulder (Boston Butt)', animal: 'Pork', emoji: '🐷',
    difficulty: 'Easy', pitTemp: 250, internalTemp: 203, time: '8–12 hrs',
    method: 'Low & Slow',
    blurb: 'The most forgiving big smoke there is — the perfect first cook. Pull it, sauce it, feed a crowd.',
  },
  {
    id: 'baby-back-ribs', name: 'Baby Back Ribs', animal: 'Pork', emoji: '🎹',
    difficulty: 'Easy', pitTemp: 250, internalTemp: 198, time: '4–5 hrs',
    method: '3-2-1',
    blurb: 'Loin-back ribs — leaner and quicker than spares. Try 2-2-1 so they don\'t overcook. Bend test beats a thermometer here.',
  },
  {
    id: 'spare-ribs', name: 'St. Louis Spare Ribs', animal: 'Pork', emoji: '🍖',
    difficulty: 'Easy', pitTemp: 250, internalTemp: 200, time: '5–6 hrs',
    method: '3-2-1',
    blurb: 'Meatier and fattier than baby backs — the competition favorite. Squared-off St. Louis trim cooks evenly.',
  },
  {
    id: 'pork-belly', name: 'Pork Belly (Burnt Ends)', animal: 'Pork', emoji: '🧊',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 200, time: '5–6 hrs',
    method: 'Low & Slow',
    blurb: 'Meat candy. Cube it, smoke 3 hours, then toss in sauce and butter and finish until sticky and jiggly.',
  },
  {
    id: 'pork-loin', name: 'Pork Loin Roast', animal: 'Pork', emoji: '🥓',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 145, time: '2–3 hrs',
    method: 'Low & Slow',
    blurb: 'Lean and budget-friendly. Brine it first and pull at 145°F — overcooking is the only way to ruin it.',
  },
  {
    id: 'pork-tenderloin', name: 'Pork Tenderloin', animal: 'Pork', emoji: '🎯',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 145, time: '1–1.5 hrs',
    method: 'Hot & Fast',
    blurb: 'Weeknight smoke — done in about an hour. Takes rubs and glazes beautifully. Rest 10 minutes before slicing.',
  },
  {
    id: 'fresh-ham', name: 'Fresh Ham (Whole Leg)', animal: 'Pork', emoji: '🍯',
    difficulty: 'Hard', pitTemp: 250, internalTemp: 165, time: '8–10 hrs',
    method: 'Low & Slow',
    blurb: 'An uncured whole leg — nothing like deli ham. Brine for days, smoke for hours, glaze at the end. A holiday project.',
  },
  {
    id: 'pork-chops', name: 'Thick-Cut Pork Chops', animal: 'Pork', emoji: '🥢',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 145, time: '~1 hr',
    method: 'Reverse Sear',
    blurb: 'Get double-cut bone-in chops. Smoke to ~135°F, sear for the crust, rest. Juicy every time.',
  },

  {
    id: 'country-ribs', name: 'Country-Style Ribs', animal: 'Pork', emoji: '🏡',
    difficulty: 'Easy', pitTemp: 250, internalTemp: 195, time: '3–4 hrs',
    method: 'Low & Slow',
    blurb: 'Not really ribs — strips cut from the shoulder end, so they\'re meaty and marbled. Treat them like mini pork butts and take them way past "done".',
  },
  {
    id: 'rib-tips', name: 'Pork Rib Tips', animal: 'Pork', emoji: '🍬',
    difficulty: 'Easy', pitTemp: 250, internalTemp: 200, time: '3–4 hrs',
    method: 'Low & Slow',
    blurb: 'The cartilage-laced strip trimmed off St. Louis spares. Chicago BBQ legend — chewy, saucy, addictive. Never throw them away again.',
  },
  {
    id: 'picnic-shoulder', name: 'Picnic Shoulder', animal: 'Pork', emoji: '🧺',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 203, time: '8–12 hrs',
    method: 'Low & Slow',
    blurb: 'The lower half of the shoulder — cheaper than Boston butt with skin you can turn into cracklins. Whole-hog flavor without the whole hog.',
  },
  {
    id: 'pork-steaks', name: 'Pork Steaks (Shoulder Steaks)', animal: 'Pork', emoji: '🎸',
    difficulty: 'Easy', pitTemp: 275, internalTemp: 190, time: '2.5–3 hrs',
    method: 'Low & Slow',
    blurb: 'St. Louis backyard royalty — Boston butt sliced into inch-thick steaks. Smoke, then braise in sauce right on the pit until tender.',
  },
  // ---------------- POULTRY ----------------
  {
    id: 'whole-chicken', name: 'Whole Chicken', animal: 'Poultry', emoji: '🐔',
    difficulty: 'Easy', pitTemp: 325, internalTemp: 165, time: '2.5–3 hrs',
    method: 'Hot & Fast',
    blurb: 'Cheap, fast, delicious. Spatchcock it for even cooking and run the pit hotter than you think — 325°F+ for bite-through skin.',
  },
  {
    id: 'chicken-thighs', name: 'Chicken Thighs', animal: 'Poultry', emoji: '🍗',
    difficulty: 'Easy', pitTemp: 300, internalTemp: 175, time: '1.5–2 hrs',
    method: 'Hot & Fast',
    blurb: 'Dark meat is nearly impossible to dry out — take thighs to 175°F+ for silky texture. Competition cooks obsess over these for a reason.',
  },
  {
    id: 'chicken-wings', name: 'Chicken Wings', animal: 'Poultry', emoji: '🏈',
    difficulty: 'Easy', pitTemp: 375, internalTemp: 175, time: '~1 hr',
    method: 'Hot & Fast',
    blurb: 'Game-day hero. Smoke 30–40 min for flavor then crank the heat (or flash-fry) to crisp the skin.',
  },
  {
    id: 'whole-turkey', name: 'Whole Turkey', animal: 'Poultry', emoji: '🦃',
    difficulty: 'Medium', pitTemp: 300, internalTemp: 160, time: '4–5 hrs',
    method: 'Hot & Fast',
    blurb: 'Never roast a Thanksgiving bird again. Brine, keep it under 14 lbs, and pull the breast at 160°F — carryover finishes the job.',
  },
  {
    id: 'turkey-breast', name: 'Turkey Breast', animal: 'Poultry', emoji: '🥪',
    difficulty: 'Easy', pitTemp: 275, internalTemp: 160, time: '2.5–3 hrs',
    method: 'Low & Slow',
    blurb: 'All the holiday flavor without the whole-bird project — and the best sandwich meat you\'ll ever make.',
  },
  {
    id: 'whole-duck', name: 'Whole Duck', animal: 'Poultry', emoji: '🦆',
    difficulty: 'Medium', pitTemp: 300, internalTemp: 165, time: '3–4 hrs',
    method: 'Hot & Fast',
    blurb: 'Rich, fatty, and made for smoke. Score the skin, prick the fat layer, and save every drop of rendered duck fat for potatoes.',
  },
  {
    id: 'turkey-legs', name: 'Turkey Legs', animal: 'Poultry', emoji: '🍖',
    difficulty: 'Easy', pitTemp: 275, internalTemp: 175, time: '2.5–3 hrs',
    method: 'Low & Slow',
    blurb: 'State-fair style. Cure them overnight for that signature pink, hammy bite, then smoke until fall-apart.',
  },

  {
    id: 'leg-quarters', name: 'Chicken Leg Quarters', animal: 'Poultry', emoji: '🦵',
    difficulty: 'Easy', pitTemp: 300, internalTemp: 175, time: '1.5–2 hrs',
    method: 'Hot & Fast',
    blurb: 'Thigh and drumstick together, often under a dollar a pound. The cheapest way to feed a crowd something great off the smoker.',
  },
  {
    id: 'cornish-hens', name: 'Cornish Game Hens', animal: 'Poultry', emoji: '🐤',
    difficulty: 'Easy', pitTemp: 300, internalTemp: 165, time: '1.5–2 hrs',
    method: 'Hot & Fast',
    blurb: 'Personal-size birds that plate beautifully — everyone gets their own. Brine an hour, spatchcock, and run the pit hot.',
  },
  {
    id: 'duck-breast', name: 'Duck Breast', animal: 'Poultry', emoji: '🍒',
    difficulty: 'Medium', pitTemp: 225, internalTemp: 135, time: '~1 hr',
    method: 'Reverse Sear',
    blurb: 'Treat it like a steak, not a bird: score the fat, smoke gently to ~125°F, then sear skin-side down until crackling. Cherry wood is magic here.',
  },
  // ---------------- LAMB ----------------
  {
    id: 'leg-of-lamb', name: 'Leg of Lamb', animal: 'Lamb', emoji: '🍷',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 135, time: '3–4 hrs',
    method: 'Low & Slow',
    blurb: 'Garlic, rosemary, smoke. Bone-in for flavor or boneless for easy slicing — pull at 135°F for blushing medium.',
  },
  {
    id: 'lamb-shoulder', name: 'Lamb Shoulder', animal: 'Lamb', emoji: '🐑',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 195, time: '6–8 hrs',
    method: 'Low & Slow',
    blurb: 'The pulled pork of the lamb world. Rich and gamey in the best way — shred it for gyros or tacos.',
  },
  {
    id: 'rack-of-lamb', name: 'Rack of Lamb', animal: 'Lamb', emoji: '👨‍🍳',
    difficulty: 'Medium', pitTemp: 225, internalTemp: 130, time: '~1.5 hrs',
    method: 'Reverse Sear',
    blurb: 'Fancy-dinner energy with barely any effort. Smoke to 120°F, sear fat-side down, slice into perfect lollipops.',
  },
  {
    id: 'lamb-ribs', name: 'Lamb Ribs (Denver Ribs)', animal: 'Lamb', emoji: '🌿',
    difficulty: 'Medium', pitTemp: 250, internalTemp: 195, time: '3–4 hrs',
    method: 'Low & Slow',
    blurb: 'An underrated sleeper — fattier than pork ribs with bold flavor. A vinegar mop cuts the richness perfectly.',
  },

  {
    id: 'lamb-loin-chops', name: 'Lamb Loin Chops', animal: 'Lamb', emoji: '🥩',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 130, time: '~45 min',
    method: 'Reverse Sear',
    blurb: 'Little lamb T-bones. Quick smoke, hot sear, and a squeeze of lemon — an elegant weeknight cook that punches way above its size.',
  },
  // ---------------- FISH ----------------
  {
    id: 'salmon', name: 'Salmon Fillet', animal: 'Fish', emoji: '🐟',
    difficulty: 'Easy', pitTemp: 180, internalTemp: 135, time: '1–2 hrs',
    method: 'Low & Slow',
    blurb: 'Dry-brine with salt and brown sugar, let a pellicle form, then smoke gently. Hot-smoked salmon beats anything from a store.',
  },
  {
    id: 'whole-trout', name: 'Whole Trout', animal: 'Fish', emoji: '🎣',
    difficulty: 'Easy', pitTemp: 200, internalTemp: 145, time: '~1.5 hrs',
    method: 'Low & Slow',
    blurb: 'Butterfly it, brine it, smoke it whole. Delicate, flaky, and spectacular with lemon and dill.',
  },
  {
    id: 'mackerel', name: 'Mackerel', animal: 'Fish', emoji: '🌊',
    difficulty: 'Easy', pitTemp: 200, internalTemp: 145, time: '~1 hr',
    method: 'Low & Slow',
    blurb: 'Oily fish = smoke magnet. A staple of European smokehouses; fantastic flaked into pâté or over salad.',
  },

  {
    id: 'shrimp', name: 'Shrimp (Jumbo, Shell-On)', animal: 'Fish', emoji: '🍤',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 120, time: '20–30 min',
    method: 'Low & Slow',
    blurb: 'The fastest smoke there is. Shell-on jumbos, a garlic-butter bath, and half an hour of smoke — an appetizer that steals the show.',
  },
  // ---------------- GAME & OTHER ----------------
  {
    id: 'venison', name: 'Venison Roast / Backstrap', animal: 'Game & Other', emoji: '🦌',
    difficulty: 'Medium', pitTemp: 225, internalTemp: 130, time: '1.5–2 hrs',
    method: 'Reverse Sear',
    blurb: 'Ultra-lean, so treat it like the finest steak: bacon-wrap or baste, never past medium-rare, rest well.',
  },
  {
    id: 'sausages', name: 'Sausages (Fresh Links)', animal: 'Game & Other', emoji: '🌭',
    difficulty: 'Easy', pitTemp: 225, internalTemp: 160, time: '1.5–2 hrs',
    method: 'Low & Slow',
    blurb: 'Brats, kielbasa, or homemade links — smoke low so the casings don\'t split and the fat stays put. Snap test tells the truth.',
  },
];

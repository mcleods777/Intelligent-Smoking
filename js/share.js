// ============ Smoker AI — shareable cook cards (canvas → PNG) ============

import { Meats, Reviews, Recipes } from './store.js';
import { drawTempChart } from './charts.js';

const W = 1000, H = 1250;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function chip(ctx, text, x, y) {
  ctx.font = '600 24px system-ui';
  const w = ctx.measureText(text).width + 36;
  roundRect(ctx, x, y, w, 46, 23);
  ctx.fillStyle = 'rgba(244,185,66,.12)';
  ctx.fill();
  ctx.strokeStyle = '#7a6224';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f4b942';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 18, y + 31);
  return w;
}

/** Render a cook into a PNG blob. photoDataUrl optional (first journal photo). */
export async function renderShareCard(cook, photoDataUrl) {
  const meat = Meats.get(cook.meatId);
  const avgScore = Reviews.avgForCook(cook.id);
  const reviews = Reviews.forCook(cook.id);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#241b13');
  bg.addColorStop(1, '#17120e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = '#f4b942';
  ctx.font = '700 40px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('🔥 Smoker AI', 50, 78);
  ctx.fillStyle = '#b3a291';
  ctx.font = '26px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(cook.date ? new Date(cook.date + 'T12:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '', W - 50, 78);
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(50, 100); ctx.lineTo(W - 50, 100); ctx.stroke();

  // meat name
  ctx.fillStyle = '#f2e8dd';
  ctx.font = '700 56px system-ui';
  ctx.textAlign = 'left';
  const name = meat?.name || 'Mystery Meat';
  ctx.fillText(name.length > 30 ? name.slice(0, 29) + '…' : name, 50, 175);

  // chips row
  let cx = 50;
  const chips = [
    cook.method,
    [cook.pelletBrand, cook.pelletFlavor].filter(Boolean).join(' — '),
    cook.startTime && cook.endTime ? `${Math.round((cook.endTime - cook.startTime) / 3600e3 * 10) / 10} hrs` : null,
    meat?.weightLbs ? `${meat.weightLbs} lbs` : null,
    ...(cook.recipeIds || []).map(rid => Recipes.get(rid)?.name).filter(Boolean).slice(0, 2),
  ].filter(Boolean);
  for (const c of chips) {
    if (cx > W - 250) break;
    cx += chip(ctx, c, cx, 205) + 14;
  }

  // score badge
  if (avgScore != null) {
    ctx.textAlign = 'center';
    roundRect(ctx, W - 280, 290, 230, 150, 20);
    ctx.fillStyle = 'rgba(124,179,66,.12)';
    ctx.fill();
    ctx.strokeStyle = '#4a6a2a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7cb342';
    ctx.font = '700 72px system-ui';
    ctx.fillText(`${Math.round(avgScore * 10) / 10}`, W - 165, 375);
    ctx.fillStyle = '#b3a291';
    ctx.font = '24px system-ui';
    ctx.fillText(`crew score · ${reviews.length} review${reviews.length === 1 ? '' : 's'}`, W - 165, 415);
  }

  // photo (left of score)
  const photoBox = { x: 50, y: 290, w: avgScore != null ? 610 : W - 100, h: 420 };
  if (photoDataUrl) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(photoBox.w / img.width, photoBox.h / img.height);
        const sw = photoBox.w / scale, sh = photoBox.h / scale;
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        ctx.save();
        roundRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 18);
        ctx.clip();
        ctx.drawImage(img, sx, sy, sw, sh, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
        ctx.restore();
        resolve();
      };
      img.onerror = resolve;
      img.src = photoDataUrl;
    });
  } else {
    roundRect(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 18);
    ctx.fillStyle = '#2a211a';
    ctx.fill();
    ctx.fillStyle = '#b3a291';
    ctx.font = '120px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🍖', photoBox.x + photoBox.w / 2, photoBox.y + photoBox.h / 2 + 40);
  }

  // temperature chart
  ctx.fillStyle = '#f4b942';
  ctx.font = '700 30px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('Temperature log', 50, 785);
  const chartCanvas = document.createElement('canvas');
  chartCanvas.style.width = '900px';
  chartCanvas.style.height = '320px';
  Object.defineProperty(chartCanvas, 'clientWidth', { value: 900 });
  Object.defineProperty(chartCanvas, 'clientHeight', { value: 320 });
  drawTempChart(chartCanvas, cook);
  roundRect(ctx, 50, 805, 900, 330, 14);
  ctx.fillStyle = '#17120e';
  ctx.fill();
  ctx.drawImage(chartCanvas, 50, 810, 900, 320);

  // probe legend
  let lx = 60;
  ctx.font = '22px system-ui';
  for (const p of (cook.probes || []).slice(0, 5)) {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(lx + 8, 1163, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b3a291';
    ctx.textAlign = 'left';
    ctx.fillText(p.name, lx + 24, 1170);
    lx += 40 + ctx.measureText(p.name).width;
  }

  // footer
  ctx.fillStyle = '#b3a291';
  ctx.font = '22px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('logged with Smoker AI 🔥', W - 50, 1225);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

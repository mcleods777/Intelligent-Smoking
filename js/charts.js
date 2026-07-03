// ============ Smoker AI — canvas temperature chart ============
// Draws one line per probe over time. No dependencies.

export function drawTempChart(canvas, cook) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 280;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = cssW, H = cssH;
  const pad = { l: 44, r: 14, t: 14, b: 30 };

  ctx.clearRect(0, 0, W, H);

  const readings = cook.readings || [];
  if (!readings.length) {
    ctx.fillStyle = '#b3a291';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No temperature readings yet — log some below.', W / 2, H / 2);
    return;
  }

  const times = readings.map(r => r.ts);
  const temps = readings.map(r => r.temp);
  const tMin = Math.min(...times), tMax = Math.max(...times);
  let yMin = Math.min(...temps), yMax = Math.max(...temps);
  if (cook.targetGrillTemp) yMax = Math.max(yMax, cook.targetGrillTemp);
  if (cook.targetInternalTemp) yMax = Math.max(yMax, cook.targetInternalTemp);
  yMin = Math.floor((yMin - 10) / 25) * 25;
  yMax = Math.ceil((yMax + 10) / 25) * 25;
  if (yMin < 0) yMin = 0;
  const tSpan = Math.max(tMax - tMin, 60e3);
  const ySpan = Math.max(yMax - yMin, 25);

  const x = ts => pad.l + ((ts - tMin) / tSpan) * (W - pad.l - pad.r);
  const y = t => H - pad.b - ((t - yMin) / ySpan) * (H - pad.t - pad.b);

  // grid + y labels
  ctx.strokeStyle = 'rgba(74,58,44,.6)';
  ctx.fillStyle = '#b3a291';
  ctx.font = '11px system-ui';
  ctx.lineWidth = 1;
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const val = yMin + (ySpan * i) / ySteps;
    const yy = y(val);
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(W - pad.r, yy);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(val) + '°', pad.l - 6, yy + 4);
  }
  // x labels (time)
  const xSteps = Math.min(6, Math.max(2, Math.round(tSpan / 3600e3)));
  ctx.textAlign = 'center';
  for (let i = 0; i <= xSteps; i++) {
    const ts = tMin + (tSpan * i) / xSteps;
    const d = new Date(ts);
    const label = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    ctx.fillText(label, x(ts), H - pad.b + 16);
  }

  // target temp dashed lines
  const dashLine = (val, color, label) => {
    if (!val) return;
    const yy = y(val);
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(W - pad.r, yy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label, pad.l + 4, yy - 4);
    ctx.restore();
  };
  dashLine(cook.targetGrillTemp, 'rgba(255,140,66,.6)', `target grill ${cook.targetGrillTemp}°`);
  dashLine(cook.targetInternalTemp, 'rgba(124,179,66,.6)', `target internal ${cook.targetInternalTemp}°`);

  // one line per probe
  for (const probe of cook.probes || []) {
    const pts = readings.filter(r => r.probeId === probe.id);
    if (!pts.length) continue;
    ctx.strokeStyle = probe.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((r, i) => {
      const xx = x(r.ts), yy = y(r.temp);
      i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    // dots
    ctx.fillStyle = probe.color;
    for (const r of pts) {
      ctx.beginPath();
      ctx.arc(x(r.ts), y(r.temp), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // action markers
  for (const a of cook.actions || []) {
    if (a.ts < tMin || a.ts > tMax) continue;
    const xx = x(a.ts);
    ctx.strokeStyle = 'rgba(244,185,66,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xx, pad.t);
    ctx.lineTo(xx, H - pad.b);
    ctx.stroke();
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText((a.type || '*').slice(0, 2), xx, pad.t + 10);
  }
}

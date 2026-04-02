/* visuals.js — Live Visual Rendering */
'use strict';

const Visuals = (() => {
  // Colors from CSS variables (read at runtime)
  const C = {
    amber:  '#f0a500',
    cyan:   '#00d4e8',
    green:  '#39e080',
    red:    '#ff4455',
    purple: '#a080ff',
    dim:    '#3a4258',
    bg:     '#080b10',
    grid:   '#1a1f2a',
    text:   '#6a7590',
  };

  // ── Trend Chart Engine ─────────────────────────────────
  class TrendChart {
    constructor(canvas, { color = C.cyan, color2, label2, yMin, yMax, windowSec = 120 } = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.color = color;
      this.color2 = color2;
      this.label2 = label2;
      this.yMin = yMin;
      this.yMax = yMax;
      this.windowSec = windowSec;
      this.data = [];   // [{t, v}]
      this.data2 = [];  // [{t, v}] for second series
      this._autoMin = Infinity;
      this._autoMax = -Infinity;
    }

    push(t, v, v2) {
      this.data.push({ t, v });
      if (v2 !== undefined && this.color2) this.data2.push({ t, v: v2 });
      // Trim old data
      const cutoff = t - this.windowSec;
      while (this.data.length > 1 && this.data[0].t < cutoff) this.data.shift();
      while (this.data2.length > 1 && this.data2[0].t < cutoff) this.data2.shift();
      // Auto range
      if (this.yMin === undefined) this._autoMin = Math.min(this._autoMin, v, v2 ?? v);
      if (this.yMax === undefined) this._autoMax = Math.max(this._autoMax, v, v2 ?? v);
    }

    clear() {
      this.data = [];
      this.data2 = [];
      this._autoMin = Infinity;
      this._autoMax = -Infinity;
    }

    draw() {
      const { canvas, ctx, data, data2 } = this;
      const W = (canvas.offsetWidth > 0 ? canvas.offsetWidth : canvas.width);
      const H = canvas.height; // always trust the HTML height attribute
      if (canvas.offsetWidth > 0 && canvas.width !== W) { canvas.width = W; }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, W, H);

      if (data.length < 2) return;

      const tMax = data[data.length - 1].t;
      const tMin = tMax - this.windowSec;

      const yMin = this.yMin !== undefined ? this.yMin : this._autoMin - Math.abs(this._autoMin) * 0.05 - 0.1;
      const yMax = this.yMax !== undefined ? this.yMax : this._autoMax + Math.abs(this._autoMax) * 0.05 + 0.1;
      const yRange = yMax - yMin || 1;

      const pad = { l: 36, r: 6, t: 4, b: 18 };
      const cW = W - pad.l - pad.r;
      const cH = H - pad.t - pad.b;

      const tx = t => pad.l + ((t - tMin) / this.windowSec) * cW;
      const ty = v => pad.t + (1 - (v - yMin) / yRange) * cH;

      // Grid
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 0.5;
      const nGridY = 4;
      for (let i = 0; i <= nGridY; i++) {
        const y = pad.t + (i / nGridY) * cH;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        const val = yMax - (i / nGridY) * yRange;
        ctx.fillStyle = C.text;
        ctx.font = '9px Share Tech Mono';
        ctx.fillText(val.toFixed(1), 0, y + 3);
      }

      // Time axis
      ctx.fillStyle = C.dim;
      ctx.font = '9px Share Tech Mono';
      ctx.fillText('−' + this.windowSec + 's', pad.l, H - 3);
      ctx.fillText('0s', W - 18, H - 3);

      // Draw series
      const drawSeries = (pts, color) => {
        if (pts.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = tx(p.t), y = ty(p.v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };

      drawSeries(data2, this.color2 || C.amber);
      drawSeries(data, this.color);

      // Zero line
      if (yMin < 0 && yMax > 0) {
        const y0 = ty(0);
        ctx.strokeStyle = C.dim;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.l, y0); ctx.lineTo(W - pad.r, y0); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ── Gauge (arc style) ─────────────────────────────────
  function drawGauge(canvas, value, min, max, label, color, unit) {
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    ctx.clearRect(0, 0, S, S);

    const cx = S / 2, cy = S * 0.55;
    const r = S * 0.38;
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const span = endAngle - startAngle;

    // Background arc
    ctx.strokeStyle = '#1a1f2a';
    ctx.lineWidth = S * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.stroke();

    // Value arc
    const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const valAngle = startAngle + fraction * span;
    if (fraction > 0) {
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      grad.addColorStop(0, color + '88');
      grad.addColorStop(1, color);
      ctx.strokeStyle = grad;
      ctx.lineWidth = S * 0.1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, valAngle);
      ctx.stroke();
    }

    // Glow dot at tip
    const dotX = cx + r * Math.cos(valAngle);
    const dotY = cy + r * Math.sin(valAngle);
    const glow = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, S * 0.07);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(dotX, dotY, S * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Value text
    ctx.fillStyle = color;
    ctx.font = `bold ${S * 0.18}px Share Tech Mono`;
    ctx.textAlign = 'center';
    const dispVal = Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(2);
    ctx.fillText(dispVal, cx, cy + S * 0.05);

    // Unit
    ctx.fillStyle = '#6a7590';
    ctx.font = `${S * 0.09}px Barlow Condensed`;
    ctx.fillText(unit || '', cx, cy + S * 0.18);

    // Min/Max ticks
    ctx.fillStyle = '#3a4258';
    ctx.font = `${S * 0.09}px Share Tech Mono`;
    ctx.textAlign = 'left';
    ctx.fillText(min, S * 0.05, cy + S * 0.22);
    ctx.textAlign = 'right';
    ctx.fillText(max, S * 0.95, cy + S * 0.22);
  }

  // ── Process Graphics ──────────────────────────────────
  function drawTankGraphic(canvas, state, inputs) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const level = state.level || 0;
    const maxLevel = 2.5;
    const fraction = level / maxLevel;

    const tankX = W * 0.30, tankW = W * 0.40;
    const tankTop = H * 0.08, tankH = H * 0.72;
    const tankBot = tankTop + tankH;

    // Inflow pipe
    ctx.strokeStyle = '#2e3a50';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(tankX + tankW * 0.35, 0);
    ctx.lineTo(tankX + tankW * 0.35, tankTop);
    ctx.stroke();

    // Draw flowing water (inflow animation)
    const qIn = inputs.qIn || 0;
    if (qIn > 0.1) {
      const flowFrac = Math.min(1, qIn / 50);
      ctx.strokeStyle = `rgba(0,212,232,${0.3 + flowFrac * 0.5})`;
      ctx.lineWidth = Math.max(2, flowFrac * 7);
      ctx.beginPath();
      ctx.moveTo(tankX + tankW * 0.35, 0);
      ctx.lineTo(tankX + tankW * 0.35, tankTop);
      ctx.stroke();
    }

    // Tank walls
    ctx.strokeStyle = '#2e3a50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tankX, tankTop);
    ctx.lineTo(tankX, tankBot);
    ctx.lineTo(tankX + tankW, tankBot);
    ctx.lineTo(tankX + tankW, tankTop);
    ctx.stroke();

    // Water fill
    const waterH = fraction * tankH;
    const waterY = tankBot - waterH;
    if (waterH > 1) {
      const waterGrad = ctx.createLinearGradient(tankX, waterY, tankX + tankW, waterY);
      waterGrad.addColorStop(0, 'rgba(0,80,120,0.9)');
      waterGrad.addColorStop(1, 'rgba(0,120,180,0.7)');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(tankX, waterY, tankW, waterH);

      // Water surface shimmer
      ctx.strokeStyle = 'rgba(0,212,232,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = tankX; x < tankX + tankW; x += 12) {
        ctx.moveTo(x, waterY + Math.sin((x + Date.now() / 300) * 0.4) * 2);
        ctx.lineTo(x + 8, waterY + Math.sin((x + 8 + Date.now() / 300) * 0.4) * 2);
      }
      ctx.stroke();
    }

    // Overflow indicator
    if (state.overflow) {
      ctx.fillStyle = 'rgba(255,68,85,0.7)';
      ctx.fillRect(tankX, tankTop - 4, tankW, 4);
      ctx.fillStyle = '#ff4455';
      ctx.font = 'bold 11px Barlow Condensed';
      ctx.textAlign = 'center';
      ctx.fillText('OVERFLOW', tankX + tankW / 2, tankTop - 8);
    }

    // Level markers
    for (let i = 0; i <= 5; i++) {
      const y = tankBot - (i / 5) * tankH;
      ctx.strokeStyle = '#2e3a50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tankX - 5, y);
      ctx.lineTo(tankX, y);
      ctx.stroke();
      ctx.fillStyle = '#3a4258';
      ctx.font = '9px Share Tech Mono';
      ctx.textAlign = 'right';
      ctx.fillText((i / 5 * maxLevel).toFixed(1), tankX - 7, y + 3);
    }

    // Level indicator line
    const curY = tankBot - fraction * tankH;
    ctx.strokeStyle = '#f0a500';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(tankX + tankW, curY);
    ctx.lineTo(tankX + tankW + 20, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Level label
    ctx.fillStyle = '#f0a500';
    ctx.font = 'bold 11px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillText(level.toFixed(2) + ' m', tankX + tankW + 24, curY + 4);

    // Drain pipe
    const drainX = tankX + tankW * 0.65;
    ctx.strokeStyle = '#2e3a50';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(drainX, tankBot);
    ctx.lineTo(drainX, H);
    ctx.stroke();

    // Outflow water
    const qOut = state.outflow || 0;
    if (qOut > 0.1) {
      const flowFrac = Math.min(1, qOut / 50);
      ctx.strokeStyle = `rgba(0,140,200,${0.3 + flowFrac * 0.5})`;
      ctx.lineWidth = Math.max(2, flowFrac * 7);
      ctx.beginPath();
      ctx.moveTo(drainX, tankBot);
      ctx.lineTo(drainX, H);
      ctx.stroke();
    }

    // Valve symbol
    const valveY = tankBot + (H - tankBot) * 0.5;
    const valveOpen = inputs.qDrain || 0;
    ctx.strokeStyle = valveOpen > 0.5 ? '#39e080' : '#ff4455';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(drainX - 8, valveY - 6);
    ctx.lineTo(drainX + 8, valveY + 6);
    ctx.moveTo(drainX - 8, valveY + 6);
    ctx.lineTo(drainX + 8, valveY - 6);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#6a7590';
    ctx.font = '10px Barlow Condensed';
    ctx.textAlign = 'center';
    ctx.fillText('INFLOW', tankX + tankW * 0.35, H * 0.97);
    ctx.fillText('DRAIN', drainX, H * 0.97);
    ctx.fillText('TANK LEVEL PROCESS', W / 2, 14);
  }

  function drawHeatExchangerGraphic(canvas, state, inputs) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const tOut = state.tOut || 20;
    const tMax = 150;
    const tFrac = Math.min(1, Math.max(0, tOut / tMax));

    // Shell
    const sx = W * 0.12, sy = H * 0.25;
    const sw = W * 0.76, sh = H * 0.45;

    // Heat color (cold→hot: blue→orange→red)
    const r = Math.round(tFrac * 240);
    const g = Math.round((1 - Math.abs(tFrac - 0.5) * 2) * 100);
    const b = Math.round((1 - tFrac) * 200);
    const fluidColor = `rgba(${r},${g},${b},0.7)`;

    // Shell body
    ctx.fillStyle = fluidColor;
    ctx.fillRect(sx, sy, sw, sh);

    // Shell border
    ctx.strokeStyle = '#2e3a50';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);

    // Tubes (4 tubes)
    const nTubes = 4;
    const tubeR = sh * 0.12;
    for (let i = 0; i < nTubes; i++) {
      const ty = sy + sh * (0.15 + i * 0.22);
      ctx.strokeStyle = '#2e3a50';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(sx, ty, tubeR * 0.4, tubeR, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(sx + sw, ty, tubeR * 0.4, tubeR, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Tube body
      ctx.strokeStyle = '#2e3a50';
      ctx.lineWidth = tubeR * 2;
      ctx.beginPath();
      ctx.moveTo(sx, ty);
      ctx.lineTo(sx + sw, ty);
      ctx.stroke();
      // Steam flow in tube (animated)
      const steamFrac = Math.min(1, (inputs.qSteam || 0) / 500);
      ctx.strokeStyle = `rgba(200,200,255,${0.3 + steamFrac * 0.5})`;
      ctx.lineWidth = tubeR * 2 - 4;
      ctx.beginPath();
      ctx.moveTo(sx + 2, ty);
      ctx.lineTo(sx + sw - 2, ty);
      ctx.stroke();
    }

    // Steam inlet arrow (top)
    ctx.fillStyle = '#a080ff';
    ctx.font = 'bold 10px Barlow Condensed';
    ctx.textAlign = 'center';
    ctx.fillText('STEAM IN', sx + sw * 0.3, sy - 8);
    ctx.strokeStyle = '#a080ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.3, sy - 6);
    ctx.lineTo(sx + sw * 0.3, sy);
    ctx.stroke();

    // Condensate out (bottom)
    ctx.fillStyle = '#6a7590';
    ctx.font = '10px Barlow Condensed';
    ctx.fillText('CONDENSATE', sx + sw * 0.7, sy + sh + 14);
    ctx.strokeStyle = '#3a4258';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.7, sy + sh);
    ctx.lineTo(sx + sw * 0.7, sy + sh + 10);
    ctx.stroke();

    // Process flow direction
    ctx.fillStyle = '#00d4e8';
    ctx.textAlign = 'left';
    ctx.font = '9px Share Tech Mono';
    ctx.fillText(`IN: ${(inputs.tInlet || 0).toFixed(0)}°C`, sx - 5, sy + sh / 2 - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`OUT: ${tOut.toFixed(1)}°C`, sx + sw + 5, sy + sh / 2 - 4);

    // Temperature gradient overlay on shell
    const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy);
    grad.addColorStop(0, 'rgba(0,50,80,0.4)');
    grad.addColorStop(1, `rgba(${r},${g>>1},0,0.4)`);
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, sw, sh);

    // Temperature bar indicator
    const barX = W * 0.90, barY = sy, barH = sh, barW = 12;
    const tempGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    tempGrad.addColorStop(0, '#ff4455');
    tempGrad.addColorStop(0.5, '#f0a500');
    tempGrad.addColorStop(1, '#00d4e8');
    ctx.fillStyle = '#1a1f2a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = tempGrad;
    const fillH = tFrac * barH;
    ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
    ctx.strokeStyle = '#2e3a50';
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#f0a500';
    ctx.font = 'bold 10px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText(tOut.toFixed(0) + '°', barX + barW / 2, barY + barH - fillH - 4);

    ctx.fillStyle = '#6a7590';
    ctx.font = '10px Barlow Condensed';
    ctx.textAlign = 'center';
    ctx.fillText('HEAT EXCHANGER', W / 2, 14);
  }

  // ── Gauge Manager ─────────────────────────────────────
  const gauges = {};

  function buildGauges(outputDefs) {
    const row = document.getElementById('gaugesRow');
    row.innerHTML = '';
    Object.keys(gauges).forEach(k => delete gauges[k]);

    const colors = [C.amber, C.cyan, C.green, C.purple, C.red];
    outputDefs.forEach((out, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'gauge-wrap';
      const cv = document.createElement('canvas');
      cv.width = 110; cv.height = 90;
      const lbl = document.createElement('div');
      lbl.className = 'gauge-label';
      lbl.textContent = out.name + (out.unit ? ` (${out.unit})` : '');
      wrap.appendChild(cv);
      wrap.appendChild(lbl);
      row.appendChild(wrap);
      gauges[out.id] = { canvas: cv, min: out.min, max: out.max, color: colors[i % colors.length], unit: out.unit };
    });
  }

  function updateGauges(outputs) {
    for (const [id, g] of Object.entries(gauges)) {
      if (outputs[id] !== undefined) {
        drawGauge(g.canvas, outputs[id], g.min, g.max, id, g.color, g.unit);
      }
    }
  }

  // ── Trend Charts ──────────────────────────────────────
  let chartPV, chartCO, chartError, chartModel;
  let _processId = 'tank';
  let _animFrame = null;

  function init(processId) {
    _processId = processId;

    const cvPV    = document.getElementById('chartPV');
    const cvCO    = document.getElementById('chartCO');
    const cvError = document.getElementById('chartError');
    const cvModel = document.getElementById('chartModel');

    chartPV    = new TrendChart(cvPV,    { color: C.cyan,   color2: C.amber, windowSec: 120 });
    chartCO    = new TrendChart(cvCO,    { color: C.purple, windowSec: 120 });
    chartError = new TrendChart(cvError, { color: C.red,    windowSec: 120 });
    chartModel = new TrendChart(cvModel, { color: C.green,  color2: C.cyan,  windowSec: 120 });

    // Start render loop — redraw every frame so canvas resize is always caught
    function renderLoop() {
      chartPV.draw();
      chartCO.draw();
      chartError.draw();
      chartModel.draw();
      _animFrame = requestAnimationFrame(renderLoop);
    }
    if (_animFrame) cancelAnimationFrame(_animFrame);
    renderLoop();
  }

  function push(record) {
    chartPV.push(record.t, record.pv, record.sp);
    chartCO.push(record.t, record.co);
    chartError.push(record.t, record.error);
    chartModel.push(record.t, record.modelOutput ?? 0, record.pv);
  }

  function clearPlots() {
    chartPV    && chartPV.clear();
    chartCO    && chartCO.clear();
    chartError && chartError.clear();
    chartModel && chartModel.clear();
  }

  function drawProcessGraphic(processId, state, inputs) {
    const canvas = document.getElementById('processGraphic');
    if (!canvas) return;
    if (processId === 'tank') drawTankGraphic(canvas, state, inputs);
    else if (processId === 'heat') drawHeatExchangerGraphic(canvas, state, inputs);
    else {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a1f2a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#6a7590';
      ctx.font = '13px Barlow Condensed';
      ctx.textAlign = 'center';
      ctx.fillText('Custom Process — No Graphic', canvas.width / 2, canvas.height / 2);
    }
  }

  return { init, push, clearPlots, buildGauges, updateGauges, drawProcessGraphic };
})();

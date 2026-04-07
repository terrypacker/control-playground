/*
 * Copyright (c) 2026 Terry Packer.
 *
 * This file is part of Terry Packer's Work.
 * See www.terrypacker.com for further info.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    const maxFlowRate = 20; //Just a guess for now
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const level = state.level || 0;
    const maxLevel = 2.5;
    const fraction = level / maxLevel;

    const tankX = W * 0.30, tankW = W * 0.40;
    const tankTop = H * 0.2, tankH = H * 0.72;
    const tankBot = tankTop + tankH;

    // Inflow pipe
    const pipeTop = 20;
    ctx.strokeStyle = '#2e3a50';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(tankX + tankW * 0.35, pipeTop);
    ctx.lineTo(tankX + tankW * 0.35, tankTop);
    ctx.stroke();

    // Draw flowing water (inflow animation)
    const qIn = inputs.qIn || 0;
    if (qIn > 0.1) {
      const flowFrac = Math.min(1, qIn / maxFlowRate);
      ctx.strokeStyle = `rgba(0,212,232,${0.3 + flowFrac * 0.5})`;
      ctx.lineWidth = Math.max(2, flowFrac * 7);
      ctx.beginPath();
      ctx.moveTo(tankX + tankW * 0.35, pipeTop);
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
      const flowFrac = Math.min(1, qOut / maxFlowRate);
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
    ctx.fillText('INFLOW', (tankX + tankW * 0.35) + 20, pipeTop + 15);
    ctx.fillText('DRAIN', drainX + 20, H * 0.97);
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

  function drawSolarBatteryGraphic(canvas, state, inputs) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Unpack state & inputs with safe defaults
    const solarPower    = state.solarPower    ?? 0;
    const batterySOC    = state.batterySOC    ?? 0;
    const gridExport    = state.gridExport    ?? 0;
    const gridImport    = state.gridImport    ?? 0;
    const moneyEarned   = state.moneyEarned   ?? 0;
    const currentPrice  = state.currentPrice  ?? 0;
    const timeOfDay     = state.timeOfDay     ?? 12;

    const panelMaxOutput = inputs.panelMaxOutput ?? 10;
    const battCapacity   = inputs.battCapacity   ?? 20;
    const homeLoad       = inputs.homeLoad       ?? 2.5;

    const solarFrac  = clamp(solarPower  / panelMaxOutput, 0, 1);
    const battFrac   = clamp(batterySOC  / battCapacity,   0, 1);
    const exportFrac = clamp(gridExport  / panelMaxOutput, 0, 1);
    const importFrac = clamp(gridImport  / homeLoad,       0, 1);

    // ── Layout regions ───────────────────────────────────────────────────────
    //   [SUN]  [PANELS]  [HOUSE]  [BATTERY]  [GRID POLE]
    const midY      = H * 0.42;   // vertical centre line for all components
    const sunCX     = W * 0.08;
    const sunCY     = H * 0.22;
    const panelX    = W * 0.18;
    const panelY    = H * 0.12;
    const panelW    = W * 0.18;
    const panelH    = H * 0.28;
    const houseX    = W * 0.42;
    const houseY    = H * 0.18;
    const houseW    = W * 0.16;
    const houseH    = H * 0.26;
    const battX     = W * 0.62;
    const battY     = H * 0.14;
    const battW     = W * 0.09;
    const battH     = H * 0.34;
    const poleX     = W * 0.88;
    const poleTopY  = H * 0.10;
    const poleBotY  = H * 0.72;

    // ── Sky gradient ─────────────────────────────────────────────────────────
    const dayFrac = clamp(solarFrac, 0, 1);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    const nightTop  = '#0a0e1a', nightBot  = '#1a2035';
    const dayTop    = '#1a6fba', dayBot    = '#5ab4e8';
    function blendHex(a, b, t) {
      const p = (h) => parseInt(h, 16);
      const r = (s, i) => parseInt(s.slice(i, i+2), 16);
      const bl = (ca, cb) => Math.round(lerp(r(ca,1), r(cb,1), t)).toString(16).padStart(2,'0');
      return '#' + bl(a.slice(1,3), b.slice(1,3)) +
          bl(a.slice(3,5), b.slice(3,5)) +
          bl(a.slice(5,7), b.slice(5,7));
    }
    skyGrad.addColorStop(0, blendHex(nightTop, dayTop, dayFrac));
    skyGrad.addColorStop(1, blendHex(nightBot, dayBot, dayFrac));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.75);

    // Ground
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.fillStyle = '#22361e';
    ctx.fillRect(0, H * 0.72, W, H * 0.04);

    // ── Title ────────────────────────────────────────────────────────────────
    const hh = Math.floor(timeOfDay);
    const mm = Math.floor((timeOfDay - hh) * 60);
    const ampm = hh < 12 ? 'AM' : 'PM';
    const hh12 = ((hh % 12) || 12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SOLAR BATTERY SYSTEM', W / 2, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Share Tech Mono, monospace';
    ctx.fillText(`${hh12}:${mm.toString().padStart(2,'0')} ${ampm}`, W / 2, 25);

    // ── Sun ───────────────────────────────────────────────────────────────────
    const sunR     = W * 0.055;
    const sunAlpha = clamp(dayFrac * 1.2, 0, 1);
    // Rays
    ctx.save();
    ctx.translate(sunCX, sunCY);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = `rgba(255,200,50,${sunAlpha * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, sunR + 4);
      ctx.lineTo(0, sunR + 10);
      ctx.stroke();
    }
    ctx.restore();
    // Disc
    const sunGrad = ctx.createRadialGradient(sunCX, sunCY, 0, sunCX, sunCY, sunR);
    sunGrad.addColorStop(0, `rgba(255,230,100,${sunAlpha})`);
    sunGrad.addColorStop(1, `rgba(255,160,20,${sunAlpha * 0.6})`);
    ctx.beginPath();
    ctx.arc(sunCX, sunCY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();
    // Stars (night)
    if (dayFrac < 0.5) {
      const starAlpha = (0.5 - dayFrac) * 2;
      ctx.fillStyle = `rgba(255,255,255,${starAlpha})`;
      [[W*0.55,H*0.06],[W*0.65,H*0.03],[W*0.72,H*0.08],[W*0.80,H*0.05],[W*0.90,H*0.09],[W*0.45,H*0.04]].forEach(([sx,sy]) => {
        ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI*2); ctx.fill();
      });
    }

    // ── Solar beam from sun → panels ─────────────────────────────────────────
    if (solarFrac > 0.05) {
      const beamAlpha = solarFrac * 0.45;
      const beamGrad = ctx.createLinearGradient(sunCX + sunR, sunCY, panelX, panelY + panelH * 0.3);
      beamGrad.addColorStop(0, `rgba(255,220,80,${beamAlpha})`);
      beamGrad.addColorStop(1, `rgba(255,220,80,0)`);
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = Math.max(2, solarFrac * 8);
      ctx.beginPath();
      ctx.moveTo(sunCX + sunR, sunCY);
      ctx.lineTo(panelX, panelY + panelH * 0.3);
      ctx.stroke();
    }

    // ── Solar panel array ────────────────────────────────────────────────────
    const rows = 3, cols = 2;
    const cellW = panelW / cols - 3;
    const cellH = panelH / rows - 4;
    ctx.strokeStyle = '#1a2a3a';
    ctx.lineWidth = 1;
    // Panel frame
    ctx.strokeStyle = '#2e3a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX - 3, panelY - 3, panelW + 6, panelH + 6);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = panelX + c * (cellW + 3);
        const cy = panelY + r * (cellH + 4);
        // Panel cell fill — blue tint when active
        const panelBright = lerp(0.08, 0.35, solarFrac);
        ctx.fillStyle = `rgba(20,60,${Math.round(80 + solarFrac * 120)},${panelBright + 0.55})`;
        ctx.fillRect(cx, cy, cellW, cellH);
        // Grid lines on cell
        ctx.strokeStyle = `rgba(100,180,255,${0.2 + solarFrac * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cx, cy, cellW, cellH);
        ctx.beginPath();
        ctx.moveTo(cx + cellW/2, cy); ctx.lineTo(cx + cellW/2, cy + cellH);
        ctx.moveTo(cx, cy + cellH/2); ctx.lineTo(cx + cellW, cy + cellH/2);
        ctx.stroke();
        // Glint when producing
        if (solarFrac > 0.1) {
          ctx.fillStyle = `rgba(255,255,255,${solarFrac * 0.18})`;
          ctx.fillRect(cx + 2, cy + 2, cellW * 0.35, cellH * 0.35);
        }
      }
    }
    // Mount post
    ctx.strokeStyle = '#2e3a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(panelX + panelW/2, panelY + panelH);
    ctx.lineTo(panelX + panelW/2, H * 0.72);
    ctx.stroke();
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PANELS', panelX + panelW/2, panelY + panelH + 14);
    ctx.fillStyle = solarFrac > 0.05 ? '#f0d050' : 'rgba(255,255,255,0.35)';
    ctx.fillText(solarPower.toFixed(1) + ' kW', panelX + panelW/2, panelY + panelH + 25);

    // ── Flow: panels → house ─────────────────────────────────────────────────
    const flowPH_y = midY - H * 0.02;
    const homeLoadFrac = clamp(homeLoad / panelMaxOutput, 0, 1);
    const flowingToHouse = solarFrac > 0.01 || importFrac > 0.01;
    if (flowingToHouse) {
      const fc = solarFrac > 0.01 ? solarFrac : importFrac;
      ctx.strokeStyle = `rgba(255,210,50,${0.3 + fc * 0.55})`;
      ctx.lineWidth = Math.max(1.5, fc * 5);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(panelX + panelW, flowPH_y);
      ctx.lineTo(houseX, flowPH_y);
      ctx.stroke();
      // Animated flow dots
      const t = (Date.now() / 600) % 1;
      for (let i = 0; i < 3; i++) {
        const ft = (t + i / 3) % 1;
        const dx = lerp(panelX + panelW, houseX, ft);
        ctx.beginPath();
        ctx.arc(dx, flowPH_y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,80,${0.9 - ft * 0.5})`;
        ctx.fill();
      }
    }

    // ── House ────────────────────────────────────────────────────────────────
    const roofPeak = { x: houseX + houseW/2, y: houseY };
    // Roof
    ctx.beginPath();
    ctx.moveTo(houseX - 6, houseY + houseH * 0.35);
    ctx.lineTo(roofPeak.x, roofPeak.y);
    ctx.lineTo(houseX + houseW + 6, houseY + houseH * 0.35);
    ctx.closePath();
    ctx.fillStyle = '#8B3030';
    ctx.fill();
    ctx.strokeStyle = '#5a1f1f';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Walls
    ctx.fillStyle = '#d4c5a0';
    ctx.fillRect(houseX, houseY + houseH * 0.35, houseW, houseH * 0.65);
    ctx.strokeStyle = '#a09070';
    ctx.lineWidth = 1;
    ctx.strokeRect(houseX, houseY + houseH * 0.35, houseW, houseH * 0.65);
    // Door
    const dw = houseW * 0.22, dh = houseH * 0.32;
    const dx_ = houseX + houseW/2 - dw/2;
    const dy_ = houseY + houseH - dh;
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(dx_, dy_, dw, dh);
    // Windows — lit based on home load
    const winBright = 0.4 + importFrac * 0.5;
    ctx.fillStyle = `rgba(255,230,100,${winBright})`;
    ctx.fillRect(houseX + houseW * 0.12, houseY + houseH * 0.45, houseW * 0.22, houseH * 0.18);
    ctx.fillRect(houseX + houseW * 0.66, houseY + houseH * 0.45, houseW * 0.22, houseH * 0.18);
    ctx.strokeStyle = '#8a7040';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(houseX + houseW * 0.12, houseY + houseH * 0.45, houseW * 0.22, houseH * 0.18);
    ctx.strokeRect(houseX + houseW * 0.66, houseY + houseH * 0.45, houseW * 0.22, houseH * 0.18);
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', houseX + houseW/2, houseY + houseH + 14);
    ctx.fillStyle = homeLoad > 0 ? '#e08040' : 'rgba(255,255,255,0.35)';
    ctx.fillText(homeLoad.toFixed(1) + ' kW', houseX + houseW/2, houseY + houseH + 25);

    // Grid import indicator (dashed red line from grid → house if importing)
    if (gridImport > 0.05) {
      ctx.strokeStyle = `rgba(230,80,80,${0.4 + importFrac * 0.5})`;
      ctx.lineWidth = Math.max(1, importFrac * 3);
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(poleX - 10, midY + H * 0.08);
      ctx.lineTo(houseX + houseW, midY + H * 0.08);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(230,80,80,0.85)';
      ctx.font = '8px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('IMPORTING', (poleX + houseX + houseW) / 2, midY + H * 0.08 - 4);
    }

    // ── Flow: house → battery ────────────────────────────────────────────────
    const chargingBatt = batterySOC < battCapacity && solarFrac > 0.05;
    if (chargingBatt) {
      const fc = solarFrac * 0.6;
      ctx.strokeStyle = `rgba(50,200,130,${0.35 + fc * 0.5})`;
      ctx.lineWidth = Math.max(1.5, fc * 4);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(houseX + houseW, midY - H * 0.06);
      ctx.lineTo(battX, midY - H * 0.06);
      ctx.stroke();
      const t = (Date.now() / 700) % 1;
      for (let i = 0; i < 2; i++) {
        const ft = (t + i / 2) % 1;
        const px_ = lerp(houseX + houseW, battX, ft);
        ctx.beginPath();
        ctx.arc(px_, midY - H * 0.06, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(50,220,130,0.9)`;
        ctx.fill();
      }
    }

    // ── Battery ───────────────────────────────────────────────────────────────
    // Terminal nub
    const termW = battW * 0.4, termH = battH * 0.025;
    ctx.fillStyle = '#4a5060';
    ctx.fillRect(battX + battW/2 - termW/2, battY - termH, termW, termH);
    // Outer shell
    ctx.fillStyle = '#2a3040';
    ctx.strokeStyle = '#4a5a6a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(battX, battY, battW, battH, 4);
    ctx.fill();
    ctx.stroke();
    // Fill level
    const fillH = battH * 0.88 * battFrac;
    const fillY = battY + battH * 0.88 - fillH + battH * 0.06;
    const battColor = battFrac > 0.5 ? '#1D9E75' : battFrac > 0.2 ? '#BA7517' : '#E24B4A';
    ctx.fillStyle = battColor;
    ctx.beginPath();
    ctx.roundRect(battX + 3, fillY, battW - 6, fillH, 2);
    ctx.fill();
    // Segment lines
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      const sy = battY + battH * 0.06 + (battH * 0.88 / 5) * i;
      ctx.beginPath(); ctx.moveTo(battX + 3, sy); ctx.lineTo(battX + battW - 3, sy); ctx.stroke();
    }
    // Charge indicator flash
    if (chargingBatt) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(Date.now() / 300) * 0.3})`;
      ctx.font = 'bold 11px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', battX + battW/2, battY + battH/2 + 4);
    }
    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BATT', battX + battW/2, battY + battH + 14);
    ctx.fillStyle = battColor;
    ctx.fillText(Math.round(battFrac * 100) + '%', battX + battW/2, battY + battH + 25);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(batterySOC.toFixed(1) + ' kWh', battX + battW/2, battY + battH + 36);

    // ── Flow: battery/panels → grid ──────────────────────────────────────────
    const exportY = midY + H * 0.02;
    if (gridExport > 0.05) {
      const fc = exportFrac;
      ctx.strokeStyle = `rgba(255,200,50,${0.35 + fc * 0.5})`;
      ctx.lineWidth = Math.max(1.5, fc * 5);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(battX + battW, exportY);
      ctx.lineTo(poleX - 12, exportY);
      ctx.stroke();
      const t = (Date.now() / 500) % 1;
      for (let i = 0; i < 3; i++) {
        const ft = (t + i / 3) % 1;
        const px_ = lerp(battX + battW, poleX - 12, ft);
        ctx.beginPath();
        ctx.arc(px_, exportY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,220,60,0.9)`;
        ctx.fill();
      }
    }

    // ── Grid pole ────────────────────────────────────────────────────────────
    // Pole
    ctx.strokeStyle = '#4a4a3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(poleX, poleTopY + 10);
    ctx.lineTo(poleX, poleBotY);
    ctx.stroke();
    // Cross arm
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(poleX - W*0.05, poleTopY + 10);
    ctx.lineTo(poleX + W*0.05, poleTopY + 10);
    ctx.stroke();
    // Insulators
    [-1, 1].forEach(side => {
      const ix = poleX + side * W * 0.04;
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(ix, poleTopY + 12, 3, 0, Math.PI * 2); ctx.fill();
    });
    // Wires from insulators going off-screen
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    [-1, 1].forEach(side => {
      const ix = poleX + side * W * 0.04;
      ctx.beginPath();
      ctx.moveTo(ix, poleTopY + 12);
      ctx.quadraticCurveTo(ix + side * W * 0.03, poleTopY + 22, side > 0 ? W : 0, poleTopY + 18);
      ctx.stroke();
    });
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GRID', poleX, poleBotY + 14);
    const priceColor = currentPrice > inputs.baseSalePrice * 1.2 ? '#f0d050' :
        currentPrice < inputs.baseSalePrice * 0.9 ? '#e08080' : '#80e0a0';
    ctx.fillStyle = priceColor;
    ctx.fillText('$' + currentPrice.toFixed(3) + '/kWh', poleX, poleBotY + 25);

    // ── Price window label ───────────────────────────────────────────────────
    const hr = state.timeOfDay;
    let windowLabel = 'OFF-PEAK';
    let windowColor = 'rgba(150,150,200,0.7)';
    if (hr >= 6 && hr < 9)  { windowLabel = 'MORNING PEAK'; windowColor = 'rgba(240,200,60,0.85)'; }
    else if (hr >= 9 && hr < 16)  { windowLabel = 'SOLAR TROUGH'; windowColor = 'rgba(80,180,120,0.75)'; }
    else if (hr >= 16 && hr < 21) { windowLabel = 'EVENING PEAK'; windowColor = 'rgba(240,140,60,0.85)'; }
    ctx.fillStyle = windowColor;
    ctx.font = 'bold 10px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(windowLabel, W - 8, 13);

    // ── Revenue readout ───────────────────────────────────────────────────────
    const revenueColor = moneyEarned >= 0 ? '#39e080' : '#ff4455';
    ctx.fillStyle = revenueColor;
    ctx.font = 'bold 12px Share Tech Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText((moneyEarned >= 0 ? '+' : '') + '$' + moneyEarned.toFixed(3), 8, H * 0.72 + 14);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.fillText('SESSION REVENUE', 8, H * 0.72 + 25);

    // ── Overflow / low battery warnings ──────────────────────────────────────
    if (battFrac >= 0.98) {
      ctx.fillStyle = 'rgba(240,200,50,0.85)';
      ctx.font = 'bold 9px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BATT FULL', battX + battW/2, battY - 8);
    }
    if (battFrac <= 0.05 && gridExport > 0.05) {
      ctx.fillStyle = 'rgba(230,80,80,0.85)';
      ctx.font = 'bold 9px Share Tech Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LOW BATT', battX + battW/2, battY - 8);
    }
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
    else if (processId === 'solarBattery') drawSolarBatteryGraphic(canvas, state, inputs);
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

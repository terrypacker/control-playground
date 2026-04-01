/* ui.js — Main UI Wiring & Simulation Orchestrator */
'use strict';

// ══════════════════════════════════════════════════════════════
// STATE: input values & controller wiring
// ══════════════════════════════════════════════════════════════
const UIState = {
  processInputValues: {},   // {inputId: value}
  coTargetInputId: null,    // which process input receives controller output
  sampleOutputId: null,     // which process output feeds sampler→controller
  graphicAnimTimer: 0,
  _lastGraphicT: -1,
};

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }

function buildProcessInputs(processId) {
  const proc = Processes.getDefinition(processId);
  const container = $('processInputs');
  container.innerHTML = '';
  UIState.processInputValues = {};

  proc.inputs.forEach(inp => {
    UIState.processInputValues[inp.id] = inp.default;

    const div = document.createElement('div');
    div.className = 'input-item';
    div.dataset.inputId = inp.id;

    div.innerHTML = `
      <div class="input-item-header">
        <span class="input-name">${inp.name} <span style="color:var(--text-muted);font-size:10px">${inp.unit}</span></span>
        <span class="input-value-display" id="val_${inp.id}">${inp.default.toFixed(2)}</span>
      </div>
      <div class="input-source-toggle">
        <button class="src-btn active" data-src="manual" data-inp="${inp.id}">MANUAL</button>
        <button class="src-btn" data-src="controller" data-inp="${inp.id}">CONTROLLER</button>
      </div>
      <input type="range" class="input-slider" id="slider_${inp.id}"
        min="${inp.min}" max="${inp.max}" step="${(inp.max - inp.min) / 500}"
        value="${inp.default}">
      <div class="input-limits">
        <span>${inp.min} ${inp.unit}</span>
        <span>${inp.max} ${inp.unit}</span>
      </div>
    `;
    container.appendChild(div);

    // Slider event
    const slider = div.querySelector(`#slider_${inp.id}`);
    slider.addEventListener('input', e => {
      UIState.processInputValues[inp.id] = parseFloat(e.target.value);
      $(`val_${inp.id}`).textContent = parseFloat(e.target.value).toFixed(3);
    });

    // Source toggle — route through shared setCoTarget so both panels stay in sync
    div.querySelectorAll('.src-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.src;
        if (src === 'controller') {
          setCoTarget(inp.id);
        } else {
          // Only clear if this input currently owns the controller output
          if (UIState.coTargetInputId === inp.id) setCoTarget(null);
        }
      });
    });
  });
}

function buildProcessOutputs(processId) {
  const proc = Processes.getDefinition(processId);
  const container = $('processOutputs');
  container.innerHTML = '';

  // Which output feeds the sampler
  UIState.sampleOutputId = proc.outputs[0].id;

  proc.outputs.forEach((out, i) => {
    const div = document.createElement('div');
    div.className = 'output-item';
    div.style.cursor = 'pointer';
    div.title = 'Click to use as sampler input';
    div.dataset.outId = out.id;
    div.innerHTML = `
      <span class="output-name">
        <span id="outSel_${out.id}" style="color:var(--amber);margin-right:4px">${i === 0 ? '▶' : '○'}</span>
        ${out.name} <span style="color:var(--text-muted);font-size:10px">${out.unit}</span>
      </span>
      <span class="output-value mono" id="outVal_${out.id}">—</span>
    `;
    div.addEventListener('click', () => {
      UIState.sampleOutputId = out.id;
      proc.outputs.forEach(o => {
        $('outSel_' + o.id).textContent = o.id === out.id ? '▶' : '○';
      });
    });
    container.appendChild(div);
  });

  // Build CO target dropdown
  const sel = $('coTargetInput');
  sel.innerHTML = '';
  proc.inputs.forEach(inp => {
    const opt = document.createElement('option');
    opt.value = inp.id;
    opt.textContent = `${inp.name} (${inp.unit})`;
    sel.appendChild(opt);
  });
  // Always reset to the default control target for this process
  const defaultTarget = proc.inputs.find(i => i.controlTarget)?.id || proc.inputs[0].id;
  // Defer so buildProcessInputs DOM is fully in place before setCoTarget queries it
  setTimeout(() => setCoTarget(defaultTarget), 0);
}

/**
 * Single source of truth for which process input the controller drives.
 * Pass null to release controller control entirely.
 * Updates: UIState, all MANUAL/CONTROLLER buttons, all sliders, and the dropdown.
 */
function setCoTarget(inputId) {
  UIState.coTargetInputId = inputId;

  // ── Sync the Process panel buttons & sliders ──
  const proc = Processes.getCurrent();
  proc.inputs.forEach(inp => {
    const div = document.querySelector(`.input-item[data-input-id="${inp.id}"]`);
    if (!div) return;
    const slider = div.querySelector(`#slider_${inp.id}`);
    const manualBtn = div.querySelector('.src-btn[data-src="manual"]');
    const ctrlBtn   = div.querySelector('.src-btn[data-src="controller"]');
    if (!slider || !manualBtn || !ctrlBtn) return;

    if (inp.id === inputId) {
      ctrlBtn.classList.add('active');
      manualBtn.classList.remove('active');
      slider.classList.add('controller-driven');
      slider.disabled = true;
    } else {
      manualBtn.classList.add('active');
      ctrlBtn.classList.remove('active');
      slider.classList.remove('controller-driven');
      slider.disabled = false;
    }
  });

  // ── Sync the Controller dropdown ──
  const sel = $('coTargetInput');
  if (sel) sel.value = inputId ?? '';
}

function buildControllerParams(algId) {
  const alg = Controller.algorithms[algId];
  const container = $('controllerParams');
  container.innerHTML = '';

  const params = Object.entries(alg.params);
  if (params.length === 0) return;

  // Layout in rows of 3
  for (let i = 0; i < params.length; i += 3) {
    const row = document.createElement('div');
    row.className = 'param-row';
    params.slice(i, i + 3).forEach(([key, def]) => {
      const item = document.createElement('div');
      item.className = 'param-item';
      item.innerHTML = `
        <div class="param-label">${def.label}</div>
        <input class="param-input" type="number"
          value="${def.value}" min="${def.min}" max="${def.max}" step="${def.step}"
          data-alg="${algId}" data-param="${key}">
      `;
      item.querySelector('input').addEventListener('change', e => {
        Controller.setParamValue(algId, key, parseFloat(e.target.value));
      });
      row.appendChild(item);
    });
    container.appendChild(row);
  }
}

function buildModelParams(modelId) {
  const model = Modeler.models[modelId];
  const container = $('modelParams');
  container.innerHTML = '';

  const params = Object.entries(model.params);
  if (params.length === 0) return;

  for (let i = 0; i < params.length; i += 3) {
    const row = document.createElement('div');
    row.className = 'param-row';
    params.slice(i, i + 3).forEach(([key, def]) => {
      const item = document.createElement('div');
      item.className = 'param-item';
      item.innerHTML = `
        <div class="param-label">${def.label}</div>
        <input class="param-input" type="number"
          value="${def.value}" min="${def.min}" max="${def.max}" step="${def.step}"
          data-model="${modelId}" data-param="${key}">
      `;
      item.querySelector('input').addEventListener('change', e => {
        Modeler.setParamValue(modelId, key, parseFloat(e.target.value));
      });
      row.appendChild(item);
    });
    container.appendChild(row);
  }
}

// ══════════════════════════════════════════════════════════════
// DEFAULT CUSTOM CODE TEMPLATES
// ══════════════════════════════════════════════════════════════
const CUSTOM_PROCESS_TEMPLATE = `// Custom Process
// inputs: { u1, u2 } (from your input definitions)
// state:  { y1, _x } (persistent state)
// dt:     simulation timestep (seconds)
// Return: updated state fields e.g. { y1: newValue }

const tau = 10;  // time constant
const K = 1.5;   // gain
const dxdt = (-state._x + K * inputs.u1) / tau;
state._x += dxdt * dt;
state.y1 = state._x;
return { y1: state.y1, _x: state._x };
`;

const CUSTOM_CONTROLLER_TEMPLATE = `// Custom Controller
// pv:    measured process variable (sampled)
// sp:    setpoint
// dt:    sample interval (seconds)
// state: persistent object for your variables
// Return: { output: <number>, error: sp - pv, ... }

if (!state.integral) state.integral = 0;
const error = sp - pv;
state.integral += error * dt;
const Kp = 1.0, Ki = 0.05;
const output = Math.max(0, Math.min(100, Kp * error + Ki * state.integral));
return { output, error };
`;

// ══════════════════════════════════════════════════════════════
// SIMULATION ORCHESTRATION (tick handler)
// ══════════════════════════════════════════════════════════════
let _graphicRate = 15; // Hz for graphic updates
let _lastGraphicTime = -1;

Core.on('tick', ({ t, dt, step }) => {
  const processId = Processes.getCurrentId();
  const proc = Processes.getCurrent();

  // ── Build effective input values ──
  const inputs = { ...UIState.processInputValues };

  // ── Run sampler on the PREVIOUS output (so controller acts before process) ──
  const prevOutputs = Processes.getOutputs();
  const rawPV = prevOutputs[UIState.sampleOutputId] ?? 0;
  const sampledPV = Sampler.update(rawPV, t, dt) ?? rawPV;

  // ── Run controller ──
  const ctrlResult = Controller.compute(sampledPV, dt);
  const co = ctrlResult.output;

  // ── Apply CO to target input ──
  if (UIState.coTargetInputId) {
    inputs[UIState.coTargetInputId] = co;
    // Update slider display
    const targetDef = proc.inputs.find(i => i.id === UIState.coTargetInputId);
    if (targetDef) {
      const slider = $('slider_' + UIState.coTargetInputId);
      const valEl = $('val_' + UIState.coTargetInputId);
      if (slider) {
        slider.value = Math.max(targetDef.min, Math.min(targetDef.max, co));
        if (valEl) valEl.textContent = co.toFixed(3);
      }
    }
  }

  // ── Step process ──
  const outputs = Processes.step(inputs, dt);

  // ── Step model ──
  const modelIn = inputs[UIState.coTargetInputId] ?? 0;
  Modeler.step(modelIn, t, dt);

  // ── Record history ──
  const sp = Controller.getSetpoint();
  const error = sp - sampledPV;
  const record = { t, pv: sampledPV, sp, co, error };
  Core.pushHistory(record);

  // ── Push to charts (throttled) ──
  const chartEvery = Math.max(1, Math.round(1 / (Sampler.cfg.rate * Core.state.dt)));
  if (step % chartEvery === 0) {
    Visuals.push(record);
  }

  // ── Update gauges & outputs (every 10 ticks) ──
  if (step % 10 === 0) {
    proc.outputs.forEach(out => {
      const el = $('outVal_' + out.id);
      if (el && outputs[out.id] !== undefined) {
        el.textContent = outputs[out.id].toFixed(3) + ' ' + out.unit;
      }
    });
    Visuals.updateGauges(outputs);

    // Sampler display
    const pvEl = $('sampledPV');
    if (pvEl) pvEl.textContent = sampledPV.toFixed(3);

    // CO display
    const coEl = $('coOutput');
    if (coEl) coEl.textContent = co.toFixed(3);
  }

  // ── Process graphic (smooth-ish) ──
  if (t - _lastGraphicTime >= 1 / _graphicRate) {
    _lastGraphicTime = t;
    Visuals.drawProcessGraphic(processId, { ...proc.state }, inputs);
  }
});

Core.on('tick', ({ t }) => {
  // Header updates every real render — just update the time displays
  if (Core.state.step % 5 === 0) {
    const simT = $('simTimeDisplay');
    const stepD = $('stepDisplay');
    if (simT) simT.textContent = t.toFixed(1) + ' s';
    if (stepD) stepD.textContent = Core.state.step;
  }
});

// ══════════════════════════════════════════════════════════════
// STATUS UPDATES
// ══════════════════════════════════════════════════════════════
Core.on('start', () => {
  $('statusDot').className = 'status-dot running';
  $('statusLabel').textContent = 'RUNNING';
  $('simStatus').style.color = 'var(--green)';
});
Core.on('stop', () => {
  $('statusDot').className = 'status-dot stopped';
  $('statusLabel').textContent = 'STOPPED';
  $('simStatus').style.color = '';
});
Core.on('reset', () => {
  $('statusDot').className = 'status-dot';
  $('statusLabel').textContent = 'RESET';
  $('simTimeDisplay').textContent = '0.0 s';
  $('stepDisplay').textContent = '0';
  $('sampledPV').textContent = '—';
  $('coOutput').textContent = '—';
  Sampler.reset();
  Controller.reset();
  Modeler.reset();
  Processes.getCurrent().reset();
  Visuals.clearPlots();
  Visuals.drawProcessGraphic(Processes.getCurrentId(), Processes.getCurrent().state, UIState.processInputValues);
});

// ══════════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════════
function init() {
  const initProcess = 'tank';
  Processes.setCurrent(initProcess);
  buildProcessInputs(initProcess);
  buildProcessOutputs(initProcess);

  const initController = 'pid';
  Controller.setCurrent(initController);
  buildControllerParams(initController);

  const initModel = 'fopdt';
  Modeler.setCurrent(initModel);
  buildModelParams(initModel);

  Visuals.init(initProcess);
  Visuals.buildGauges(Processes.getDefinition(initProcess).outputs);
  Visuals.drawProcessGraphic(initProcess, Processes.getCurrent().state, UIState.processInputValues);

  // Set default custom code
  $('customProcessCode').value = CUSTOM_PROCESS_TEMPLATE;
  $('customControllerCode').value = CUSTOM_CONTROLLER_TEMPLATE;

  // ── Time controls ──
  $('btnStart').addEventListener('click', () => Core.start());
  $('btnStop').addEventListener('click', () => Core.stop());
  $('btnReset').addEventListener('click', () => Core.reset());
  $('btnClearPlots').addEventListener('click', () => Visuals.clearPlots());

  $('speedSlider').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    Core.setSpeed(v);
    $('speedLabel').textContent = v.toFixed(1) + '×';
  });

  // ── Process selector ──
  $('processSelector').addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    const id = btn.dataset.process;
    if (!id) return;

    $('processSelector').querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('processBadge').textContent = Processes.getDefinition(id).name.toUpperCase();

    const wasRunning = Core.state.running;
    if (wasRunning) Core.stop();

    Processes.setCurrent(id);
    buildProcessInputs(id);
    buildProcessOutputs(id);
    Sampler.reset();
    Visuals.buildGauges(Processes.getDefinition(id).outputs);
    Visuals.drawProcessGraphic(id, Processes.getCurrent().state, UIState.processInputValues);
    Visuals.clearPlots();

    $('customProcessEditor').classList.toggle('hidden', id !== 'custom');

    if (wasRunning) Core.start();
  });

  // ── Custom process apply ──
  $('btnApplyProcess').addEventListener('click', () => {
    const code = $('customProcessCode').value;
    const errEl = $('processCodeError');
    try {
      // Wrap in a function: (inputs, state, dt) => { <code> }
      const fn = new Function('inputs', 'state', 'dt', code);
      Processes.setCustomFn(fn);
      errEl.textContent = '✓ Applied';
      setTimeout(() => errEl.textContent = '', 2000);
    } catch (e) {
      errEl.textContent = '✗ ' + e.message;
    }
  });

  // ── Controller selector ──
  $('controllerSelector').addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    const id = btn.dataset.controller;
    if (!id) return;

    $('controllerSelector').querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('controllerBadge').textContent = id.toUpperCase();

    Controller.setCurrent(id);
    buildControllerParams(id);
    $('customControllerEditor').classList.toggle('hidden', id !== 'custom');
  });

  // ── Custom controller apply ──
  $('btnApplyController').addEventListener('click', () => {
    const code = $('customControllerCode').value;
    const errEl = $('controllerCodeError');
    try {
      const fn = new Function('pv', 'sp', 'dt', 'state', code);
      Controller.setCustomFn(fn);
      errEl.textContent = '✓ Applied';
      setTimeout(() => errEl.textContent = '', 2000);
    } catch (e) {
      errEl.textContent = '✗ ' + e.message;
    }
  });

  // ── Setpoint ──
  $('setpoint').addEventListener('change', e => {
    Controller.setSetpoint(parseFloat(e.target.value));
  });
  Controller.setSetpoint(50);

  // ── CO target input (dropdown) ──
  $('coTargetInput').addEventListener('change', e => {
    setCoTarget(e.target.value);
  });

  // ── Sampler params ──
  $('sampleRate').addEventListener('change', e => Sampler.configure({ rate: parseFloat(e.target.value) }));
  $('noiseLevel').addEventListener('change', e => Sampler.configure({ noiseSigma: parseFloat(e.target.value) }));
  $('deadTime').addEventListener('change', e => Sampler.configure({ deadTime: parseFloat(e.target.value) }));
  $('filterTau').addEventListener('change', e => Sampler.configure({ filterTau: parseFloat(e.target.value) }));

  // ── Model selector ──
  $('modelSelector').addEventListener('click', e => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    const id = btn.dataset.model;
    if (!id) return;

    $('modelSelector').querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Modeler.setCurrent(id);
    buildModelParams(id);
  });

  // ── Model enabled toggle ──
  $('modelEnabled').addEventListener('change', e => {
    Modeler.setEnabled(e.target.checked);
  });

  // ── Auto-fit model ──
  $('btnFitModel').addEventListener('click', () => {
    const result = Modeler.autoFit(Core.state.history);
    const info = $('modelFitInfo');
    if (result.ok) {
      info.textContent = '✓ ' + result.msg;
      // Rebuild model params UI to reflect new values
      buildModelParams(Modeler.getCurrentId());
    } else {
      info.textContent = '✗ ' + result.msg;
    }
  });

  $('btnResetModel').addEventListener('click', () => {
    Modeler.reset();
    $('modelFitInfo').textContent = '';
  });

  // ── Set some sensible defaults for tank process ──
  // Tank level: SP = 1.0m (out of 2.5m)
  $('setpoint').value = 1.0;
  Controller.setSetpoint(1.0);

  // PID defaults for tank
  Controller.setParamValue('pid', 'Kp', 5.0);
  Controller.setParamValue('pid', 'Ki', 0.3);
  Controller.setParamValue('pid', 'Kd', 0.5);
  Controller.setParamValue('pid', 'outMin', 0);
  Controller.setParamValue('pid', 'outMax', 50);
  buildControllerParams('pid');

  // Draw initial graphic
  setTimeout(() => {
    Visuals.drawProcessGraphic('tank', Processes.getCurrent().state, UIState.processInputValues);
  }, 100);
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);

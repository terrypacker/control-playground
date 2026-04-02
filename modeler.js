/* modeler.js — Process Model Builder */
'use strict';

const Modeler = (() => {

  const models = {

    // First-Order Plus Dead Time
    fopdt: {
      name: 'FOPDT',
      params: {
        K:    { label: 'Gain K',       value: 1.0,  min: -100,  max: 100,  step: 0.1 },
        tau:  { label: 'Time Const τ', value: 10.0, min: 0.1,   max: 500,  step: 0.1 },
        theta:{ label: 'Dead Time θ',  value: 1.0,  min: 0,     max: 100,  step: 0.1 },
        bias: { label: 'Bias',         value: 0.0,  min: -1000, max: 1000, step: 0.1 },
      },
      _x: 0,
      _deadBuf: [],
      reset() { this._x = 0; this._deadBuf = []; },
      step(u, t, dt, params) {
        const { K, tau, theta, bias } = params;
        // Dead-time buffer
        this._deadBuf.push({ u, t });
        while (this._deadBuf.length > 1 && this._deadBuf[1].t <= t - theta) {
          this._deadBuf.shift();
        }
        const uDelayed = theta > 0 ? this._deadBuf[0].u : u;
        // First-order ODE: tau * dx/dt = -x + K*u
        const dxdt = (-this._x + K * uDelayed) / Math.max(tau, 0.001);
        this._x += dxdt * dt;
        return this._x + bias;
      },
    },

    // Second-Order Plus Dead Time
    sopdt: {
      name: 'SOPDT',
      params: {
        K:    { label: 'Gain K',       value: 1.0,  min: -100, max: 100, step: 0.1 },
        tau1: { label: 'τ₁',           value: 10.0, min: 0.1,  max: 300, step: 0.1 },
        tau2: { label: 'τ₂',           value: 5.0,  min: 0.1,  max: 300, step: 0.1 },
        theta:{ label: 'Dead Time θ',  value: 1.0,  min: 0,    max: 100, step: 0.1 },
        bias: { label: 'Bias',         value: 0.0,  min: -1000,max: 1000,step: 0.1 },
      },
      _x1: 0, _x2: 0, _deadBuf: [],
      reset() { this._x1 = 0; this._x2 = 0; this._deadBuf = []; },
      step(u, t, dt, params) {
        const { K, tau1, tau2, theta, bias } = params;
        this._deadBuf.push({ u, t });
        while (this._deadBuf.length > 1 && this._deadBuf[1].t <= t - theta) {
          this._deadBuf.shift();
        }
        const uD = theta > 0 ? this._deadBuf[0].u : u;
        // Two cascaded first-order systems
        const dx1dt = (-this._x1 + K * uD) / Math.max(tau1, 0.001);
        this._x1 += dx1dt * dt;
        const dx2dt = (-this._x2 + this._x1) / Math.max(tau2, 0.001);
        this._x2 += dx2dt * dt;
        return this._x2 + bias;
      },
    },

    // ARX (AutoRegressive with eXogenous input)
    arx: {
      name: 'ARX',
      params: {
        a1:  { label: 'a₁ (AR coef)',  value: 0.9,  min: -2, max: 2, step: 0.01 },
        a2:  { label: 'a₂ (AR coef)',  value: -0.1, min: -2, max: 2, step: 0.01 },
        b1:  { label: 'b₁ (X coef)',   value: 0.05, min: -5, max: 5, step: 0.01 },
        b2:  { label: 'b₂ (X coef)',   value: 0.03, min: -5, max: 5, step: 0.01 },
        nk:  { label: 'Delay nk',      value: 1,    min: 0,  max: 20, step: 1 },
      },
      _yBuf: [], _uBuf: [],
      reset() { this._yBuf = [0, 0]; this._uBuf = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; },
      step(u, t, dt, params) {
        const { a1, a2, b1, b2, nk } = params;
        this._uBuf.push(u);
        if (this._uBuf.length > 25) this._uBuf.shift();
        const nkI = Math.max(1, Math.round(nk));
        const uDel1 = this._uBuf[Math.max(0, this._uBuf.length - nkI - 1)] || 0;
        const uDel2 = this._uBuf[Math.max(0, this._uBuf.length - nkI - 2)] || 0;
        const y1 = this._yBuf[this._yBuf.length - 1] || 0;
        const y2 = this._yBuf[this._yBuf.length - 2] || 0;
        const y = a1 * y1 + a2 * y2 + b1 * uDel1 + b2 * uDel2;
        this._yBuf.push(y);
        if (this._yBuf.length > 10) this._yBuf.shift();
        return y;
      },
    },
  };

  let current = 'fopdt';
  let enabled = false;
  let _modelOutput = 0;

  function getCurrent() { return models[current]; }
  function getCurrentId() { return current; }

  function setCurrent(id) {
    current = id;
    models[id].reset();
  }

  function setEnabled(v) { enabled = v; }
  function isEnabled() { return enabled; }

  /**
   * We are always running the model, just potentially not using the output
   * @param u
   * @param t
   * @param dt
   * @returns {*|number|null}
   */
  function step(u, t, dt) {
    const m = models[current];
    const params = {};
    for (const [k, v] of Object.entries(m.params)) params[k] = v.value;
    _modelOutput = m.step(u, t, dt, params);
    return _modelOutput;
  }

  function getOutput() { return _modelOutput; }

  function setParamValue(modelId, paramId, value) {
    if (models[modelId] && models[modelId].params[paramId]) {
      models[modelId].params[paramId].value = value;
    }
  }

  function autoFit(history) {
    // Simple step-response identification using the history
    // Finds K, tau, theta from a step response in recent history
    if (history.length < 50) return { ok: false, msg: 'Not enough data (need 50+ samples)' };

    const n = history.length;
    const pvArr = history.map(h => h.pv);
    const coArr = history.map(h => h.co);

    // Detect step in CO
    let stepIdx = -1, stepSize = 0;
    for (let i = 5; i < n - 5; i++) {
      const diff = coArr[i] - coArr[i - 1];
      if (Math.abs(diff) > Math.abs(stepSize)) { stepSize = diff; stepIdx = i; }
    }
    if (stepIdx < 0 || Math.abs(stepSize) < 0.1) return { ok: false, msg: 'No clear step change detected in CO' };

    // PV before and after step
    const pvBase = pvArr.slice(0, stepIdx).reduce((a, b) => a + b, 0) / stepIdx;
    const pvFinal = pvArr.slice(-Math.min(10, n - stepIdx - 1)).reduce((a, b) => a + b, 0) / Math.min(10, n - stepIdx - 1);
    const K = (pvFinal - pvBase) / stepSize;

    // 63.2% for tau, 10% for theta (approx)
    const pv10 = pvBase + 0.10 * (pvFinal - pvBase);
    const pv63 = pvBase + 0.632 * (pvFinal - pvBase);
    let t10idx = -1, t63idx = -1;
    const rising = pvFinal > pvBase;
    for (let i = stepIdx; i < n; i++) {
      if (rising) {
        if (t10idx < 0 && pvArr[i] >= pv10) t10idx = i;
        if (t63idx < 0 && pvArr[i] >= pv63) t63idx = i;
      } else {
        if (t10idx < 0 && pvArr[i] <= pv10) t10idx = i;
        if (t63idx < 0 && pvArr[i] <= pv63) t63idx = i;
      }
    }
    if (t10idx < 0 || t63idx < 0) return { ok: false, msg: 'Step response not complete — run longer' };

    const dt = history[1].t - history[0].t;
    const theta = Math.max(0, (t10idx - stepIdx) * dt * 1.0);
    const tau   = Math.max(0.1, (t63idx - t10idx) * dt * 1.5);

    // Apply to FOPDT
    models.fopdt.params.K.value     = parseFloat(K.toFixed(4));
    models.fopdt.params.tau.value   = parseFloat(tau.toFixed(2));
    models.fopdt.params.theta.value = parseFloat(theta.toFixed(2));
    models.fopdt.params.bias.value  = parseFloat(pvBase.toFixed(2));

    return { ok: true, msg: `K=${K.toFixed(3)}  τ=${tau.toFixed(2)}s  θ=${theta.toFixed(2)}s` };
  }

  function reset() {
    for (const m of Object.values(models)) m.reset();
    _modelOutput = 0;
  }

  return {
    models, getCurrent, getCurrentId, setCurrent,
    setEnabled, isEnabled, step, getOutput,
    setParamValue, autoFit, reset,
  };
})();

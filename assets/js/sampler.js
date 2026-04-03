/* sampler.js — Signal Sampler */
'use strict';

const Sampler = (() => {
  const cfg = {
    rate: 10,       // Hz
    noiseSigma: 0,  // Gaussian noise std dev
    deadTime: 0,    // seconds
    filterTau: 0,   // first-order filter time constant
  };

  let _lastSampleT = -Infinity;
  let _filtered = null;
  let _deadBuffer = []; // [{value, time}]
  let _currentSample = null;

  function configure(opts) {
    if (opts.rate     !== undefined) cfg.rate     = Math.max(0.01, opts.rate);
    if (opts.noiseSigma !== undefined) cfg.noiseSigma = opts.noiseSigma;
    if (opts.deadTime !== undefined) cfg.deadTime = opts.deadTime;
    if (opts.filterTau !== undefined) cfg.filterTau = opts.filterTau;
  }

  function gaussRand() {
    // Box-Muller
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function reset() {
    _lastSampleT = -Infinity;
    _filtered = null;
    _deadBuffer = [];
    _currentSample = null;
  }

  /**
   * Called every sim tick.
   * rawValue: the "true" process output selected for feedback.
   * t: current sim time.
   * dt: sim time step.
   * Returns the sampled (possibly noisy, delayed, filtered) value, or null if not yet sampled.
   */
  function update(rawValue, t, dt) {
    const period = 1 / cfg.rate;

    // ── Dead-time buffer (always push raw) ──
    _deadBuffer.push({ value: rawValue, time: t });
    // Purge old entries
    while (_deadBuffer.length > 1 && _deadBuffer[1].time <= t - cfg.deadTime) {
      _deadBuffer.shift();
    }

    // ── Sample gate ──
    if (t - _lastSampleT < period) {
      return _currentSample; // return last held sample
    }
    _lastSampleT = t;

    // ── Dead-time retrieval ──
    let delayed = rawValue;
    if (cfg.deadTime > 0 && _deadBuffer.length > 0) {
      const targetT = t - cfg.deadTime;
      delayed = _deadBuffer[0].value;
      for (const entry of _deadBuffer) {
        if (entry.time <= targetT) delayed = entry.value;
        else break;
      }
    }

    // ── Additive Gaussian noise ──
    let noisy = delayed;
    if (cfg.noiseSigma > 0) {
      noisy += gaussRand() * cfg.noiseSigma;
    }

    // ── First-order filter ──
    let filtered = noisy;
    if (cfg.filterTau > 0) {
      if (_filtered === null) _filtered = noisy;
      const alpha = Math.exp(-period / cfg.filterTau);
      _filtered = alpha * _filtered + (1 - alpha) * noisy;
      filtered = _filtered;
    } else {
      _filtered = noisy;
    }

    _currentSample = filtered;
    return filtered;
  }

  function getCurrent() { return _currentSample; }

  return { cfg, configure, reset, update, getCurrent };
})();

/* core.js — Simulation Engine */
'use strict';

const Core = (() => {
  // ── State ──
  const state = {
    running: false,
    t: 0,           // simulation time (seconds)
    dt: 0.01,       // integration step (seconds)
    speed: 1.0,     // time multiplier
    step: 0,        // step count
    history: [],    // { t, pv, sp, co, error, pvFiltered }
    maxHistory: 3000,
  };

  // ── Event Bus ──
  const listeners = {};
  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
  }
  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  // ── RAF Loop ──
  let lastRAF = null;
  let accumulator = 0;

  function loop(timestamp) {
    if (!state.running) return;
    if (lastRAF === null) lastRAF = timestamp;
    const wallDt = Math.min((timestamp - lastRAF) / 1000, 0.1); // cap at 100ms
    lastRAF = timestamp;

    accumulator += wallDt * state.speed;

    // Run simulation steps
    while (accumulator >= state.dt) {
      tick();
      accumulator -= state.dt;
    }

    requestAnimationFrame(loop);
  }

  function tick() {
    emit('tick', { t: state.t, dt: state.dt, step: state.step });
    state.t += state.dt;
    state.step++;
  }

  // ── Controls ──
  function start() {
    if (state.running) return;
    state.running = true;
    lastRAF = null;
    accumulator = 0;
    requestAnimationFrame(loop);
    emit('start', {});
  }

  function stop() {
    state.running = false;
    lastRAF = null;
    emit('stop', {});
  }

  function reset() {
    stop();
    state.t = 0;
    state.step = 0;
    state.history = [];
    emit('reset', {});
  }

  function setSpeed(v) {
    state.speed = Math.max(0.1, v);
  }

  function pushHistory(record) {
    state.history.push(record);
    if (state.history.length > state.maxHistory) {
      state.history.shift();
    }
  }

  return { state, on, emit, start, stop, reset, setSpeed, pushHistory };
})();

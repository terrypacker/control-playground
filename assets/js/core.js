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

    accumulator += (wallDt + state.dt) * state.speed;

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

  /**
   * Set the change of time stap
   * @param dt
   */
  function setDt(dt) {
    state.dt  = dt;
  }

  function pushHistory(record) {
    state.history.push(record);
    if (state.history.length > state.maxHistory) {
      state.history.shift();
    }
  }

  return { state, on, emit, start, stop, reset, setSpeed, setDt, pushHistory };
})();

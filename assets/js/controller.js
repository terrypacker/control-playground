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

/* controller.js — Control Algorithms */
'use strict';

const Controller = (() => {

  // ── Controller Definitions ──────────────────────────────
  const algorithms = {

    // ── PID Controller ──
    pid: {
      name: 'PID',
      params: {
        Kp: { label: 'Kp (Gain)',      value: 1.0,   min: -100, max: 100,  step: 0.1 },
        Ki: { label: 'Ki (Integral)',  value: 0.1,   min: 0,    max: 50,   step: 0.01 },
        Kd: { label: 'Kd (Derivative)',value: 0.0,   min: 0,    max: 50,   step: 0.01 },
        outMin: { label: 'CO Min',     value: 0,     min: -1000,max: 1000, step: 1 },
        outMax: { label: 'CO Max',     value: 100,   min: -1000,max: 1000, step: 1 },
      },
      _integral: 0,
      _lastError: null,
      _lastPV: null,
      reset() { this._integral = 0; this._lastError = null; this._lastPV = null; },
      compute(pv, sp, dt, params) {
        const error = sp - pv;
        // Integral with anti-windup (clamp)
        this._integral += error * dt;
        // Derivative on measurement (avoids derivative kick on SP step)
        let derivative = 0;
        if (this._lastPV !== null) {
          derivative = -(pv - this._lastPV) / dt;
        }
        this._lastPV = pv;
        this._lastError = error;
        const { Kp, Ki, Kd, outMin, outMax } = params;
        let output = Kp * error + Ki * this._integral + Kd * derivative;
        // Clamp
        output = Math.max(outMin, Math.min(outMax, output));
        // Anti-windup: if clamped, stop integrating
        const clamped = output === outMin || output === outMax;
        if (clamped && Math.sign(error) === Math.sign(this._integral)) {
          this._integral -= error * dt; // undo
        }
        return { output, error, integral: this._integral, derivative };
      },
    },

    // ── Bang-Bang (On/Off) Controller ──
    bangbang: {
      name: 'Bang-Bang',
      params: {
        outHigh:   { label: 'Output ON',    value: 100, min: -1000, max: 1000, step: 1 },
        outLow:    { label: 'Output OFF',   value: 0,   min: -1000, max: 1000, step: 1 },
        hysteresis:{ label: 'Hysteresis',   value: 1.0, min: 0,     max: 50,   step: 0.1 },
        deadband:  { label: 'Deadband ±',   value: 0.5, min: 0,     max: 20,   step: 0.1 },
      },
      _state: 'off',
      reset() { this._state = 'off'; },
      compute(pv, sp, dt, params) {
        const error = sp - pv;
        const { outHigh, outLow, hysteresis, deadband } = params;
        // Hysteresis logic
        if (this._state === 'off') {
          if (pv < sp - deadband) this._state = 'on';
        } else {
          if (pv > sp + deadband + hysteresis) this._state = 'off';
        }
        const output = this._state === 'on' ? outHigh : outLow;
        return { output, error, state: this._state };
      },
    },

    // ── Custom ──
    custom: {
      name: 'Custom',
      params: {},
      _fn: null,
      _state: {},
      reset() { this._state = {}; },
      compute(pv, sp, dt, params) {
        if (!this._fn) return { output: 0, error: sp - pv };
        try {
          const result = this._fn(pv, sp, dt, this._state);
          return typeof result === 'object' ? result : { output: result, error: sp - pv };
        } catch (e) {
          return { output: 0, error: sp - pv };
        }
      },
    },
  };

  let current = 'pid';
  let sp = 50;
  let lastOutput = 0;

  function getCurrent() { return algorithms[current]; }
  function getCurrentId() { return current; }

  function setCurrent(id) {
    current = id;
    algorithms[id].reset();
  }

  function setSetpoint(v) { sp = v; }
  function getSetpoint() { return sp; }

  function compute(pv, dt) {
    const alg = algorithms[current];
    // Build params object from param definitions
    const params = {};
    for (const [k, v] of Object.entries(alg.params)) {
      params[k] = v.value;
    }
    const result = alg.compute(pv, sp, dt, params);
    lastOutput = result.output;
    return result;
  }

  function getLastOutput() { return lastOutput; }

  function setParamValue(algId, paramId, value) {
    if (algorithms[algId] && algorithms[algId].params[paramId]) {
      algorithms[algId].params[paramId].value = value;
    }
  }

  function setCustomFn(fn) { algorithms.custom._fn = fn; }

  function reset() {
    for (const alg of Object.values(algorithms)) alg.reset();
    lastOutput = 0;
  }

  return {
    algorithms, getCurrent, getCurrentId, setCurrent,
    setSetpoint, getSetpoint, compute, getLastOutput,
    setParamValue, setCustomFn, reset,
  };
})();

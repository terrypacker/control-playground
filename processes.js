/* processes.js — Process Simulators */
'use strict';

const Processes = (() => {

  // ══════════════════════════════════════════════════════
  // PROCESS DEFINITIONS
  // ══════════════════════════════════════════════════════

  const definitions = {

    // ── 1. Gravity-Drained Tank ──────────────────────────
    tank: {
      name: 'Tank Level',
      description: 'Single tank with inflow pump and gravity drain',
      inputs: [
        { id: 'qIn',      name: 'Inflow Rate',   unit: 'L/min', default: 10,  min: 0,   max: 50,  controlTarget: true },
        { id: 'qDrain',   name: 'Drain Valve',   unit: '0-1',   default: 0.5, min: 0,   max: 1,   controlTarget: false },
        { id: 'tankArea', name: 'Tank Area',      unit: 'm²',    default: 2.0, min: 0.5, max: 10,  controlTarget: false },
      ],
      outputs: [
        { id: 'level',    name: 'Tank Level',    unit: 'm',     min: 0, max: 3 },
        { id: 'outflow',  name: 'Outflow Rate',  unit: 'L/min', min: 0, max: 50 },
        { id: 'overflow', name: 'Overflow Flag',  unit: 'bool',  min: 0, max: 1 },
      ],
      state: { level: 0.5, outflow: 0, overflow: 0 },
      maxLevel: 2.5,
      reset() {
        this.state = { level: 0.5, outflow: 0, overflow: 0 };
      },
      step(inputs, dt) {
        const { qIn, qDrain, tankArea } = inputs;
        const h = this.state.level;
        // Torricelli: outflow ∝ valve * sqrt(h)
        const kDrain = 15; // tuning constant
        const qOut = qDrain * kDrain * Math.sqrt(Math.max(h, 0));
        this.state.outflow = qOut;
        // dh/dt = (qIn - qOut) / (A * 1000)  [L/min → m³/min → m/s]
        const dhdt = (qIn - qOut) / (tankArea * 1000 / 60);
        this.state.level = Math.max(0, Math.min(this.maxLevel, h + dhdt * dt));
        this.state.overflow = this.state.level >= this.maxLevel ? 1 : 0;
        return {
          level:    this.state.level,
          outflow:  this.state.outflow,
          overflow: this.state.overflow,
        };
      },
    },

    // ── 2. Heat Exchanger ────────────────────────────────
    heat: {
      name: 'Heat Exchanger',
      description: 'Shell-and-tube heat exchanger with fluid temperature dynamics',
      inputs: [
        { id: 'qSteam',    name: 'Steam Flow',     unit: 'kg/h',  default: 100, min: 0,   max: 500, controlTarget: true },
        { id: 'tInlet',    name: 'Inlet Temp',     unit: '°C',    default: 20,  min: 0,   max: 80,  controlTarget: false },
        { id: 'flowRate',  name: 'Process Flow',   unit: 'L/min', default: 30,  min: 5,   max: 100, controlTarget: false },
        { id: 'heatLoss',  name: 'Heat Loss Coef', unit: 'W/K',   default: 10,  min: 0,   max: 100, controlTarget: false },
      ],
      outputs: [
        { id: 'tOut',      name: 'Outlet Temp',    unit: '°C',    min: 0, max: 150 },
        { id: 'duty',      name: 'Heat Duty',      unit: 'kW',    min: 0, max: 200 },
        { id: 'deltaTLM',  name: 'LMTD',           unit: '°C',    min: 0, max: 100 },
      ],
      state: { tOut: 20, tShell: 120, duty: 0, deltaTLM: 0 },
      reset() {
        this.state = { tOut: 20, tShell: 120, duty: 0, deltaTLM: 0 };
      },
      step(inputs, dt) {
        const { qSteam, tInlet, flowRate, heatLoss } = inputs;
        // Steam condensation temperature ~130°C at moderate pressure
        const tSteam = 130;
        const lambdaSteam = 2260; // kJ/kg
        // Heat input from steam (kW)
        const Qsteam = (qSteam * lambdaSteam) / 3600; // kJ/h → kW
        // Process fluid thermal mass (water)
        const cp = 4.18; // kJ/(kg·K)
        const rho = 1.0; // kg/L
        const mFluid = flowRate * rho; // kg/min
        // Shell thermal capacitance
        const Cshell = 500; // kJ/K
        // Shell energy balance
        const Qloss = heatLoss * (this.state.tShell - 20) / 1000;
        const QtoProcess = mFluid * cp * (this.state.tOut - tInlet) / 60;
        const dTshelldt = (Qsteam - QtoProcess - Qloss) / Cshell;
        this.state.tShell += dTshelldt * dt;
        // Process side energy balance
        const Cprocess = mFluid * cp * 0.5; // effective
        const UA = 5; // heat transfer coefficient * area (kW/K)
        const Qtrans = UA * (this.state.tShell - this.state.tOut);
        const dToutdt = (Qtrans - QtoProcess) / Math.max(Cprocess, 1);
        this.state.tOut = Math.max(tInlet, Math.min(150, this.state.tOut + dToutdt * dt));
        // Log mean temperature difference
        const dT1 = tSteam - tInlet;
        const dT2 = tSteam - this.state.tOut;
        this.state.deltaTLM = dT1 !== dT2
          ? (dT1 - dT2) / Math.max(Math.log(Math.abs(dT1 / Math.max(dT2, 0.1))), 0.01)
          : dT1;
        this.state.duty = Qtrans;
        return {
          tOut:     this.state.tOut,
          duty:     this.state.duty,
          deltaTLM: this.state.deltaTLM,
        };
      },
    },

    // ── 3. Custom ────────────────────────────────────────
    custom: {
      name: 'Custom Process',
      description: 'User-defined process',
      inputs: [
        { id: 'u1', name: 'Input 1', unit: '', default: 50, min: 0, max: 100, controlTarget: true },
        { id: 'u2', name: 'Input 2', unit: '', default: 0,  min: 0, max: 100, controlTarget: false },
      ],
      outputs: [
        { id: 'y1', name: 'Output 1', unit: '', min: 0, max: 100 },
      ],
      state: { y1: 0, _x: 0 },
      _fn: null,
      reset() {
        this.state = { y1: 0, _x: 0 };
      },
      step(inputs, dt) {
        if (this._fn) {
          try {
            const result = this._fn(inputs, this.state, dt);
            if (result && typeof result === 'object') {
              Object.assign(this.state, result);
            }
          } catch (e) { /* silent */ }
        }
        return { y1: this.state.y1 };
      },
    },
  };

  // ── Current active process ──
  let current = 'tank';
  let outputs = {};  // latest output values

  function getDefinition(id) { return definitions[id]; }
  function getCurrent() { return definitions[current]; }
  function getCurrentId() { return current; }

  function setCurrent(id) {
    current = id;
    definitions[id].reset();
    outputs = {};
  }

  function step(inputs, dt) {
    const proc = definitions[current];
    outputs = proc.step(inputs, dt);
    return outputs;
  }

  function getOutputs() { return outputs; }

  function setCustomFn(fn) { definitions.custom._fn = fn; }

  return { definitions, getDefinition, getCurrent, getCurrentId, setCurrent, step, getOutputs, setCustomFn };
})();

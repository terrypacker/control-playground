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

    // ── Solar Battery Grid-Tie System ─────────────────────────────────────────
    solarBattery: {
      name: 'Solar Battery System',
      description: 'Solar panel array with battery storage, home load, and grid-tie sale optimization',

      // ── INPUTS ──────────────────────────────────────────────────────────────
      inputs: [
        // Controllable
        { id: 'gridSaleRatio',  name: 'Grid Sale Ratio',      unit: '0-1',   default: 0.8,   min: 0,    max: 1,      controlTarget: true  },
        { id: 'battChargeRate', name: 'Battery Charge Rate',  unit: 'kW',    default: 5.0,   min: 0,    max: 10,     controlTarget: true  },

        // Physical / environment
        { id: 'solarRadiation', name: 'Solar Radiation',      unit: 'W/m²',  default: 800,   min: 0,    max: 1200,   controlTarget: false },
        { id: 'panelMaxOutput', name: 'Panel Array Max',      unit: 'kW',    default: 10.0,  min: 1,    max: 100,    controlTarget: false },
        { id: 'homeLoad',       name: 'Home Load',            unit: 'kW',    default: 2.5,   min: 0,    max: 20,     controlTarget: false },
        { id: 'battCapacity',   name: 'Battery Capacity',     unit: 'kWh',   default: 20.0,  min: 1,    max: 200,    controlTarget: false },
        { id: 'battEfficiency', name: 'Battery Round-Trip η', unit: '0-1',   default: 0.92,  min: 0.5,  max: 1.0,    controlTarget: false },

        // Pricing
        { id: 'baseSalePrice',  name: 'Base Sale Price',      unit: '$/kWh', default: 0.12,  min: 0,    max: 1.0,    controlTarget: false },
        { id: 'peakMultiplier', name: 'Peak Price Multiplier',unit: 'x',     default: 2.5,   min: 1.0,  max: 5.0,    controlTarget: false },
      ],

      // ── OUTPUTS ─────────────────────────────────────────────────────────────
      outputs: [
        { id: 'solarPower',     name: 'Solar Power Generated', unit: 'kW',    min: 0,    max: 100   },
        { id: 'batterySOC',     name: 'Battery State of Charge', unit: 'kWh', min: 0,    max: 200   },
        { id: 'gridExport',     name: 'Power Exported to Grid', unit: 'kW',   min: 0,    max: 100   },
        { id: 'gridImport',     name: 'Power Imported from Grid', unit: 'kW', min: 0,    max: 20    },
        { id: 'currentPrice',   name: 'Current Sale Price',    unit: '$/kWh', min: 0,    max: 1.0   },
        { id: 'moneyEarned',    name: 'Revenue (session)',     unit: '$',     min: -999, max: 9999  },
        { id: 'timeOfDay',      name: 'Time of Day',           unit: 'hr',    min: 0,    max: 24    },
      ],

      // ── STATE ────────────────────────────────────────────────────────────────
      state: {
        batterySOC:  10.0,   // kWh — starts partially charged
        moneyEarned: 0.0,    // cumulative $ this session
        timeOfDay:   6.0,    // hr — start at 6 AM
        solarPower:  0.0,
        gridExport:  0.0,
        gridImport:  0.0,
        currentPrice: 0.12,
      },

      // ── CONSTANTS ────────────────────────────────────────────────────────────
      STC_RADIATION: 1000,   // W/m² — Standard Test Condition irradiance
      DAY_DURATION:  24,     // hr — simulated day length
      SOLAR_PEAK_HR: 12.0,   // hr — solar noon
      SOLAR_HALF_WIDTH: 6.0, // hr — half-width of daylight window (6 AM – 6 PM)

      // Time-of-use price windows (hour ranges, multiplier applied to baseSalePrice)
      //   Morning peak: 06:00–09:00
      //   Midday trough: 09:00–16:00  (solar oversupply depresses price)
      //   Evening peak:  16:00–21:00
      //   Off-peak:      21:00–06:00
      _priceMultiplierAt(hour, peakMultiplier) {
        if (hour >= 6  && hour < 9)  return peakMultiplier;          // morning peak
        if (hour >= 9  && hour < 16) return 0.7;                     // midday solar trough
        if (hour >= 16 && hour < 21) return peakMultiplier;          // evening peak
        return 0.5;                                                   // overnight off-peak
      },

      // Sinusoidal solar radiation curve — peaks at solar noon, zero overnight
      _solarFraction(hour) {
        const offset = hour - this.SOLAR_PEAK_HR;
        if (Math.abs(offset) >= this.SOLAR_HALF_WIDTH) return 0;
        // Raised cosine over the daylight window
        return Math.cos((offset / this.SOLAR_HALF_WIDTH) * (Math.PI / 2)) ** 2;
      },

      reset() {
        this.state = {
          batterySOC:   10.0,
          moneyEarned:  0.0,
          timeOfDay:    6.0,
          solarPower:   0.0,
          gridExport:   0.0,
          gridImport:   0.0,
          currentPrice: 0.12,
        };
      },

      // ── STEP ─────────────────────────────────────────────────────────────────
      // dt : seconds of real/simulated time per step
      step(inputs, dt) {
        const {
          solarRadiation, panelMaxOutput,
          homeLoad, battCapacity, battEfficiency,
          gridSaleRatio, battChargeRate,
          baseSalePrice, peakMultiplier,
        } = inputs;

        const dtHr = dt / 3600; // seconds → hours for energy (kWh) calculations

        // ── 1. Advance simulated clock ──────────────────────────────────────
        this.state.timeOfDay = (this.state.timeOfDay + dtHr) % this.DAY_DURATION;
        const hour = this.state.timeOfDay;

        // ── 2. Solar power available ────────────────────────────────────────
        // Scale panel output by the ratio of actual irradiance to STC,
        // then further attenuate by the time-of-day sun angle curve.
        const irradianceFraction = Math.min(solarRadiation / this.STC_RADIATION, 1);
        const solarFraction      = this._solarFraction(hour);
        const solarPower         = panelMaxOutput * irradianceFraction * solarFraction; // kW
        this.state.solarPower    = solarPower;

        // ── 3. Time-of-use sale price ───────────────────────────────────────
        const currentPrice        = baseSalePrice * this._priceMultiplierAt(hour, peakMultiplier);
        this.state.currentPrice   = currentPrice;

        // ── 4. Energy routing ───────────────────────────────────────────────
        //   Priority: home load → battery charge → grid export
        let available = solarPower; // kW remaining after each allocation

        // 4a. Serve home load first (import from grid if solar insufficient)
        const servedBySolar = Math.min(available, homeLoad);
        available          -= servedBySolar;
        const deficit       = homeLoad - servedBySolar;       // kW still needed
        const gridImport    = deficit;                        // pulled from grid
        this.state.gridImport = gridImport;

        // 4b. Charge battery with remaining solar (up to battChargeRate cap)
        let soc          = this.state.batterySOC;
        const headroom   = Math.max(0, battCapacity - soc);   // kWh of empty space
        const chargeKW   = Math.min(available, battChargeRate, headroom / dtHr);
        const chargeKWh  = chargeKW * dtHr * battEfficiency;  // account for round-trip loss
        soc             += chargeKWh;
        available       -= chargeKW;

        // 4c. Remaining solar → export to grid scaled by gridSaleRatio
        //     (ratio < 1 means operator is holding some capacity back)
        const directExport = available * gridSaleRatio;

        // 4d. Optionally discharge battery to grid during high-price windows
        //     Discharge only if price is above base (i.e., peak window)
        let battDischargeKW = 0;
        if (currentPrice > baseSalePrice && soc > 0) {
          const maxDischarge  = Math.min(battChargeRate, soc / dtHr);
          battDischargeKW     = maxDischarge * gridSaleRatio;
          const dischargeKWh  = battDischargeKW * dtHr;
          soc                = Math.max(0, soc - dischargeKWh);
        }

        this.state.batterySOC = Math.min(soc, battCapacity);

        // ── 5. Total grid export & revenue ─────────────────────────────────
        const gridExport = directExport + battDischargeKW;
        this.state.gridExport = gridExport;

        const revenueStep    = gridExport * currentPrice * dtHr;   // $ this step
        const importCostStep = gridImport * currentPrice * dtHr;   // $ paid for import
        this.state.moneyEarned += revenueStep - importCostStep;

        // ── 6. Return all outputs ───────────────────────────────────────────
        return {
          solarPower:   this.state.solarPower,
          batterySOC:   this.state.batterySOC,
          gridExport:   this.state.gridExport,
          gridImport:   this.state.gridImport,
          currentPrice: this.state.currentPrice,
          moneyEarned:  this.state.moneyEarned,
          timeOfDay:    this.state.timeOfDay,
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

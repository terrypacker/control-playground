# Control Playground

An interactive, browser-based environment for exploring and simulating process control algorithms. No installation, no build step — open `index.html` in any modern browser and start experimenting.

---

## Quick Start

1. Open `index.html` in a browser (all files must be in the same folder).
2. Hit **▶ START** — the Tank Level process will begin under PID control with sensible defaults.
3. Adjust the **Setpoint (SP)** in the Controller panel and watch the system respond.
4. Tune the **Kp / Ki / Kd** gains and observe the effect on the trend charts and gauges.

Click the **?** button in the header at any time for in-app help.

---

## Layout

The dashboard is divided into five panels arranged in a three-column grid.

| Panel | # | Description |
|---|---|---|
| Process | 01 | The physical system being controlled |
| Live Visuals | 02 | Animated process graphic, trend charts, and gauges |
| Sampler | 03 | Signal conditioning between process and controller |
| Controller | 04 | The control algorithm |
| Modeler | 05 | A parametric model of the process |

---

## Panels

### 01 — Process

Select a pre-built process or write your own.

**Tank Level** simulates a gravity-drained tank. Inflow is supplied by a pump; outflow follows Torricelli's law (proportional to valve opening × √level). The animated graphic shows water height, inflow/drain streams, and an overflow alarm.

**Heat Exchanger** simulates a shell-and-tube heat exchanger. Steam condenses in tubes, transferring heat to a process fluid stream. The graphic uses a temperature-driven colour gradient to show heating state.

**Custom** exposes a JavaScript code editor. Your function receives `(inputs, state, dt)` and returns updated state fields. The template is pre-loaded as a starting point.

Each process input can be set to **MANUAL** (drag the slider) or **CONTROLLER** (driven by the controller output). Click an output row to select which output is fed to the Sampler.

---

### 02 — Live Visuals

Three rolling trend charts (120 s window):

- **PV & SP** — process variable (cyan) overlaid with setpoint (amber)
- **CO** — controller output (purple)
- **Error (SP − PV)** — signed error (red), zero-line shown as a dashed reference

Arc gauges below the charts show every process output in real time. The **CLEAR** button resets the trend history without stopping the simulation.

---

### 03 — Sampler

Conditions the raw process output before it reaches the controller. All four settings can be changed live.

| Field | Effect |
|---|---|
| Sample Rate (Hz) | How often the controller receives a new measurement |
| Noise σ | Standard deviation of additive Gaussian noise |
| Dead Time (s) | Transport delay — the signal is held in a buffer and released after this lag |
| Filter τ (s) | First-order low-pass filter time constant (0 = off) |

Use these to explore how measurement quality and signal lag affect closed-loop stability.

---

### 04 — Controller

**PID** — proportional-integral-derivative controller with derivative-on-measurement (avoids derivative kick on setpoint steps) and integral anti-windup (clamps integral accumulation when the output is saturated).

| Parameter | Role |
|---|---|
| Kp | Proportional gain — immediate response to error |
| Ki | Integral gain — eliminates steady-state offset over time |
| Kd | Derivative gain — dampens oscillation, responds to rate of change |
| CO Min / CO Max | Output clamp limits |

**Bang-Bang** — on/off controller with configurable hysteresis and deadband. Simple and robust; useful for understanding limit-cycle behaviour.

**Custom** — write your own algorithm in JavaScript. Your function receives `(pv, sp, dt, state)` and must return `{ output, error }`. The `state` object persists between calls for accumulators, filters, or any stateful logic.

The **CO → Process Input** dropdown (and the CONTROLLER button on each process input) select which input the controller drives. Both controls are kept in sync.

---

### 05 — Modeler

Build a parametric model of the process for analysis or model-based control.

| Model | Description |
|---|---|
| **FOPDT** | First-Order Plus Dead Time — gain K, time constant τ, dead time θ, bias. The standard model for most industrial processes. |
| **SOPDT** | Second-Order Plus Dead Time — two cascaded first-order lags, useful for processes with a clear lag-dominant response. |
| **ARX** | AutoRegressive with eXogenous input — discrete-time polynomial model with configurable AR and X coefficients and delay nk. |

**AUTO-FIT** analyses the simulation history to identify a FOPDT model from the most recent step response. Run the process open-loop, make a step change in the controller output, then click AUTO-FIT. The estimated K, τ, and θ values are written back into the FOPDT parameters.

Toggle **USE MODEL** to route the model output into the controller feedback path instead of the sampled process output — useful for testing model-based or predictive strategies.

---

### Time Controls (Header)

| Control | Action |
|---|---|
| ▶ START | Begin or resume simulation |
| ■ STOP | Pause (state is preserved) |
| ↺ RESET | Stop and reset all state, history, and plots |
| SPEED slider | Compress or expand simulation time (0.1× – 10×) |

---

## Writing Custom Code

### Custom Process

```js
// inputs: values of each defined input (e.g. inputs.u1)
// state:  persistent object (e.g. state._x for an integrator state)
// dt:     simulation timestep in seconds
// Return: object with updated state fields

const tau = 10, K = 1.5;
const dxdt = (-state._x + K * inputs.u1) / tau;
state._x += dxdt * dt;
state.y1 = state._x;
return { y1: state.y1, _x: state._x };
```

### Custom Controller

```js
// pv:    sampled process variable
// sp:    current setpoint
// dt:    seconds since last call
// state: persistent object — initialise your own fields here
// Return: { output: <number>, error: sp - pv }

if (!state.integral) state.integral = 0;
const error = sp - pv;
state.integral += error * dt;
const output = Math.max(0, Math.min(100, 1.0 * error + 0.05 * state.integral));
return { output, error };
```

Click **APPLY** after editing. Syntax errors are displayed inline. The simulation does not need to be stopped to apply new code.

---

## File Structure

```
index.html      Main shell and panel layout
styles.css      Industrial dark theme (amber / cyan accent palette)
help.css        Help modal styles
core.js         Simulation loop (RAF), event bus, history buffer
processes.js    Tank Level, Heat Exchanger, and Custom process definitions
sampler.js      Noise, dead-time buffer, and first-order filter
controller.js   PID, Bang-Bang, and Custom controller algorithms
modeler.js      FOPDT, SOPDT, ARX models and step-response AUTO-FIT
visuals.js      Canvas trend charts, arc gauges, and process graphics
ui.js           Panel wiring and simulation orchestration
help.js         In-app help modal content and behaviour
```

---

## Browser Compatibility

Requires a browser with ES6+, Canvas 2D, and `requestAnimationFrame` — any current version of Chrome, Firefox, Safari, or Edge will work. No network connection is needed after the Google Fonts stylesheet loads (fonts will fall back gracefully offline).

/* help.js — In-app Help Modal */
'use strict';

const Help = (() => {

  // ── Tab definitions ────────────────────────────────────
  const tabs = [
    { id: 'overview',    label: 'Overview' },
    { id: 'process',     label: '01 Process' },
    { id: 'visuals',     label: '02 Visuals' },
    { id: 'sampler',     label: '03 Sampler' },
    { id: 'controller',  label: '04 Controller' },
    { id: 'modeler',     label: '05 Modeler' },
    { id: 'custom',      label: 'Custom Code' },
    { id: 'tips',        label: 'Tips & Experiments' },
  ];

  // ── Page content (HTML strings) ───────────────────────
  const pages = {

    overview: `
      <h2>CONTROL PLAYGROUND</h2>
      <p class="help-lead">
        An interactive environment for exploring process control algorithms. Build a loop,
        tune it, break it, and understand why — all in your browser with no install required.
      </p>

      <h3>Signal Flow</h3>
      <div class="signal-flow">
        <div class="flow-block">
          <span class="fb-tag">01</span>
          <span class="fb-name">PROCESS</span>
          <span class="flow-label">physics model</span>
        </div>
        <span class="flow-arrow">→</span>
        <div class="flow-block">
          <span class="fb-tag">03</span>
          <span class="fb-name">SAMPLER</span>
          <span class="flow-label">noise · delay · filter</span>
        </div>
        <span class="flow-arrow">→</span>
        <div class="flow-block">
          <span class="fb-tag">04</span>
          <span class="fb-name">CONTROLLER</span>
          <span class="flow-label">algorithm</span>
        </div>
        <span class="flow-arrow feedback">⟲ CO back to process input</span>
      </div>

      <div class="help-tip">
        <strong>Parallel path:</strong> The Modeler (05) runs a parametric model of the process
        in parallel. Toggle <strong>USE MODEL</strong> to route its output into the controller
        feedback path instead of the real sampled signal.
      </div>

      <h3>Quick Start</h3>
      <ol class="qs-steps">
        <li><span class="qs-text">Open <strong>index.html</strong> — the Tank Level process loads with PID defaults already set.</span></li>
        <li><span class="qs-text">Press <strong>▶ START</strong> in the header. The tank fills toward the 1.0 m setpoint.</span></li>
        <li><span class="qs-text">Change the <strong>Setpoint (SP)</strong> field in the Controller panel and observe the system response in the trend charts.</span></li>
        <li><span class="qs-text">Increase <strong>Noise σ</strong> in the Sampler to see how measurement quality affects control.</span></li>
        <li><span class="qs-text">Switch the process to <strong>Heat Exchanger</strong>, re-tune the PID, and try the Modeler AUTO-FIT.</span></li>
      </ol>

      <h3>Time Controls</h3>
      <table class="help-table">
        <tr><th>Control</th><th>Action</th></tr>
        <tr><td>▶ START</td><td>Begin or resume the simulation. State is preserved across stop/start.</td></tr>
        <tr><td>■ STOP</td><td>Pause. All values are frozen; nothing is lost.</td></tr>
        <tr><td>↺ RESET</td><td>Stop and clear all state, integrators, history, and trend plots.</td></tr>
        <tr><td>SPEED</td><td>Compresses or expands simulation time from 0.1× to 10×. Real-time is 1.0×.</td></tr>
        <tr><td>TIME STEP</td><td>Adjust the time stepped on each iteration from +0.1 to +10.</td></tr>
      </table>
    `,

    process: `
      <h2>01 — PROCESS</h2>
      <p class="help-lead">
        The physical system being controlled. Each process has a set of <strong>inputs</strong>
        (things you can manipulate) and <strong>outputs</strong> (measurements the sampler reads).
      </p>

      <h3>Tank Level</h3>
      <p>
        A single gravity-drained tank. Inflow is supplied by a variable-speed pump.
        Outflow follows <strong>Torricelli's law</strong>: Q<sub>out</sub> = k · valve · √h.
        The animated graphic shows the water level, inflow/drain streams, a level indicator,
        and an overflow alarm when the tank is full.
      </p>
      <table class="help-table">
        <tr><th>Input</th><th>Description</th></tr>
        <tr><td>Inflow Rate</td><td>Pump flow in L/min. Typically the controller output target.</td></tr>
        <tr><td>Drain Valve</td><td>Valve position 0–1. At 0 the tank fills; at 1 it drains fastest.</td></tr>
        <tr><td>Tank Area</td><td>Cross-sectional area in m². Larger area = slower dynamics.</td></tr>
      </table>
      <table class="help-table">
        <tr><th>Output</th><th>Description</th></tr>
        <tr><td>Tank Level</td><td>Water height in metres. Typical control variable.</td></tr>
        <tr><td>Outflow Rate</td><td>Instantaneous drain flow in L/min.</td></tr>
        <tr><td>Overflow Flag</td><td>1 when the tank is at maximum capacity.</td></tr>
      </table>

      <h3>Heat Exchanger</h3>
      <p>
        A shell-and-tube heat exchanger. Steam condenses in the tubes and transfers heat to
        a process fluid stream. The shell has thermal mass, giving the system a lag-dominant
        response. The graphic uses a colour gradient (blue → orange) driven by outlet temperature.
      </p>
      <table class="help-table">
        <tr><th>Input</th><th>Description</th></tr>
        <tr><td>Steam Flow</td><td>Steam supply in kg/h. Controller output target.</td></tr>
        <tr><td>Inlet Temp</td><td>Process fluid inlet temperature in °C.</td></tr>
        <tr><td>Process Flow</td><td>Fluid volumetric flow in L/min. Higher flow = faster washout.</td></tr>
        <tr><td>Heat Loss Coef</td><td>Shell heat loss to surroundings in W/K.</td></tr>
      </table>
      <table class="help-table">
        <tr><th>Output</th><th>Description</th></tr>
        <tr><td>Outlet Temp</td><td>Process fluid outlet temperature in °C. Typical control variable.</td></tr>
        <tr><td>Heat Duty</td><td>Instantaneous heat transfer rate in kW.</td></tr>
        <tr><td>LMTD</td><td>Log Mean Temperature Difference — a measure of driving force.</td></tr>
      </table>

      <h3>Inputs: Manual vs Controller</h3>
      <p>
        Each process input has a <strong>MANUAL</strong> / <strong>CONTROLLER</strong> toggle.
        In MANUAL mode the slider sets the value directly. In CONTROLLER mode the value is
        overridden by the controller output (CO). The toggle and the <em>CO → Process Input</em>
        dropdown in the Controller panel are always kept in sync — changing either one updates both.
      </p>

      <h3>Outputs → Sampler</h3>
      <p>
        Click any output row to select it as the signal fed to the Sampler and then to the
        controller feedback path. The selected output is shown with a ▶ marker.
      </p>

      <h3>Custom Process</h3>
      <p>
        Select <strong>Custom</strong> to open a JavaScript editor. Write your own physics
        inside a function that receives <code>(inputs, state, dt)</code> and returns updated
        state fields. See the <em>Custom Code</em> tab for a full reference.
      </p>
    `,

    visuals: `
      <h2>02 — LIVE VISUALS</h2>
      <p class="help-lead">
        All charts and graphics update in real time while the simulation runs.
        The CLEAR button resets chart history without stopping the simulation.
      </p>

      <h3>Process Graphic</h3>
      <p>
        An animated schematic specific to the active process. For the Tank, it shows
        inflow and drain streams whose thickness scales with flow rate, a water surface
        with a shimmer animation, a level indicator, and an overflow alarm. For the Heat
        Exchanger, it shows a shell-and-tube diagram with a steam inlet, condensate
        outlet, a temperature-driven colour gradient on the shell, and a vertical
        temperature bar gauge.
      </p>

      <h3>Trend Charts</h3>
      <table class="help-table">
        <tr><th>Chart</th><th>Signals</th><th>Colours</th></tr>
        <tr><td>PV &amp; SP</td><td>Process variable and setpoint overlay</td><td>Cyan (PV) · Amber (SP)</td></tr>
        <tr><td>CO</td><td>Controller output</td><td>Purple</td></tr>
        <tr><td>Error</td><td>SP − PV, with dashed zero reference</td><td>Red</td></tr>
      </table>
      <p>All charts show a rolling 120-second window. The x-axis reads right-to-left
      with the present at the right edge.</p>

      <h3>Arc Gauges</h3>
      <p>
        One arc gauge is rendered per process output. The arc fills from the minimum
        to the maximum output range and uses a glow effect at the current reading.
        Gauge colours rotate through amber, cyan, green, purple, and red.
      </p>

      <div class="help-tip help-tip-cyan">
        <strong>Tip:</strong> Switch processes to see different gauges built automatically
        from that process's output definitions.
      </div>
    `,

    sampler: `
      <h2>03 — SAMPLER</h2>
      <p class="help-lead">
        Sits between the process output and the controller. Simulates the imperfections
        of real measurement chains: sampling rate, sensor noise, transport delay, and
        signal filtering. All settings take effect live.
      </p>

      <h3>Parameters</h3>
      <table class="help-table">
        <tr><th>Parameter</th><th>Effect</th></tr>
        <tr>
          <td>Sample Rate (Hz)</td>
          <td>How many times per second the controller receives a new measurement.
          Between samples, the last value is held (zero-order hold). Lower rates
          introduce a phase lag that can destabilise a fast controller.</td>
        </tr>
        <tr>
          <td>Noise σ</td>
          <td>Standard deviation of additive Gaussian (white) noise in the same
          units as the process output. Zero means noise-free. Try 0.02–0.1 m
          on the Tank to see a realistic sensor.</td>
        </tr>
        <tr>
          <td>Dead Time (s)</td>
          <td>Transport delay. The signal is buffered and released this many seconds
          late. Dead time is one of the most destabilising phenomena in process
          control — even small amounts require significant detuning.</td>
        </tr>
        <tr>
          <td>Filter τ (s)</td>
          <td>Time constant of a first-order (exponential) low-pass filter applied
          after noise injection. Reduces high-frequency noise at the cost of
          adding phase lag. A common rule of thumb is τ<sub>filter</sub> ≈ 0.1 × τ<sub>process</sub>.</td>
        </tr>
      </table>

      <h3>Processing Order</h3>
      <div class="signal-flow" style="flex-wrap:wrap;gap:4px;">
        <div class="flow-block"><span class="fb-name" style="font-size:11px">Raw PV</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-block"><span class="fb-name" style="font-size:11px">Dead-time<br>buffer</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-block"><span class="fb-name" style="font-size:11px">+ Gaussian<br>noise</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-block"><span class="fb-name" style="font-size:11px">Low-pass<br>filter</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-block"><span class="fb-name" style="font-size:11px">Sampled<br>PV</span></div>
      </div>

      <div class="help-tip">
        <strong>Experiment:</strong> Start the tank under PID control at its default tuning,
        then gradually increase Dead Time from 0 to 5 s. Watch the system go from stable
        to oscillating to unstable. This is the classic dead-time stability problem.
      </div>
    `,

    controller: `
      <h2>04 — CONTROLLER</h2>
      <p class="help-lead">
        Computes a Controller Output (CO) from the error between the setpoint and the
        sampled process variable. The CO is routed to a chosen process input.
      </p>

      <h3>PID Controller</h3>
      <p>
        The industry-standard proportional-integral-derivative controller. This implementation
        uses <strong>derivative on measurement</strong> (not on error), which avoids a large
        output spike when the setpoint steps. It also includes <strong>integral anti-windup</strong>:
        when the output is clamped by CO Min/Max the integrator stops accumulating, preventing
        the slow recovery ("windup") seen in naive PID implementations.
      </p>
      <table class="help-table">
        <tr><th>Parameter</th><th>Effect</th></tr>
        <tr><td>Kp</td><td>Proportional gain. Larger = faster response but more overshoot.</td></tr>
        <tr><td>Ki</td><td>Integral gain. Eliminates steady-state offset. Too large causes oscillation.</td></tr>
        <tr><td>Kd</td><td>Derivative gain. Dampens overshoot. Amplifies noise — use sparingly.</td></tr>
        <tr><td>CO Min</td><td>Lower clamp on the controller output.</td></tr>
        <tr><td>CO Max</td><td>Upper clamp on the controller output.</td></tr>
      </table>
      <div class="help-tip">
        <strong>Tuning starting point:</strong> Set Ki = Kd = 0. Increase Kp until the
        response is fast but just starts to oscillate. Then add Ki slowly to remove
        offset, and add a small Kd only if overshoot is a problem.
      </div>

      <h3>Bang-Bang Controller</h3>
      <p>
        An on/off controller. Output is either fully ON (outHigh) or fully OFF (outLow).
        A <strong>deadband</strong> around the setpoint prevents rapid switching.
        <strong>Hysteresis</strong> means the controller stays ON until the PV exceeds
        SP + deadband + hysteresis, creating a symmetric limit cycle. Common in heating
        thermostats, level switches, and safety interlocks.
      </p>
      <table class="help-table">
        <tr><th>Parameter</th><th>Effect</th></tr>
        <tr><td>Output ON</td><td>CO value when active.</td></tr>
        <tr><td>Output OFF</td><td>CO value when inactive (often 0).</td></tr>
        <tr><td>Hysteresis</td><td>Extra band above SP+deadband before switching off. Larger = slower cycle.</td></tr>
        <tr><td>Deadband ±</td><td>Symmetric dead zone around SP — no switching occurs inside it.</td></tr>
      </table>

      <h3>CO → Process Input Wiring</h3>
      <p>
        The <strong>CO → Process Input</strong> dropdown selects which process input the
        controller drives. The <strong>CONTROLLER</strong> button on each input row in the
        Process panel does the same thing — both are always kept in sync. Only one input
        can be controller-driven at a time; all others remain manual.
      </p>
    `,

    modeler: `
      <h2>05 — MODELER</h2>
      <p class="help-lead">
        Build a parametric model of the process. The model runs in parallel with the real
        simulation and can be used to understand dynamics, tune controllers analytically,
        or replace the real feedback signal entirely.
      </p>

      <h3>FOPDT — First-Order Plus Dead Time</h3>
      <p>
        The most widely used model in industrial process control.
        Described by gain K, time constant τ, dead time θ, and a bias offset.
        Captures the step-response behaviour of most self-regulating processes well.
      </p>
      <table class="help-table">
        <tr><th>Parameter</th><th>Meaning</th></tr>
        <tr><td>K</td><td>Steady-state gain: ΔPVΔCO at equilibrium.</td></tr>
        <tr><td>τ</td><td>Time constant: time to reach 63.2% of the final value after a step.</td></tr>
        <tr><td>θ</td><td>Dead time: delay before the output starts to respond.</td></tr>
        <tr><td>Bias</td><td>Output offset at zero input (the operating point baseline).</td></tr>
      </table>

      <h3>SOPDT — Second-Order Plus Dead Time</h3>
      <p>
        Two cascaded first-order lags (τ₁ and τ₂) plus dead time. Produces an S-shaped
        step response with an inflection point, which FOPDT cannot capture. Useful for
        processes with two dominant lag stages, such as a reactor followed by a separator.
      </p>

      <h3>ARX — AutoRegressive with eXogenous Input</h3>
      <p>
        A discrete-time polynomial model: y[k] = a₁y[k-1] + a₂y[k-2] + b₁u[k-nk] + b₂u[k-nk-1].
        Flexible and data-driven. The delay nk is the discrete input delay in samples.
        ARX models are the basis of many system identification and MPC (model-predictive control)
        approaches.
      </p>

      <h3>AUTO-FIT</h3>
      <p>
        Fits a FOPDT model to recent simulation history using a step-response method:
      </p>
      <ol class="qs-steps">
        <li><span class="qs-text">Run the simulation in <strong>open loop</strong> (set Kp = Ki = Kd = 0, or use Bang-Bang with a wide deadband so the CO takes a clear step).</span></li>
        <li><span class="qs-text">Let the process <strong>settle</strong>, then make a <strong>step change</strong> in the manual CO or setpoint.</span></li>
        <li><span class="qs-text">Wait until the PV reaches a new steady state.</span></li>
        <li><span class="qs-text">Click <strong>AUTO-FIT</strong>. The estimated K, τ, and θ are written into the FOPDT fields.</span></li>
      </ol>
      <div class="help-tip">
        <strong>USE MODEL toggle:</strong> When enabled, the model output replaces the
        sampled PV in the controller feedback path. Use this to test a control algorithm
        against your identified model before closing the loop on the real process.
      </div>
    `,

    custom: `
      <h2>Custom Code</h2>
      <p class="help-lead">
        Both the Process and the Controller accept user-supplied JavaScript. Code runs
        inside the simulation loop at every tick. Click <strong>APPLY</strong> to compile
        and activate — the simulation does not need to be stopped.
      </p>

      <h3>Custom Process</h3>
      <p>Your code is wrapped as:</p>
      <pre class="help-code"><span class="cm-kw">function</span> <span class="cm-fn">process</span>(inputs, state, dt) {
  <span class="cm-comment">// your code here</span>
}</pre>
      <table class="help-table">
        <tr><th>Argument</th><th>Type</th><th>Description</th></tr>
        <tr><td>inputs</td><td>object</td><td>Current input values keyed by input id (e.g. <code>inputs.u1</code>)</td></tr>
        <tr><td>state</td><td>object</td><td>Persistent state — survives between ticks. Pre-populated with <code>y1</code> and <code>_x</code>.</td></tr>
        <tr><td>dt</td><td>number</td><td>Simulation timestep in seconds (default 0.01 s)</td></tr>
      </table>
      <p>Return an object with updated state fields. Any key you set here is available in <code>state</code> on the next tick.</p>

      <p><strong>Example — first-order lag with gain:</strong></p>
      <pre class="help-code"><span class="cm-kw">const</span> tau = <span class="cm-num">10</span>, K = <span class="cm-num">1.5</span>;
<span class="cm-kw">const</span> dxdt = (-state._x + K * inputs.u1) / tau;
state._x += dxdt * dt;
state.y1 = state._x;
<span class="cm-kw">return</span> { y1: state.y1, _x: state._x };</pre>

      <p><strong>Example — second-order system:</strong></p>
      <pre class="help-code"><span class="cm-kw">if</span> (!state.x1) { state.x1 = <span class="cm-num">0</span>; state.x2 = <span class="cm-num">0</span>; }
<span class="cm-kw">const</span> tau1 = <span class="cm-num">8</span>, tau2 = <span class="cm-num">3</span>, K = <span class="cm-num">2</span>;
state.x1 += ((-state.x1 + K * inputs.u1) / tau1) * dt;
state.x2 += ((-state.x2 + state.x1) / tau2) * dt;
state.y1 = state.x2;
<span class="cm-kw">return</span> { y1: state.y1, x1: state.x1, x2: state.x2 };</pre>

      <h3>Custom Controller</h3>
      <p>Your code is wrapped as:</p>
      <pre class="help-code"><span class="cm-kw">function</span> <span class="cm-fn">controller</span>(pv, sp, dt, state) {
  <span class="cm-comment">// your code here</span>
}</pre>
      <table class="help-table">
        <tr><th>Argument</th><th>Type</th><th>Description</th></tr>
        <tr><td>pv</td><td>number</td><td>Sampled process variable (after noise, delay, filter)</td></tr>
        <tr><td>sp</td><td>number</td><td>Current setpoint</td></tr>
        <tr><td>dt</td><td>number</td><td>Seconds since last call (≈ 1 / sample rate)</td></tr>
        <tr><td>state</td><td>object</td><td>Persistent state — initialise your own fields here</td></tr>
      </table>
      <p>Return <code>{ output: &lt;number&gt;, error: sp - pv }</code>. The <code>output</code> field becomes the CO.</p>

      <p><strong>Example — PI with manual anti-windup:</strong></p>
      <pre class="help-code"><span class="cm-kw">if</span> (!state.I) state.I = <span class="cm-num">0</span>;
<span class="cm-kw">const</span> Kp = <span class="cm-num">2.0</span>, Ki = <span class="cm-num">0.1</span>;
<span class="cm-kw">const</span> CO_MAX = <span class="cm-num">100</span>, CO_MIN = <span class="cm-num">0</span>;
<span class="cm-kw">const</span> error = sp - pv;
state.I += error * dt;
<span class="cm-kw">let</span> output = Kp * error + Ki * state.I;
<span class="cm-comment">// Clamp and undo windup</span>
<span class="cm-kw">if</span> (output > CO_MAX) { output = CO_MAX; state.I -= error * dt; }
<span class="cm-kw">if</span> (output < CO_MIN) { output = CO_MIN; state.I -= error * dt; }
<span class="cm-kw">return</span> { output, error };</pre>

      <div class="help-tip">
        <strong>Runtime errors</strong> in custom code are caught silently — the output
        returns 0 rather than crashing the simulation. Check the red error box below the
        APPLY button for syntax errors at compile time.
      </div>
    `,

    tips: `
      <h2>Tips &amp; Experiments</h2>
      <p class="help-lead">
        A set of suggested experiments to build intuition for process control.
        Each one changes a single variable so you can see its isolated effect.
      </p>

      <h3>PID Tuning — Effect of Each Term</h3>
      <p>Start with Tank Level, SP = 1.0 m, Ki = Kd = 0.</p>
      <table class="help-table">
        <tr><th>What to do</th><th>What you'll see</th></tr>
        <tr><td>Increase Kp slowly from 1 to 20</td><td>Response gets faster, then oscillatory, then unstable</td></tr>
        <tr><td>Set Kp = 5, increase Ki from 0 to 0.5</td><td>Steady-state offset disappears; too much Ki causes oscillation</td></tr>
        <tr><td>Add Kd = 0.5 with Kp = 10</td><td>Overshoot is dampened; Kd amplifies noise</td></tr>
      </table>

      <h3>Dead Time Destabilisation</h3>
      <p>
        With the Tank under PID (Kp=5, Ki=0.3, Kd=0.5), increase <strong>Dead Time</strong>
        in the Sampler from 0 → 1 → 3 → 6 seconds. The controller is receiving stale
        information and overcompensates. Notice how a controller that was well-tuned at
        zero dead time goes completely unstable with just a few seconds of delay.
      </p>

      <h3>Noise + Filter Trade-off</h3>
      <p>
        Set Noise σ = 0.05 and Kd = 2. The derivative term amplifies the noise badly.
        Now increase Filter τ from 0 to 3 s and watch the CO chart smooth out —
        but notice the phase lag it adds makes the control slower. There is always a
        noise-vs-lag trade-off in practice.
      </p>

      <h3>Bang-Bang Limit Cycles</h3>
      <p>
        Switch to Bang-Bang. Set Output ON = 40 L/min, Output OFF = 0, Hysteresis = 0.5.
        The tank will oscillate in a limit cycle around the setpoint. Increase hysteresis
        to widen the cycle; decrease it to speed it up. This is exactly how a domestic
        thermostat or a level switch works.
      </p>

      <h3>Model Identification with AUTO-FIT</h3>
      <ol class="qs-steps">
        <li><span class="qs-text">Set Kp = Ki = Kd = 0 (open loop). Set Inflow Rate to <strong>MANUAL</strong> at 5 L/min. Start simulation and let level settle.</span></li>
        <li><span class="qs-text">Step Inflow Rate up to <strong>20 L/min</strong>. Wait for the level to reach a new equilibrium.</span></li>
        <li><span class="qs-text">Click <strong>AUTO-FIT</strong> in the Modeler panel. Note the K, τ, θ values.</span></li>
        <li><span class="qs-text">Use those values to apply the IMC-PID tuning rule: Kp = τ/(K·λ), Ki = 1/τ, where λ ≈ τ/3 for an aggressive tune.</span></li>
      </ol>

      <h3>Heat Exchanger — Inlet Disturbance Rejection</h3>
      <p>
        Switch to Heat Exchanger with PID controlling Steam Flow → Outlet Temp SP = 80°C.
        Once stable, suddenly change <strong>Inlet Temp</strong> from 20°C to 40°C
        (a process disturbance). Watch how quickly the controller corrects. Increase Ki
        to improve disturbance rejection.
      </p>

      <div class="help-tip help-tip-cyan">
        <strong>Speed controls are great for long experiments.</strong> Run at 5× to
        reach steady state fast, then drop back to 1× to observe the dynamics in detail.
        RESET always brings you back to a clean slate.
      </div>
    `,
  };

  // ── Build DOM ─────────────────────────────────────────
  function buildModal() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'helpOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Help');

    overlay.innerHTML = `
      <div id="helpModal">
        <div id="helpModalHeader">
          <div>
            <div class="help-title">⬡ CONTROL PLAYGROUND — HELP</div>
            <div class="help-subtitle">Click a tab to jump to a section · Press Esc to close</div>
          </div>
          <button id="btnCloseHelp" title="Close (Esc)">✕</button>
        </div>
        <div id="helpTabs"></div>
        <div id="helpContent"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Build tabs
    const tabBar = overlay.querySelector('#helpTabs');
    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'help-tab';
      btn.dataset.tab = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => switchTab(tab.id));
      tabBar.appendChild(btn);
    });

    // Build pages
    const content = overlay.querySelector('#helpContent');
    tabs.forEach(tab => {
      const page = document.createElement('div');
      page.className = 'help-page';
      page.id = 'helpPage-' + tab.id;
      page.innerHTML = pages[tab.id] || '<p>Coming soon.</p>';
      content.appendChild(page);
    });

    // Close button
    overlay.querySelector('#btnCloseHelp').addEventListener('click', close);

    // Click outside modal to close
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    // Esc key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    switchTab('overview');
  }

  function switchTab(id) {
    document.querySelectorAll('.help-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
    document.querySelectorAll('.help-page').forEach(p => p.classList.toggle('active', p.id === 'helpPage-' + id));
    // Scroll content back to top on tab switch
    const content = document.getElementById('helpContent');
    if (content) content.scrollTop = 0;
  }

  function open(tabId) {
    document.getElementById('helpOverlay').classList.add('open');
    if (tabId) switchTab(tabId);
  }

  function close() {
    document.getElementById('helpOverlay').classList.remove('open');
  }

  // ── ? button in header ────────────────────────────────
  function addHeaderButton() {
    const timeControls = document.querySelector('.time-controls');
    if (!timeControls) return;
    const btn = document.createElement('button');
    btn.id = 'btnHelp';
    btn.title = 'Help';
    btn.textContent = '?';
    btn.addEventListener('click', () => open('overview'));
    timeControls.appendChild(btn);
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    buildModal();
    addHeaderButton();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { open, close, switchTab };
})();

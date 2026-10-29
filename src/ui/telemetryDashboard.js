const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';

/**
 * Motorsport telemetry dashboard. Demo mode is deliberately labelled simulated.
 * Optional WebSocket bridge accepts JSON objects with rpm, temperature, voltage,
 * current, accel, vibration, and optionally timestamp fields.
 */
export function initTelemetryDashboard() {
  const toggle = document.getElementById('telemetry-toggle');
  if (!toggle) return null;

  const panel = document.createElement('aside');
  panel.id = 'telemetry-panel';
  panel.className = 'telemetry-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Motorsport telemetry dashboard');
  panel.innerHTML = `
    <header class="telemetry-header">
      <div><div class="telemetry-kicker"><span class="telemetry-status-dot"></span> MOTORSPORT IOT / MONITORING</div><h2>Telemetry control room</h2><p>Live-style vehicle signals for your project prototype.</p></div>
      <button class="telemetry-close" type="button" aria-label="Close telemetry">×</button>
    </header>
    <div class="telemetry-mode-row"><span class="telemetry-mode-pill" id="telemetry-mode-pill">SIMULATED DEMO DATA</span><span class="telemetry-updated" id="telemetry-updated">Waiting for sample…</span></div>
    <div class="telemetry-metrics">
      <article class="telemetry-metric"><span>Wheel speed</span><strong id="metric-rpm">—</strong><small>RPM</small><div class="telemetry-spark" id="spark-rpm"></div></article>
      <article class="telemetry-metric"><span>Motor temperature</span><strong id="metric-temperature">—</strong><small>°C</small><div class="telemetry-spark" id="spark-temperature"></div></article>
      <article class="telemetry-metric"><span>Battery voltage</span><strong id="metric-voltage">—</strong><small>V</small><div class="telemetry-spark" id="spark-voltage"></div></article>
      <article class="telemetry-metric"><span>Current draw</span><strong id="metric-current">—</strong><small>A</small><div class="telemetry-spark" id="spark-current"></div></article>
    </div>
    <section class="telemetry-section"><div class="telemetry-section-heading"><div><span class="telemetry-section-index">01</span><h3>IoT data path</h3></div><span>System architecture</span></div><div class="telemetry-data-path"><span>Sensor</span><b>→</b><span>ESP32</span><b>→</b><span>Wi-Fi</span><b>→</b><span>Dashboard</span></div><p class="telemetry-path-caption">Physical measurements become digital data, travel over a network, and are visualised for monitoring.</p></section>
    <section class="telemetry-section"><div class="telemetry-section-heading"><div><span class="telemetry-section-index">02</span><h3>Signal activity</h3></div><span>Last 30 samples</span></div><div class="telemetry-chart-wrap"><svg id="telemetry-chart" viewBox="0 0 600 142" role="img" aria-label="Normalised telemetry signal history"></svg></div><div class="telemetry-chart-legend"><span><i class="legend-rpm"></i>RPM</span><span><i class="legend-temp"></i>Temperature</span><span><i class="legend-voltage"></i>Voltage</span></div></section>
    <section class="telemetry-section"><div class="telemetry-section-heading"><div><span class="telemetry-section-index">03</span><h3>System status</h3></div><span id="telemetry-health-label">DEMO HEALTH</span></div><div class="telemetry-health-grid"><div><span class="health-led" id="health-temperature"></span><span>Motor temperature</span><b id="health-temperature-text">Nominal</b></div><div><span class="health-led" id="health-voltage"></span><span>Battery voltage</span><b id="health-voltage-text">Nominal</b></div><div><span class="health-led" id="health-connection"></span><span>Data link</span><b id="health-connection-text">Demo stream</b></div></div></section>
    <section class="telemetry-section telemetry-bridge"><div class="telemetry-section-heading"><div><span class="telemetry-section-index">04</span><h3>Hardware bridge</h3></div><span>Optional</span></div><p>Connect a compatible WebSocket-to-ESP32 bridge to display real measurements. This UI does not connect directly to ESP32 over Wi-Fi without firmware / a bridge.</p><label for="telemetry-ws-url">WebSocket endpoint</label><div class="telemetry-connect-row"><input id="telemetry-ws-url" type="url" value="ws://localhost:81" spellcheck="false" /><button id="telemetry-connect" type="button">Connect</button></div><div class="telemetry-bridge-help">Expected JSON keys: <code>rpm</code>, <code>temperature</code>, <code>voltage</code>, <code>current</code>, optional <code>accel</code> and <code>vibration</code>.</div></section>
    <footer class="telemetry-actions"><button id="telemetry-demo-toggle" type="button">Pause demo</button><button id="telemetry-export" type="button">Export CSV ↓</button><button id="telemetry-reset" type="button">Reset history</button></footer>
    <div class="telemetry-disclaimer">Educational visualization. Demo values are simulated and are not actual Formula 1 telemetry. Validate sensor calibration and safe operating limits before using hardware data.</div>`;
  document.body.appendChild(panel);

  const $ = (id) => panel.querySelector(`#${id}`);
  const history = [];
  const maxSamples = 30;
  let demoRunning = true;
  let socket = null;
  let usingHardware = false;
  let tick = 0;
  let last = { rpm: 820, temperature: 43, voltage: 7.6, current: 1.2, accel: 0.2, vibration: 0.15 };
  let timer = null;

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('on', open);
    if (open && !history.length) sampleDemo();
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  $('.telemetry-close').addEventListener('click', () => setOpen(false));

  function appendSample(data, mode = 'demo') {
    const sample = {
      timestamp: data.timestamp || new Date().toISOString(),
      rpm: Number(data.rpm), temperature: Number(data.temperature), voltage: Number(data.voltage),
      current: Number(data.current), accel: Number(data.accel ?? 0), vibration: Number(data.vibration ?? 0), mode,
    };
    if (![sample.rpm, sample.temperature, sample.voltage, sample.current].every(Number.isFinite)) return;
    sample.rpm = clamp(sample.rpm, 0, 30000);
    sample.temperature = clamp(sample.temperature, -50, 250);
    sample.voltage = clamp(sample.voltage, 0, 1000);
    sample.current = clamp(sample.current, 0, 1000);
    history.push(sample);
    if (history.length > maxSamples) history.shift();
    last = sample;
    render();
  }

  function sampleDemo() {
    tick += 1;
    const wave = Math.sin(tick / 3.8);
    const transient = tick % 18 > 12 ? 140 : 0;
    appendSample({
      rpm: clamp(780 + wave * 330 + Math.sin(tick * 1.6) * 70 + transient, 420, 1450),
      temperature: clamp(41 + tick * 0.07 + Math.sin(tick / 5) * 4, 35, 64),
      voltage: clamp(7.8 - tick * 0.002 + Math.sin(tick / 7) * 0.08, 6.8, 8.2),
      current: clamp(1.15 + Math.abs(wave) * 0.7 + transient / 500, 0.3, 3.5),
      accel: wave * 0.6, vibration: 0.1 + Math.abs(Math.sin(tick * 1.3)) * 0.25,
    }, 'demo');
  }

  function sparkline(values, color) {
    if (values.length < 2) return '';
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const points = values.map((v, i) => `${i / (values.length - 1) * 100},${24 - ((v - min) / span) * 20}`).join(' ');
    return `<svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  }

  function renderChart() {
    const svg = $('telemetry-chart');
    const series = [
      { key: 'rpm', color: '#4ce2ee' }, { key: 'temperature', color: '#ffb15e' }, { key: 'voltage', color: '#a995ff' },
    ];
    const width = 600, height = 142, pad = 12;
    const grid = [0.25, 0.5, 0.75].map((y) => `<line x1="${pad}" y1="${y * height}" x2="${width - pad}" y2="${y * height}" stroke="rgba(185,211,222,.10)" stroke-dasharray="3 5"/>`).join('');
    const paths = series.map(({ key, color }) => {
      const values = history.map((s) => s[key]);
      if (values.length < 2) return '';
      const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
      const points = values.map((v, i) => `${pad + i / (values.length - 1) * (width - pad * 2)},${height - pad - ((v - min) / span) * (height - pad * 2)}`).join(' ');
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join('');
    svg.innerHTML = `${grid}${paths}`;
  }

  function setHealth(key, state, label) {
    $(`health-${key}`).className = `health-led ${state}`;
    $(`health-${key}-text`).textContent = label;
  }

  function render() {
    $('metric-rpm').textContent = fmt(last.rpm, 0);
    $('metric-temperature').textContent = fmt(last.temperature, 1);
    $('metric-voltage').textContent = fmt(last.voltage, 2);
    $('metric-current').textContent = fmt(last.current, 2);
    $('spark-rpm').innerHTML = sparkline(history.map((s) => s.rpm), '#4ce2ee');
    $('spark-temperature').innerHTML = sparkline(history.map((s) => s.temperature), '#ffb15e');
    $('spark-voltage').innerHTML = sparkline(history.map((s) => s.voltage), '#a995ff');
    $('spark-current').innerHTML = sparkline(history.map((s) => s.current), '#63d6a2');
    $('telemetry-chart').setAttribute('aria-label', `Normalised signal history with ${history.length} samples`);
    renderChart();
    const isDemo = !usingHardware;
    $('telemetry-mode-pill').textContent = isDemo ? 'SIMULATED DEMO DATA' : 'HARDWARE STREAM';
    $('telemetry-mode-pill').classList.toggle('hardware', !isDemo);
    $('telemetry-updated').textContent = `Updated ${new Date(last.timestamp).toLocaleTimeString()}`;
    setHealth('temperature', last.temperature >= 70 ? 'danger' : last.temperature >= 60 ? 'warn' : 'good', last.temperature >= 70 ? 'High' : last.temperature >= 60 ? 'Watch' : 'Nominal');
    setHealth('voltage', last.voltage < 6.6 ? 'danger' : last.voltage < 7.0 ? 'warn' : 'good', last.voltage < 6.6 ? 'Low' : last.voltage < 7.0 ? 'Watch' : 'Nominal');
    setHealth('connection', usingHardware ? 'good' : 'demo', usingHardware ? 'Connected' : 'Demo stream');
  }

  function startDemoTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => { if (demoRunning && !usingHardware) sampleDemo(); }, 1200);
  }

  $('telemetry-demo-toggle').addEventListener('click', () => {
    demoRunning = !demoRunning;
    $('telemetry-demo-toggle').textContent = demoRunning ? 'Pause demo' : 'Resume demo';
    if (demoRunning && !usingHardware) sampleDemo();
  });
  $('telemetry-reset').addEventListener('click', () => { history.length = 0; render(); });
  $('telemetry-export').addEventListener('click', () => {
    const headers = ['timestamp', 'mode', 'rpm', 'temperature_c', 'voltage_v', 'current_a', 'accel_g', 'vibration'];
    const rows = history.map((s) => [s.timestamp, s.mode, s.rpm, s.temperature, s.voltage, s.current, s.accel, s.vibration].join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'f1-telemetry-samples.csv'; a.click(); URL.revokeObjectURL(url);
  });

  $('telemetry-connect').addEventListener('click', () => {
    const button = $('telemetry-connect');
    if (socket && socket.readyState === WebSocket.OPEN) {
      const oldSocket = socket; socket = null; usingHardware = false; demoRunning = true; button.textContent = 'Connect';
      $('telemetry-demo-toggle').textContent = 'Pause demo'; oldSocket.close(); sampleDemo(); render(); return;
    }
    const url = $('telemetry-ws-url').value.trim();
    if (socket) { socket.close(); socket = null; }
    try {
      socket = new WebSocket(url);
      button.textContent = 'Connecting…'; button.disabled = true;
      socket.addEventListener('open', () => {
        usingHardware = true; demoRunning = false; button.disabled = false; button.textContent = 'Disconnect';
        $('telemetry-demo-toggle').textContent = 'Resume demo'; render();
      });
      socket.addEventListener('message', (event) => {
        try { const data = JSON.parse(event.data); appendSample(data, 'hardware'); } catch { /* Ignore non-JSON bridge messages. */ }
      });
      socket.addEventListener('error', () => {
        button.disabled = false; button.textContent = 'Connect';
        $('telemetry-updated').textContent = 'Bridge error — check endpoint';
      });
      socket.addEventListener('close', () => {
        usingHardware = false; button.disabled = false; button.textContent = 'Connect'; render();
        if (demoRunning) sampleDemo();
      });
    } catch {
      button.disabled = false; button.textContent = 'Connect'; $('telemetry-updated').textContent = 'Invalid WebSocket endpoint';
    }
  });

  startDemoTimer();
  sampleDemo();
  return { open: () => setOpen(true), close: () => setOpen(false) };
}

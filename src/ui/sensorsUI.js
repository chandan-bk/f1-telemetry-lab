import { SENSOR_CATEGORIES, SENSOR_AUTHORITIES, SENSORS } from '../data/sensors.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * UI controls for the Motorsport IoT Sensors feature.
 * Injects the Sensors layer chip and the floating filter legend bar.
 */
export function initSensorsUI({ state, sensorsManager, onLayerToggle }) {
  // 1. Add "Sensors" toggle chip into the existing #layers menu
  const layersEl = document.getElementById('layers');
  let sensorChip = null;

  if (layersEl) {
    sensorChip = document.createElement('button');
    sensorChip.className = 'chip off sensor-layer-chip';
    sensorChip.innerHTML = '<span class="sensor-dot"></span>Sensors';
    sensorChip.title = 'Toggle 3D Motorsport IoT Sensors Overlay';
    sensorChip.addEventListener('click', () => {
      const on = sensorChip.classList.toggle('off') === false;
      state.layers.sensors = on;
      updateVisibility();
      if (onLayerToggle) onLayerToggle('sensors', on);
    });
    layersEl.append(sensorChip);
  }

  // 2. Create the floating Filter & Legend panel (visible only when Sensors layer is ON)
  const panel = document.createElement('div');
  panel.id = 'sensors-legend-panel';
  panel.className = 'sensors-panel';
  panel.hidden = true;

  panel.innerHTML = `
    <div class="sensors-panel-inner">
      <div class="sensors-panel-header">
        <span class="sensors-title">IoT Telemetry Sensors</span>
        <span id="sensors-count" class="sensors-badge">${SENSORS.length} sensors</span>
      </div>

      <div class="sensors-filter-group">
        <span class="filter-label">Subsystem</span>
        <div class="filter-chips" id="cat-filters">
          <button class="sensor-filter-btn active" data-cat="all">All</button>
          <button class="sensor-filter-btn" data-cat="control">
            <i style="background: ${SENSOR_CATEGORIES.control.color}"></i>Control
          </button>
          <button class="sensor-filter-btn" data-cat="monitoring">
            <i style="background: ${SENSOR_CATEGORIES.monitoring.color}"></i>Monitoring
          </button>
          <button class="sensor-filter-btn" data-cat="instrumentation">
            <i style="background: ${SENSOR_CATEGORIES.instrumentation.color}"></i>Instrumentation
          </button>
        </div>
      </div>

      <div class="sensors-filter-group">
        <span class="filter-label">Authority</span>
        <div class="filter-chips" id="auth-filters">
          <button class="sensor-filter-btn active" data-auth="all">All</button>
          <button class="sensor-filter-btn" data-auth="FIA">
            <i style="background: ${SENSOR_AUTHORITIES.FIA.badgeColor}"></i>FIA Mandatory
          </button>
          <button class="sensor-filter-btn" data-auth="Team">
            <i style="background: ${SENSOR_AUTHORITIES.Team.badgeColor}"></i>Team Engineering
          </button>
        </div>
      </div>

      <div class="sensors-confidential-note">
        Sensor positions and details are representative; real layouts are team-confidential.
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Wire up category filter buttons
  const catButtons = panel.querySelectorAll('[data-cat]');
  catButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      catButtons.forEach((b) => b.classList.toggle('active', b === btn));
      sensorsManager.setFilters({ category: btn.dataset.cat });
      updateCount();
    });
  });

  // Wire up authority filter buttons
  const authButtons = panel.querySelectorAll('[data-auth]');
  authButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      authButtons.forEach((b) => b.classList.toggle('active', b === btn));
      sensorsManager.setFilters({ authority: btn.dataset.auth });
      updateCount();
    });
  });

  function updateCount() {
    const visibleCount = sensorsManager.markers.filter((m) => m.group.visible).length;
    const countEl = document.getElementById('sensors-count');
    if (countEl) {
      countEl.textContent = `${visibleCount} visible`;
    }
  }

  function updateVisibility() {
    const on = !!state.layers.sensors;
    panel.hidden = !on;
    if (sensorChip) {
      sensorChip.classList.toggle('off', !on);
    }
    sensorsManager.syncVisibility();
    updateCount();
  }

  return {
    sync() {
      updateVisibility();
    },
    updateCount,
  };
}

import { SENSOR_CATEGORIES, SENSOR_AUTHORITIES, SENSORS } from '../data/sensors.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Interactive controls and searchable sensor catalog for the motorsport IoT layer. */
export function initSensorsUI({ state, sensorsManager, onLayerToggle, onSensorSelect }) {
  const layersEl = document.getElementById('layers');
  let sensorChip = null;

  if (layersEl) {
    sensorChip = document.createElement('button');
    sensorChip.className = 'chip off sensor-layer-chip';
    sensorChip.innerHTML = '<span class="sensor-dot"></span>Sensors';
    sensorChip.title = 'Toggle 3D Motorsport IoT Sensors Overlay';
    sensorChip.setAttribute('aria-pressed', 'false');
    sensorChip.addEventListener('click', () => {
      const on = sensorChip.classList.toggle('off') === false;
      state.layers.sensors = on;
      sensorChip.setAttribute('aria-pressed', String(on));
      updateVisibility();
      if (onLayerToggle) onLayerToggle('sensors', on);
    });
    layersEl.append(sensorChip);
  }

  const panel = document.createElement('aside');
  panel.id = 'sensors-legend-panel';
  panel.className = 'sensors-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Motorsport IoT sensor explorer');
  panel.innerHTML = `
    <div class="sensors-panel-inner">
      <div class="sensors-panel-header">
        <div class="sensors-heading-wrap">
          <span class="sensors-eyebrow"><span class="live-dot"></span> SYSTEM EXPLORER</span>
          <span class="sensors-title">Telemetry sensors</span>
        </div>
        <span id="sensors-count" class="sensors-badge">${SENSORS.length} types</span>
      </div>
      <div class="sensor-summary-grid">
        <div class="sensor-summary-card"><span class="summary-value">${SENSORS.length}</span><span class="summary-label">Sensor types</span></div>
        <div class="sensor-summary-card"><span class="summary-value">${Object.keys(SENSOR_CATEGORIES).length}</span><span class="summary-label">Subsystems</span></div>
        <div class="sensor-summary-card"><span class="summary-value">3D</span><span class="summary-label">Placement view</span></div>
      </div>
      <label class="sensor-search-wrap" for="sensor-search">
        <span class="sensor-search-icon" aria-hidden="true">⌕</span>
        <input id="sensor-search" type="search" placeholder="Search sensors or measurements…" autocomplete="off" />
        <kbd>/</kbd>
      </label>
      <div class="sensors-filter-group">
        <span class="filter-label">Subsystem</span>
        <div class="filter-chips" id="cat-filters">
          <button class="sensor-filter-btn active" data-cat="all">All</button>
          <button class="sensor-filter-btn" data-cat="control"><i style="background:${SENSOR_CATEGORIES.control.color}"></i>Control</button>
          <button class="sensor-filter-btn" data-cat="monitoring"><i style="background:${SENSOR_CATEGORIES.monitoring.color}"></i>Monitoring</button>
          <button class="sensor-filter-btn" data-cat="instrumentation"><i style="background:${SENSOR_CATEGORIES.instrumentation.color}"></i>Instrumentation</button>
        </div>
      </div>
      <div class="sensors-filter-group">
        <span class="filter-label">Source / authority</span>
        <div class="filter-chips" id="auth-filters">
          <button class="sensor-filter-btn active" data-auth="all">All</button>
          <button class="sensor-filter-btn" data-auth="FIA"><i style="background:${SENSOR_AUTHORITIES.FIA.badgeColor}"></i>FIA-related</button>
          <button class="sensor-filter-btn" data-auth="Team"><i style="background:${SENSOR_AUTHORITIES.Team.badgeColor}"></i>Team engineering</button>
        </div>
      </div>
      <div class="sensor-list-heading"><span>Sensor catalog</span><span id="sensor-list-count">${SENSORS.length} items</span></div>
      <div id="sensor-catalog-list" class="sensor-catalog-list" role="list"></div>
      <div class="sensors-confidential-note"><strong>Model data only.</strong> Sensor locations are illustrative; this explorer does not receive live telemetry from a real F1 car.</div>
    </div>`;
  document.body.appendChild(panel);

  let searchQuery = '';
  let activeCategory = 'all';
  let activeAuthority = 'all';
  const listEl = panel.querySelector('#sensor-catalog-list');
  const countEl = panel.querySelector('#sensors-count');
  const listCountEl = panel.querySelector('#sensor-list-count');

  function renderCatalog() {
    const query = searchQuery.trim().toLowerCase();
    const filtered = SENSORS.filter((sensor) => {
      const matchesCategory = activeCategory === 'all' || sensor.category === activeCategory;
      const matchesAuthority = activeAuthority === 'all' || sensor.authority === activeAuthority;
      const haystack = `${sensor.name} ${sensor.measures} ${sensor.whyItMatters} ${sensor.layerId}`.toLowerCase();
      return matchesCategory && matchesAuthority && (!query || haystack.includes(query));
    });
    listEl.innerHTML = filtered.length ? filtered.map((sensor) => {
      const category = SENSOR_CATEGORIES[sensor.category];
      const authority = SENSOR_AUTHORITIES[sensor.authority];
      return `<button class="sensor-catalog-item" role="listitem" data-sensor-id="${esc(sensor.id)}" style="--sensor-color:${category.color}">
        <span class="sensor-item-marker" aria-hidden="true"><span></span></span>
        <span class="sensor-item-copy"><span class="sensor-item-name">${esc(sensor.name)}</span><span class="sensor-item-meta">${esc(category.short)} <span>·</span> ${esc(sensor.measures)}</span></span>
        <span class="sensor-item-arrow" aria-hidden="true">↗</span>
      </button>`;
    }).join('') : '<div class="sensor-empty-state">No sensors match that search. Try a different term or filter.</div>';
    countEl.textContent = `${filtered.length} shown`;
    listCountEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`;
    listEl.querySelectorAll('[data-sensor-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const sensor = SENSORS.find((item) => item.id === button.dataset.sensorId);
        if (!sensor) return;
        if (!state.layers.sensors) {
          state.layers.sensors = true;
          updateVisibility();
          if (onLayerToggle) onLayerToggle('sensors', true);
        }
        if (onSensorSelect) onSensorSelect(sensor);
        listEl.querySelectorAll('.sensor-catalog-item').forEach((item) => item.classList.toggle('selected', item === button));
      });
    });
  }

  const catButtons = [...panel.querySelectorAll('[data-cat]')];
  catButtons.forEach((btn) => btn.addEventListener('click', () => {
    activeCategory = btn.dataset.cat;
    catButtons.forEach((b) => b.classList.toggle('active', b === btn));
    sensorsManager.setFilters({ category: activeCategory });
    updateCount();
    renderCatalog();
  }));

  const authButtons = [...panel.querySelectorAll('[data-auth]')];
  authButtons.forEach((btn) => btn.addEventListener('click', () => {
    activeAuthority = btn.dataset.auth;
    authButtons.forEach((b) => b.classList.toggle('active', b === btn));
    sensorsManager.setFilters({ authority: activeAuthority });
    updateCount();
    renderCatalog();
  }));

  panel.querySelector('#sensor-search').addEventListener('input', (event) => {
    searchQuery = event.target.value;
    renderCatalog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (!panel.hidden) { event.preventDefault(); panel.querySelector('#sensor-search').focus(); }
    }
    if (event.key === 'Escape' && document.activeElement === panel.querySelector('#sensor-search')) {
      panel.querySelector('#sensor-search').blur();
    }
  });

  function updateCount() {
    const visibleCount = sensorsManager.markers.filter((m) => m.group.visible).length;
    const sensorTypes = SENSORS.filter((sensor) =>
      (activeCategory === 'all' || sensor.category === activeCategory) &&
      (activeAuthority === 'all' || sensor.authority === activeAuthority) &&
      (!searchQuery.trim() || `${sensor.name} ${sensor.measures} ${sensor.whyItMatters} ${sensor.layerId}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    ).length;
    if (countEl) countEl.textContent = `${sensorTypes} shown`;
    if (listCountEl) listCountEl.textContent = `${sensorTypes} ${sensorTypes === 1 ? 'item' : 'items'}`;
  }

  function updateVisibility() {
    const on = !!state.layers.sensors;
    panel.hidden = !on;
    if (sensorChip) {
      sensorChip.classList.toggle('off', !on);
      sensorChip.setAttribute('aria-pressed', String(on));
    }
    sensorsManager.syncVisibility();
    updateCount();
  }

  renderCatalog();
  return { sync() { updateVisibility(); renderCatalog(); }, updateCount };
}

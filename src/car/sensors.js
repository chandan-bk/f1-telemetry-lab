import * as THREE from 'three';
import { SENSORS, SENSOR_CATEGORIES } from '../data/sensors.js';
import { ENABLE_SENSORS, DEBUG_SENSORS } from '../config/sensorsConfig.js';
import { FRONT_AXLE_X, REAR_AXLE_X } from './dims.js';

/**
 * Procedural 3D Motorsport IoT Sensors Hardware Generator.
 * Replaces simple dots with realistic physical 3D sensor assemblies that can be
 * orbited 360 degrees, inspected, and exploded alongside existing car components.
 */
export class SensorsManager {
  constructor({ scene, reg, state, requestRender }) {
    this.scene = scene;
    this.reg = reg;
    this.state = state;
    this.requestRender = requestRender;

    this.markers = []; // Array of marker entries
    this.markerMeshes = []; // Array of Raycast target meshes
    this.filterCategory = 'all';
    this.filterAuthority = 'all';

    // Shared reusable geometries
    this.geos = {
      // Cylinders & tubes
      tubeProbe: new THREE.CylinderGeometry(0.0035, 0.006, 0.075, 12),
      pyrometerBody: new THREE.CylinderGeometry(0.0075, 0.0075, 0.026, 14),
      lensCyl: new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 12),
      hexCollar: new THREE.CylinderGeometry(0.011, 0.011, 0.022, 6),
      spigotCyl: new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10),
      potOuter: new THREE.CylinderGeometry(0.0065, 0.0065, 0.048, 12),
      potInner: new THREE.CylinderGeometry(0.0032, 0.0032, 0.042, 12),
      valveStem: new THREE.CylinderGeometry(0.0028, 0.0028, 0.018, 8),
      connectorGland: new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8),
      baseCollar: new THREE.CylinderGeometry(0.009, 0.011, 0.012, 12),
      // Boxes & enclosures
      flowBlock: new THREE.BoxGeometry(0.038, 0.022, 0.028),
      adrBox: new THREE.BoxGeometry(0.046, 0.025, 0.034),
      laserBox: new THREE.BoxGeometry(0.028, 0.012, 0.022),
      antennaBlade: new THREE.BoxGeometry(0.003, 0.055, 0.024),
      ecuChassis: new THREE.BoxGeometry(0.048, 0.018, 0.036),
      bracketArm: new THREE.BoxGeometry(0.004, 0.016, 0.008),
      tpmsPack: new THREE.BoxGeometry(0.022, 0.008, 0.014),
      // Status indicators & accents
      ledSphere: new THREE.SphereGeometry(0.006, 12, 10),
      accentRing: new THREE.TorusGeometry(0.014, 0.0025, 8, 20),
      fiaRing: new THREE.TorusGeometry(0.022, 0.003, 8, 24),
    };

    // Shared realistic motorsport materials
    this.materials = {
      titanium: new THREE.MeshStandardMaterial({ color: 0xb5b9be, metalness: 0.85, roughness: 0.28 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.9, roughness: 0.2 }),
      anodizedBlack: new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.5, roughness: 0.35 }),
      billetAlum: new THREE.MeshStandardMaterial({ color: 0xd8dce0, metalness: 0.78, roughness: 0.28 }),
      goldBrass: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 }),
      crashOrange: new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.15, roughness: 0.35 }),
      lensGlass: new THREE.MeshPhysicalMaterial({ color: 0x1a3366, roughness: 0.1, metalness: 0.2, clearcoat: 0.9 }),
      // Glowing category LED accents
      controlLed: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.control.color),
        emissive: new THREE.Color(SENSOR_CATEGORIES.control.color),
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }),
      monitoringLed: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        emissive: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }),
      instrumentationLed: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        emissive: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }),
      fiaSeal: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xe10600,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      }),
    };

    if (ENABLE_SENSORS) {
      this.initMarkers();
    }
  }

  /**
   * Resolve part targets for a sensor, handling mirrored corners/sides.
   */
  resolveTargets(sensor) {
    const pId = sensor.parentPartId;
    const targets = [];

    if (!sensor.mirrored) {
      const part = this.reg.parts.get(pId);
      if (part) targets.push({ part, anchor: { ...sensor.anchor } });
      return targets;
    }

    // Mirrored 4-corner parts (e.g. upright-FL, rim-FL, caliper-FL, suspension-FL, brake-duct-FL)
    if (pId.endsWith('-FL')) {
      const base = pId.slice(0, -3);
      const corners = [
        { key: 'FL', x: sensor.anchor.x, z: sensor.anchor.z },
        { key: 'FR', x: sensor.anchor.x, z: -sensor.anchor.z },
        { key: 'RL', x: sensor.anchor.x - (FRONT_AXLE_X - REAR_AXLE_X), z: sensor.anchor.z },
        { key: 'RR', x: sensor.anchor.x - (FRONT_AXLE_X - REAR_AXLE_X), z: -sensor.anchor.z },
      ];
      for (const c of corners) {
        const part = this.reg.parts.get(`${base}-${c.key}`);
        if (part) {
          targets.push({ part, anchor: { x: c.x, y: sensor.anchor.y, z: c.z } });
        }
      }
      return targets;
    }

    // Mirrored rear corners (e.g. driveshaft-RL)
    if (pId.endsWith('-RL')) {
      const base = pId.slice(0, -3);
      for (const [key, side] of [['RL', 1], ['RR', -1]]) {
        const part = this.reg.parts.get(`${base}-${key}`);
        if (part) {
          targets.push({ part, anchor: { x: sensor.anchor.x, y: sensor.anchor.y, z: side * Math.abs(sensor.anchor.z) } });
        }
      }
      return targets;
    }

    // Mirrored left/right body/internal parts (e.g. radiator-L, sidepod-L, sis-L)
    if (pId.endsWith('-L')) {
      const base = pId.slice(0, -2);
      const partL = this.reg.parts.get(`${base}-L`);
      const partR = this.reg.parts.get(`${base}-R`);
      if (partL) targets.push({ part: partL, anchor: { ...sensor.anchor } });
      if (partR) {
        targets.push({ part: partR, anchor: { ...sensor.anchor } });
      }
      return targets;
    }

    const defaultPart = this.reg.parts.get(pId);
    if (defaultPart) targets.push({ part: defaultPart, anchor: { ...sensor.anchor } });
    return targets;
  }

  /**
   * Build realistic 3D physical sensor hardware based on sensor type.
   */
  buildHardwareModel(sensor, group, part) {
    const meshes = [];
    const id = sensor.id;
    const catLedMat =
      sensor.category === 'control'
        ? this.materials.controlLed
        : sensor.category === 'monitoring'
        ? this.materials.monitoringLed
        : this.materials.instrumentationLed;

    const tag = (mesh, isMain = false) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        isSensor: true,
        isSensorMain: isMain,
        sensor,
        parentPart: part,
        markerGroup: group,
        baseScale: 1.0,
        baseMaterial: mesh.material,
      };
      group.add(mesh);
      this.markerMeshes.push(mesh);
      meshes.push(mesh);
      return mesh;
    };

    // 1. Dynamic Pitot-Static Tube Array
    if (id === 'sen_pitot_array') {
      const tube = new THREE.Mesh(this.geos.tubeProbe, this.materials.titanium);
      tube.rotation.z = Math.PI / 2;
      tag(tube, true);

      const collar = new THREE.Mesh(this.geos.baseCollar, this.materials.anodizedBlack);
      collar.rotation.z = Math.PI / 2;
      collar.position.x = -0.025;
      tag(collar);

      const tip = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      tip.position.x = 0.04;
      tag(tip);
    }
    // 2. Optical Infrared Pyrometers (Brake Disc, Tyre IR)
    else if (id === 'sen_brake_disc_temp' || id === 'sen_tyre_ir') {
      const body = new THREE.Mesh(this.geos.pyrometerBody, this.materials.anodizedBlack);
      body.rotation.x = Math.PI / 2;
      tag(body, true);

      const lens = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.013;
      tag(lens);

      const arm = new THREE.Mesh(this.geos.bracketArm, this.materials.titanium);
      arm.position.y = -0.008;
      tag(arm);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.z = -0.014;
      tag(beacon);
    }
    // 3. Strain-Gauge Load Cell Collars (Pushrod, Wing Strain, Driveshaft Torque)
    else if (id === 'sen_pushrod_load' || id === 'sen_wing_strain' || id === 'sen_driveshaft_torque') {
      const collar = new THREE.Mesh(this.geos.hexCollar, this.materials.titanium);
      tag(collar, true);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.x = 0.012;
      tag(gland);

      const ring = new THREE.Mesh(this.geos.accentRing, catLedMat);
      ring.rotation.x = Math.PI / 2;
      tag(ring);
    }
    // 4. Linear Travel Potentiometer / LVDT (Damper, Active Aero Flaps)
    else if (id === 'sen_damper_pos' || id === 'sen_active_aero_pos') {
      const outer = new THREE.Mesh(this.geos.potOuter, this.materials.anodizedBlack);
      outer.position.y = 0.01;
      tag(outer, true);

      const inner = new THREE.Mesh(this.geos.potInner, this.materials.steel);
      inner.position.y = -0.02;
      tag(inner);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.y = 0.035;
      tag(beacon);
    }
    // 5. Ultrasonic Fuel Mass Flow Meter
    else if (id === 'sen_fuel_flow') {
      const block = new THREE.Mesh(this.geos.flowBlock, this.materials.billetAlum);
      tag(block, true);

      for (const dx of [-0.02, 0.02]) {
        const port = new THREE.Mesh(this.geos.spigotCyl, this.materials.titanium);
        port.rotation.z = Math.PI / 2;
        port.position.x = dx;
        tag(port);
      }

      const ring = new THREE.Mesh(this.geos.accentRing, catLedMat);
      ring.rotation.y = Math.PI / 2;
      tag(ring);
    }
    // 6. FIA Accident Data Recorder (Crash Black Box)
    else if (id === 'sen_adr_crash') {
      const box = new THREE.Mesh(this.geos.adrBox, this.materials.crashOrange);
      tag(box, true);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.y = 0.014;
      tag(gland);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.set(0.015, 0.014, 0);
      tag(beacon);
    }
    // 7. Dynamic Laser Ride Height Sensor
    else if (id === 'sen_ride_height') {
      const block = new THREE.Mesh(this.geos.laserBox, this.materials.anodizedBlack);
      tag(block, true);

      const lens1 = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens1.position.set(-0.006, -0.006, 0);
      tag(lens1);
      const lens2 = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens2.position.set(0.006, -0.006, 0);
      tag(lens2);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.set(0, 0.008, 0);
      tag(beacon);
    }
    // 8. Telemetry Blade Antenna
    else if (id === 'sen_telemetry_antenna') {
      const blade = new THREE.Mesh(this.geos.antennaBlade, this.materials.anodizedBlack);
      blade.position.y = 0.025;
      tag(blade, true);

      const base = new THREE.Mesh(this.geos.baseCollar, this.materials.goldBrass);
      tag(base);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.y = 0.052;
      tag(beacon);
    }
    // 9. Tyre Pressure & Temp Wheel Sensor (TPMS)
    else if (id === 'sen_tpms') {
      const pack = new THREE.Mesh(this.geos.tpmsPack, this.materials.anodizedBlack);
      tag(pack, true);

      const stem = new THREE.Mesh(this.geos.valveStem, this.materials.titanium);
      stem.position.y = 0.012;
      tag(stem);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.set(0.008, 0.006, 0);
      tag(beacon);
    }
    // 10. FIA Standard Electronic Control Unit (SECU)
    else if (id === 'sen_secu') {
      const ecu = new THREE.Mesh(this.geos.ecuChassis, this.materials.billetAlum);
      tag(ecu, true);

      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
        c.rotation.z = Math.PI / 2;
        c.position.set(-0.025, 0, -0.01 + i * 0.01);
        tag(c);
      }

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.set(0.018, 0.01, 0);
      tag(beacon);
    }
    // 11. Generic High-Precision Transducer (Pressure, RPM, Resolver, Lambda, Temp, IMU)
    else {
      const body = new THREE.Mesh(this.geos.hexCollar, this.materials.titanium);
      tag(body, true);

      const spigot = new THREE.Mesh(this.geos.spigotCyl, this.materials.steel);
      spigot.position.y = -0.014;
      tag(spigot);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.y = 0.014;
      tag(gland);

      const beacon = new THREE.Mesh(this.geos.ledSphere, catLedMat);
      beacon.position.set(0.008, 0.012, 0);
      tag(beacon);
    }

    // Official FIA Mandatory Scrutineering Seal Ring
    if (sensor.authority === 'FIA') {
      const fiaHalo = new THREE.Mesh(this.geos.fiaRing, this.materials.fiaSeal);
      fiaHalo.rotation.x = Math.PI / 2;
      fiaHalo.userData = { isSensorRing: true, baseMaterial: this.materials.fiaSeal };
      group.add(fiaHalo);
    }

    // Optional debug coordinate axes
    if (DEBUG_SENSORS) {
      const axes = new THREE.AxesHelper(0.04);
      group.add(axes);
    }

    return meshes;
  }

  initMarkers() {
    for (const sensor of SENSORS) {
      const targets = this.resolveTargets(sensor);
      if (!targets.length) {
        console.warn(`[Sensors] No matching parent part found for sensor ${sensor.id} (${sensor.parentPartId})`);
        continue;
      }

      for (const { part, anchor } of targets) {
        const group = new THREE.Group();
        group.name = `sensor_${sensor.id}`;
        group.position.set(anchor.x, anchor.y, anchor.z);

        const meshes = this.buildHardwareModel(sensor, group, part);
        part.add(group);

        this.markers.push({
          group,
          meshes,
          mainMesh: meshes[0],
          sensor,
          parentPart: part,
        });
      }
    }
  }

  /**
   * Checks whether a sensor matches active category and authority filters.
   */
  matchesFilter(sensor) {
    if (this.filterCategory !== 'all' && sensor.category !== this.filterCategory) {
      return false;
    }
    if (this.filterAuthority !== 'all' && sensor.authority !== this.filterAuthority) {
      return false;
    }
    return true;
  }

  setFilters({ category, authority }) {
    if (category !== undefined) this.filterCategory = category;
    if (authority !== undefined) this.filterAuthority = authority;
    this.syncVisibility();
    this.requestRender();
  }

  /**
   * Synchronize visibility based on the Sensors layer, parent layer state, and active filters.
   */
  syncVisibility() {
    const sensorsLayerOn = !!this.state.layers.sensors;

    for (const m of this.markers) {
      const parentLayer = m.parentPart.userData.layer;
      const parentLayerOn = this.state.layers[parentLayer] !== false;
      const parentVisible = m.parentPart.visible;
      const filterMatch = this.matchesFilter(m.sensor);

      const visible = sensorsLayerOn && parentLayerOn && parentVisible && filterMatch;
      m.group.visible = visible;
    }
  }

  /**
   * Raycast against visible 3D sensor meshes.
   */
  pick(raycaster) {
    if (!this.state.layers.sensors) return null;

    const activeTargets = [];
    for (const mesh of this.markerMeshes) {
      if (mesh.parent && mesh.parent.visible && mesh.visible) {
        activeTargets.push(mesh);
      }
    }

    if (!activeTargets.length) return null;

    const hits = raycaster.intersectObjects(activeTargets, false);
    if (!hits.length) return null;

    const hit = hits[0];
    const { sensor, parentPart, markerGroup } = hit.object.userData;

    return {
      isSensor: true,
      sensor,
      marker: hit.object,
      markerGroup,
      part: parentPart,
      point: hit.point,
    };
  }

  /**
   * Highlight physical 3D sensor model when hovered.
   */
  highlight(marker, hot) {
    if (!marker) return;
    const group = marker.userData?.markerGroup;
    if (group) {
      const targetScale = hot ? 1.3 : 1.0;
      group.scale.setScalar(targetScale);
    }
    this.requestRender();
  }

  /**
   * Clean up resources on removal.
   */
  dispose() {
    for (const m of this.markers) {
      if (m.group.parent) {
        m.group.parent.remove(m.group);
      }
    }
    for (const geo of Object.values(this.geos)) {
      geo.dispose();
    }
    for (const mat of Object.values(this.materials)) {
      mat.dispose();
    }
    this.markers = [];
    this.markerMeshes = [];
  }
}

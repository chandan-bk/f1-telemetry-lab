import * as THREE from 'three';
import { SENSORS, SENSOR_CATEGORIES } from '../data/sensors.js';
import { ENABLE_SENSORS, DEBUG_SENSORS } from '../config/sensorsConfig.js';
import { FRONT_AXLE_X, REAR_AXLE_X } from './dims.js';

/**
 * Procedural 3D Motorsport IoT Sensors Hardware Generator.
 * Models real physical 3D motorsport hardware components at prominent scale (~15-28 cm)
 * so they are immediately visible as authentic 3D parts when orbiting 360° and disassembling in Exploded view.
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

    // Shared reusable geometries scaled for prominent 3D mechanical visibility
    this.geos = {
      // Cylinders & tubes
      tubeProbe: new THREE.CylinderGeometry(0.016, 0.024, 0.28, 16),
      pyrometerBody: new THREE.CylinderGeometry(0.034, 0.034, 0.12, 16),
      lensCyl: new THREE.CylinderGeometry(0.028, 0.028, 0.012, 16),
      hexCollar: new THREE.CylinderGeometry(0.048, 0.048, 0.10, 6),
      spigotCyl: new THREE.CylinderGeometry(0.024, 0.024, 0.036, 12),
      potOuter: new THREE.CylinderGeometry(0.026, 0.026, 0.18, 14),
      potInner: new THREE.CylinderGeometry(0.014, 0.014, 0.16, 14),
      valveStem: new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10),
      connectorGland: new THREE.CylinderGeometry(0.016, 0.016, 0.032, 12),
      baseCollar: new THREE.CylinderGeometry(0.036, 0.044, 0.048, 16),
      eyeletRing: new THREE.TorusGeometry(0.022, 0.007, 8, 16),
      // Boxes & enclosures
      flowBlock: new THREE.BoxGeometry(0.18, 0.09, 0.12),
      adrBox: new THREE.BoxGeometry(0.20, 0.10, 0.14),
      laserBox: new THREE.BoxGeometry(0.13, 0.05, 0.10),
      antennaBlade: new THREE.BoxGeometry(0.016, 0.24, 0.11),
      ecuChassis: new THREE.BoxGeometry(0.22, 0.08, 0.16),
      bracketArm: new THREE.BoxGeometry(0.018, 0.06, 0.032),
      tpmsPack: new THREE.BoxGeometry(0.10, 0.038, 0.065),
      // Mechanical accent rings (replaces freestanding glowing dots)
      accentBand: new THREE.TorusGeometry(0.052, 0.006, 8, 24),
      smallBand: new THREE.TorusGeometry(0.036, 0.005, 8, 20),
    };

    // Shared realistic motorsport materials
    this.materials = {
      titanium: new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.9, roughness: 0.22 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.15 }),
      anodizedBlack: new THREE.MeshStandardMaterial({ color: 0x16171a, metalness: 0.65, roughness: 0.28 }),
      billetAlum: new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 0.85, roughness: 0.2 }),
      goldBrass: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 }),
      crashOrange: new THREE.MeshStandardMaterial({ color: 0xff5500, metalness: 0.25, roughness: 0.35 }),
      lensGlass: new THREE.MeshPhysicalMaterial({
        color: 0x113366,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
      }),
      // Sleek anodized category accents for mechanical collars
      controlAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.control.color),
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(SENSOR_CATEGORIES.control.color),
        emissiveIntensity: 0.45,
      }),
      monitoringAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        emissiveIntensity: 0.45,
      }),
      instrumentationAccent: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        metalness: 0.5,
        roughness: 0.3,
        emissive: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        emissiveIntensity: 0.45,
      }),
    };

    if (ENABLE_SENSORS) {
      this.initMarkers();
    }
  }

  resolveTargets(sensor) {
    const pId = sensor.parentPartId;
    const targets = [];

    if (!sensor.mirrored) {
      const part = this.reg.parts.get(pId);
      if (part) targets.push({ part, anchor: { ...sensor.anchor } });
      return targets;
    }

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

    if (pId.endsWith('-L')) {
      const base = pId.slice(0, -2);
      const partL = this.reg.parts.get(`${base}-L`);
      const partR = this.reg.parts.get(`${base}-R`);
      if (partL) targets.push({ part: partL, anchor: { ...sensor.anchor } });
      if (partR) targets.push({ part: partR, anchor: { ...sensor.anchor } });
      return targets;
    }

    const defaultPart = this.reg.parts.get(pId);
    if (defaultPart) targets.push({ part: defaultPart, anchor: { ...sensor.anchor } });
    return targets;
  }

  buildHardwareModel(sensor, group, part) {
    const meshes = [];
    const id = sensor.id;
    const catAccent =
      sensor.category === 'control'
        ? this.materials.controlAccent
        : sensor.category === 'monitoring'
        ? this.materials.monitoringAccent
        : this.materials.instrumentationAccent;

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
      tube.position.x = 0.10;
      tag(tube, true);

      const collar = new THREE.Mesh(this.geos.baseCollar, this.materials.anodizedBlack);
      collar.rotation.z = Math.PI / 2;
      collar.position.x = -0.04;
      tag(collar);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.rotation.y = Math.PI / 2;
      band.position.x = 0.05;
      tag(band);
    }
    // 2. Optical Infrared Pyrometers (Brake Disc, Tyre IR)
    else if (id === 'sen_brake_disc_temp' || id === 'sen_tyre_ir') {
      const body = new THREE.Mesh(this.geos.pyrometerBody, this.materials.anodizedBlack);
      body.rotation.x = Math.PI / 2;
      tag(body, true);

      const lens = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.06;
      tag(lens);

      const arm = new THREE.Mesh(this.geos.bracketArm, this.materials.titanium);
      arm.position.y = -0.035;
      tag(arm);

      const conn = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      conn.rotation.x = Math.PI / 2;
      conn.position.z = -0.07;
      tag(conn);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.position.z = 0.02;
      tag(band);
    }
    // 3. Strain-Gauge Load Cell Collars (Pushrod, Wing Strain, Driveshaft Torque)
    else if (id === 'sen_pushrod_load' || id === 'sen_wing_strain' || id === 'sen_driveshaft_torque') {
      const collar = new THREE.Mesh(this.geos.hexCollar, this.materials.titanium);
      tag(collar, true);

      for (const dy of [-0.06, 0.06]) {
        const spigot = new THREE.Mesh(this.geos.spigotCyl, this.materials.steel);
        spigot.position.y = dy;
        tag(spigot);
      }

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.x = 0.055;
      tag(gland);

      const ring = new THREE.Mesh(this.geos.accentBand, catAccent);
      ring.rotation.x = Math.PI / 2;
      tag(ring);
    }
    // 4. Linear Travel Potentiometer / LVDT (Damper, Active Aero Flaps)
    else if (id === 'sen_damper_pos' || id === 'sen_active_aero_pos') {
      const outer = new THREE.Mesh(this.geos.potOuter, this.materials.anodizedBlack);
      outer.position.y = 0.04;
      tag(outer, true);

      const inner = new THREE.Mesh(this.geos.potInner, this.materials.steel);
      inner.position.y = -0.09;
      tag(inner);

      const eyelet = new THREE.Mesh(this.geos.eyeletRing, this.materials.titanium);
      eyelet.position.y = 0.14;
      tag(eyelet);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.set(0.032, 0.09, 0);
      tag(gland);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.02;
      tag(band);
    }
    // 5. Ultrasonic Fuel Mass Flow Meter
    else if (id === 'sen_fuel_flow') {
      const block = new THREE.Mesh(this.geos.flowBlock, this.materials.billetAlum);
      tag(block, true);

      for (const dx of [-0.10, 0.10]) {
        const port = new THREE.Mesh(this.geos.spigotCyl, this.materials.titanium);
        port.rotation.z = Math.PI / 2;
        port.position.x = dx;
        tag(port);
      }

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.y = 0.055;
      tag(gland);

      const band = new THREE.Mesh(this.geos.accentBand, catAccent);
      band.rotation.y = Math.PI / 2;
      tag(band);
    }
    // 6. FIA Accident Data Recorder (Crash Black Box)
    else if (id === 'sen_adr_crash') {
      const box = new THREE.Mesh(this.geos.adrBox, this.materials.crashOrange);
      tag(box, true);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.set(0.05, 0.06, 0);
      tag(gland);

      const band = new THREE.Mesh(this.geos.accentBand, catAccent);
      band.position.set(-0.04, 0.052, 0);
      tag(band);
    }
    // 7. Dynamic Laser Ride Height Sensor
    else if (id === 'sen_ride_height') {
      const block = new THREE.Mesh(this.geos.laserBox, this.materials.anodizedBlack);
      tag(block, true);

      const lens1 = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens1.position.set(-0.035, -0.028, 0);
      tag(lens1);
      const lens2 = new THREE.Mesh(this.geos.lensCyl, this.materials.lensGlass);
      lens2.position.set(0.035, -0.028, 0);
      tag(lens2);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.rotation.z = Math.PI / 2;
      gland.position.set(0.075, 0.01, 0);
      tag(gland);
    }
    // 8. Telemetry RF Blade Antenna
    else if (id === 'sen_telemetry_antenna') {
      const blade = new THREE.Mesh(this.geos.antennaBlade, this.materials.anodizedBlack);
      blade.position.y = 0.12;
      tag(blade, true);

      const base = new THREE.Mesh(this.geos.baseCollar, this.materials.goldBrass);
      tag(base);

      const band = new THREE.Mesh(this.geos.smallBand, catAccent);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.03;
      tag(band);
    }
    // 9. Tyre Pressure & Temp Wheel Sensor (TPMS)
    else if (id === 'sen_tpms') {
      const pack = new THREE.Mesh(this.geos.tpmsPack, this.materials.anodizedBlack);
      tag(pack, true);

      const stem = new THREE.Mesh(this.geos.valveStem, this.materials.titanium);
      stem.position.y = 0.05;
      tag(stem);

      const cap = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      cap.position.y = 0.09;
      tag(cap);
    }
    // 10. FIA Standard Electronic Control Unit (SECU)
    else if (id === 'sen_secu') {
      const ecu = new THREE.Mesh(this.geos.ecuChassis, this.materials.billetAlum);
      tag(ecu, true);

      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
        c.rotation.z = Math.PI / 2;
        c.position.set(-0.12, 0, -0.04 + i * 0.04);
        tag(c);
      }
    }
    // 11. Generic High-Precision Motorsport Transducer
    else {
      const body = new THREE.Mesh(this.geos.hexCollar, this.materials.titanium);
      tag(body, true);

      const spigot = new THREE.Mesh(this.geos.spigotCyl, this.materials.steel);
      spigot.position.y = -0.06;
      tag(spigot);

      const gland = new THREE.Mesh(this.geos.connectorGland, this.materials.goldBrass);
      gland.position.y = 0.06;
      tag(gland);

      const ring = new THREE.Mesh(this.geos.accentBand, catAccent);
      ring.rotation.x = Math.PI / 2;
      tag(ring);
    }

    if (DEBUG_SENSORS) {
      const axes = new THREE.AxesHelper(0.12);
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

    const hitMesh = hits[0].object;
    const { sensor, parentPart, markerGroup } = hitMesh.userData;

    return {
      isSensor: true,
      sensor,
      part: parentPart,
      marker: markerGroup,
      point: hits[0].point,
    };
  }

  highlight(markerGroup, isHighlighted) {
    if (!markerGroup) return;

    markerGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData.isSensor) {
        if (isHighlighted) {
          obj.scale.setScalar(1.25);
          if (obj.material && obj.material.emissive) {
            obj.userData._origEmissive = obj.userData._origEmissive || obj.material.emissiveIntensity;
            obj.material.emissiveIntensity = 1.6;
          }
        } else {
          obj.scale.setScalar(obj.userData.baseScale || 1.0);
          if (obj.material && obj.material.emissive && obj.userData._origEmissive !== undefined) {
            obj.material.emissiveIntensity = obj.userData._origEmissive;
          }
        }
      }
    });
  }

  dispose() {
    for (const g of Object.values(this.geos)) g.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    this.markers = [];
    this.markerMeshes = [];
  }
}

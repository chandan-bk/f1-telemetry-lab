import * as THREE from 'three';
import { SENSORS, SENSOR_CATEGORIES } from '../data/sensors.js';
import { ENABLE_SENSORS, DEBUG_SENSORS } from '../config/sensorsConfig.js';
import { FRONT_AXLE_X, REAR_AXLE_X } from './dims.js';

/**
 * Creates and manages motorsport IoT telemetry sensor markers.
 * All markers share geometries and materials to ensure zero per-frame allocations.
 */
export class SensorsManager {
  constructor({ scene, reg, state, requestRender }) {
    this.scene = scene;
    this.reg = reg;
    this.state = state;
    this.requestRender = requestRender;

    this.markers = []; // Array of marker instances
    this.markerMeshes = []; // Array of Raycast target meshes
    this.filterCategory = 'all';
    this.filterAuthority = 'all';

    // Shared geometries
    this.sphereGeo = new THREE.SphereGeometry(0.016, 16, 14);
    this.ringGeo = new THREE.TorusGeometry(0.024, 0.0035, 8, 24);

    // Shared base materials per category
    this.materials = {
      control: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.control.color),
        emissive: new THREE.Color(SENSOR_CATEGORIES.control.color),
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.1,
      }),
      monitoring: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        emissive: new THREE.Color(SENSOR_CATEGORIES.monitoring.color),
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.1,
      }),
      instrumentation: new THREE.MeshStandardMaterial({
        color: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        emissive: new THREE.Color(SENSOR_CATEGORIES.instrumentation.color),
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.1,
      }),
      fiaRing: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xe10600,
        emissiveIntensity: 1.1,
        roughness: 0.3,
        metalness: 0.2,
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
        // Mirrored via reg.mirror (scale.z = -1) automatically flips local z
        targets.push({ part: partR, anchor: { ...sensor.anchor } });
      }
      return targets;
    }

    const defaultPart = this.reg.parts.get(pId);
    if (defaultPart) targets.push({ part: defaultPart, anchor: { ...sensor.anchor } });
    return targets;
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
        group.name = `marker_${sensor.id}`;
        group.position.set(anchor.x, anchor.y, anchor.z);

        // Core marker sphere
        const mat = this.materials[sensor.category] || this.materials.monitoring;
        const sphereMesh = new THREE.Mesh(this.sphereGeo, mat);
        sphereMesh.name = `sphere_${sensor.id}`;
        sphereMesh.userData = {
          isSensor: true,
          sensor,
          parentPart: part,
          markerGroup: group,
          baseScale: 1.0,
          baseMaterial: mat,
        };
        group.add(sphereMesh);
        this.markerMeshes.push(sphereMesh);

        // Mandatory FIA ring for scrutineering identification
        if (sensor.authority === 'FIA') {
          const ringMesh = new THREE.Mesh(this.ringGeo, this.materials.fiaRing);
          ringMesh.rotation.x = Math.PI / 2;
          ringMesh.userData = { isSensorRing: true, baseMaterial: this.materials.fiaRing };
          group.add(ringMesh);
        }

        // Optional debug coordinate axes
        if (DEBUG_SENSORS) {
          const axes = new THREE.AxesHelper(0.04);
          group.add(axes);
        }

        // Parent directly to the car part Object3D
        part.add(group);

        this.markers.push({
          group,
          sphereMesh,
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
   * Raycast against visible sensor markers.
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
   * Highlight marker when hovered.
   */
  highlight(marker, hot) {
    if (!marker) return;
    const targetScale = hot ? 1.4 : 1.0;
    marker.scale.setScalar(targetScale);
    if (marker.material?.emissiveIntensity !== undefined) {
      marker.material.emissiveIntensity = hot ? 1.6 : 0.85;
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
    this.sphereGeo.dispose();
    this.ringGeo.dispose();
    for (const mat of Object.values(this.materials)) {
      mat.dispose();
    }
    this.markers = [];
    this.markerMeshes = [];
  }
}

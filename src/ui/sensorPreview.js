import * as THREE from 'three';
import { SENSORS, SENSOR_CATEGORIES } from '../data/sensors.js';

/**
 * Interactive 3D 360° Turntable Inspector for Motorsport IoT Sensors.
 * Renders a dedicated real-time 3D model of the selected sensor with
 * smooth continuous 360° rotation and interactive mouse/touch drag controls.
 */

let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewGroup = null;
let animFrameId = null;
let activeSensorId = null;

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let userRotation = { x: 0.2, y: 0 };
let autoRotateSpeed = 0.012;
let autoRotate = true;

// Shared preview materials
const materials = {
  titanium: new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.9, roughness: 0.22 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.15 }),
  anodizedBlack: new THREE.MeshStandardMaterial({ color: 0x16171a, metalness: 0.65, roughness: 0.28 }),
  billetAlum: new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 0.85, roughness: 0.2 }),
  goldBrass: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 }),
  crashOrange: new THREE.MeshStandardMaterial({ color: 0xff5500, metalness: 0.25, roughness: 0.35 }),
  lensGlass: new THREE.MeshPhysicalMaterial({
    color: 0x113366,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.9,
    transparent: true,
    opacity: 0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  }),
  carbonFiber: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.4, roughness: 0.5 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.3 }),
};

function getCategoryColor(sensorId) {
  const sensor = SENSORS.find((s) => s.id === sensorId);
  const cat = sensor?.category ?? 'control';
  return SENSOR_CATEGORIES[cat]?.color ?? '#00E5FF';
}

/**
 * Builds high-fidelity procedural 3D sensor model for the 360° inspector.
 */
function buildDetailedSensorModel(sensorId) {
  const group = new THREE.Group();
  const catColor = getCategoryColor(sensorId);
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(catColor),
    emissive: new THREE.Color(catColor),
    emissiveIntensity: 0.8,
    roughness: 0.25,
  });

  // 1. Dynamic Pitot-Static Tube Array
  if (sensorId === 'sen_pitot_array') {
    // Forward probe tube
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.32, 24), materials.titanium);
    probe.rotation.z = Math.PI / 2;
    group.add(probe);

    // Static pressure ports rings
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.003, 12, 24), materials.steel);
    ring1.rotation.y = Math.PI / 2;
    ring1.position.x = 0.06;
    group.add(ring1);

    // Base mounting collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.07, 24), materials.anodizedBlack);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = -0.14;
    group.add(collar);

    // Aero mounting flange with bolts
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.016, 6), materials.titanium);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = -0.17;
    group.add(flange);

    // Gold wiring gland
    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 12), materials.goldBrass);
    gland.rotation.z = Math.PI / 2;
    gland.position.x = -0.2;
    group.add(gland);

    // Category accent band
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), accentMat);
    band.rotation.z = Math.PI / 2;
    band.position.x = -0.06;
    group.add(band);
  }
  // 2. Optical Infrared Pyrometers (Brake Disc, Tyre IR)
  else if (sensorId === 'sen_brake_disc_temp' || sensorId === 'sen_tyre_ir') {
    // Sensor barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.16, 24), materials.anodizedBlack);
    barrel.rotation.x = Math.PI / 2;
    group.add(barrel);

    // Machined cooling fins
    for (let z = -0.04; z <= 0.03; z += 0.02) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.0035, 8, 24), materials.billetAlum);
      fin.position.z = z;
      group.add(fin);
    }

    // Front lens bezel
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 24), materials.titanium);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.z = 0.08;
    group.add(bezel);

    // Sapphire optical glass lens
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.008, 24), materials.lensGlass);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.09;
    group.add(lens);

    // Rear LEMO circular telemetry connector
    const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.045, 16), materials.goldBrass);
    conn.rotation.x = Math.PI / 2;
    conn.position.z = -0.1;
    group.add(conn);

    // Rigid titanium mounting bracket
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.08, 0.06), materials.titanium);
    bracket.position.set(0, -0.05, 0);
    group.add(bracket);

    // Accent indicator band
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 8, 24), accentMat);
    band.position.z = 0.06;
    group.add(band);
  }
  // 3. Strain-Gauge Load Cell Collars (Pushrod, Wing Strain, Driveshaft Torque)
  else if (sensorId === 'sen_pushrod_load' || sensorId === 'sen_wing_strain' || sensorId === 'sen_driveshaft_torque') {
    // Hexagonal titanium load body
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.14, 6), materials.titanium);
    group.add(hex);

    // Threaded spigots on both ends
    for (const y of [-0.09, 0.09]) {
      const spigot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 16), materials.steel);
      spigot.position.y = y;
      group.add(spigot);

      const locknut = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.018, 6), materials.billetAlum);
      locknut.position.y = y;
      group.add(locknut);
    }

    // Radial gold Amphenol connector gland
    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 14), materials.goldBrass);
    gland.rotation.z = Math.PI / 2;
    gland.position.x = 0.062;
    group.add(gland);

    // Accent band around waist
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.004, 8, 24), accentMat);
    band.rotation.x = Math.PI / 2;
    group.add(band);
  }
  // 4. Linear Travel Potentiometer / LVDT (Damper, Active Aero Flaps)
  else if (sensorId === 'sen_damper_pos' || sensorId === 'sen_active_aero_pos') {
    // Outer anodized cylinder barrel
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 20), materials.anodizedBlack);
    outer.position.y = 0.04;
    group.add(outer);

    // Inner chrome polished slider rod
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 20), materials.steel);
    inner.position.y = -0.11;
    group.add(inner);

    // Spherical rod-end heim joints at both ends
    for (const [y, mat] of [[0.16, materials.titanium], [-0.24, materials.steel]]) {
      const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 10, 20), mat);
      eyelet.position.y = y;
      group.add(eyelet);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), materials.billetAlum);
      ball.position.y = y;
      group.add(ball);
    }

    // Wiring gland on top of cylinder
    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), materials.goldBrass);
    gland.rotation.z = Math.PI / 2;
    gland.position.set(0.036, 0.11, 0);
    group.add(gland);

    // Accent collar
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 20), accentMat);
    band.position.y = -0.05;
    group.add(band);
  }
  // 5. Ultrasonic Fuel Mass Flow Meter (FIA Homologated)
  else if (sensorId === 'sen_fuel_flow') {
    // Milled aerospace billet aluminum block
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.11, 0.12), materials.billetAlum);
    group.add(block);

    // High-flow AN fuel ports (inlet/outlet)
    for (const x of [-0.12, 0.12]) {
      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 18), materials.anodizedBlack);
      port.rotation.z = Math.PI / 2;
      port.position.x = x;
      group.add(port);

      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 6), materials.goldBrass);
      nut.rotation.z = Math.PI / 2;
      nut.position.x = x;
      group.add(nut);
    }

    // Dual ultrasonic piezoelectric sensor bosses (angled V-path)
    for (const z of [-0.038, 0.038]) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.035, 16), materials.titanium);
      boss.position.set(0, 0.065, z);
      group.add(boss);
    }

    // Sealed wiring connector header
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.04), materials.anodizedBlack);
    header.position.set(0, -0.065, 0);
    group.add(header);

    // FIA Scrutineering holographic seal ring
    const fiaSeal = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.005, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe10600, emissiveIntensity: 1.2 })
    );
    fiaSeal.rotation.x = Math.PI / 2;
    fiaSeal.position.y = 0.058;
    group.add(fiaSeal);
  }
  // 6. FIA Accident Data Recorder (Crash Black Box)
  else if (sensorId === 'sen_adr_crash') {
    // Signature crash-orange hardened magnesium enclosure
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.15), materials.crashOrange);
    group.add(box);

    // Ruggedized multi-pin circular Amphenol connector
    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 20), materials.goldBrass);
    gland.position.set(0.06, 0.07, 0);
    group.add(gland);

    // Triaxial internal accelerometer orientation cross marker
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.008), materials.anodizedBlack);
    cross1.position.set(-0.04, 0.062, 0);
    group.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.05), materials.anodizedBlack);
    cross2.position.set(-0.04, 0.062, 0);
    group.add(cross2);

    // Bolted mounting flanges on 4 corners
    for (const [x, z] of [[-0.12, -0.08], [0.12, -0.08], [-0.12, 0.08], [0.12, 0.08]]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), materials.billetAlum);
      ear.position.set(x, -0.055, z);
      group.add(ear);
    }
  }
  // 7. Dynamic Laser Ride Height Sensor
  else if (sensorId === 'sen_ride_height') {
    // Black anodized optical triangulation pod
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.12), materials.anodizedBlack);
    group.add(chassis);

    // Laser emitter lens (angled)
    const emitLens = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.015, 20), materials.lensGlass);
    emitLens.position.set(-0.045, -0.038, 0);
    group.add(emitLens);

    // Laser receiver sensor optics
    const recLens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.015, 20), materials.lensGlass);
    recLens.position.set(0.045, -0.038, 0);
    group.add(recLens);

    // LEMO telemetry socket
    const lemo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 14), materials.goldBrass);
    lemo.rotation.z = Math.PI / 2;
    lemo.position.set(0.10, 0.01, 0);
    group.add(lemo);

    // Category accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.012), accentMat);
    stripe.position.set(0, 0.036, 0.055);
    group.add(stripe);
  }
  // 8. Telemetry RF Blade Antenna
  else if (sensorId === 'sen_telemetry_antenna') {
    // Carbon-composite aerodynamic blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.12), materials.carbonFiber);
    blade.position.y = 0.08;
    group.add(blade);

    // Gold brass RF connector ferrule
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.06, 20), materials.goldBrass);
    ferrule.position.y = -0.08;
    group.add(ferrule);

    // Coaxial SMA connector socket
    const sma = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.035, 14), materials.steel);
    sma.position.y = -0.12;
    group.add(sma);

    // Leading edge accent strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.24, 0.012), accentMat);
    strip.position.set(0, 0.08, 0.058);
    group.add(strip);
  }
  // 9. Wheel TPMS Valve Module
  else if (sensorId === 'sen_tpms') {
    // Transponder electronics module (curved to fit wheel rim)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.08), materials.anodizedBlack);
    group.add(pack);

    // Machined titanium Schrader valve stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 16), materials.titanium);
    stem.position.set(0, 0.07, 0);
    group.add(stem);

    // Threaded brass valve cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 14), materials.goldBrass);
    cap.position.set(0, 0.135, 0);
    group.add(cap);

    // Pressure port orifice
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), materials.billetAlum);
    port.position.set(0.035, -0.025, 0);
    group.add(port);
  }
  // 10. FIA Standard ECU (McLaren Applied SECU)
  else if (sensorId === 'sen_secu') {
    // Milled aluminum avionics chassis with heatsink cooling fins
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.18), materials.billetAlum);
    group.add(chassis);

    // Longitudinal cooling fins across top surface
    for (let z = -0.07; z <= 0.07; z += 0.02) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.006), materials.anodizedBlack);
      fin.position.set(0, 0.05, z);
      group.add(fin);
    }

    // Triple military-spec circular Amphenol connector sockets
    for (let i = 0; i < 3; i++) {
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 18), materials.goldBrass);
      socket.rotation.z = Math.PI / 2;
      socket.position.set(-0.13, 0, -0.05 + i * 0.05);
      group.add(socket);
    }

    // Diagnostic Ethernet LEMO socket
    const diag = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 14), materials.steel);
    diag.rotation.z = Math.PI / 2;
    diag.position.set(0.13, 0, 0.04);
    group.add(diag);

    // FIA Scrutineering tamper badge
    const seal = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.004, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe10600, emissiveIntensity: 1.2 })
    );
    seal.position.set(0, 0.048, 0);
    group.add(seal);
  }
  // 11. Generic High-Precision Motorsport Transducer
  else {
    // Titanium hexagonal transducer body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.13, 6), materials.titanium);
    group.add(body);

    // Threaded steel fluid/pressure spigot
    const spigot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.06, 16), materials.steel);
    spigot.position.y = -0.085;
    group.add(spigot);

    // Gold telemetry wiring connector
    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 14), materials.goldBrass);
    gland.position.y = 0.08;
    group.add(gland);

    // Category indicator band
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.004, 8, 24), accentMat);
    band.rotation.x = Math.PI / 2;
    group.add(band);
  }

  return group;
}

/**
 * Initializes or mounts the 360° preview in the given container element.
 */
export function mountSensorPreview(containerEl, sensorId, { onFocus } = {}) {
  if (!containerEl) return;
  activeSensorId = sensorId;

  // Initialize preview renderer and scene once
  if (!previewRenderer) {
    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRenderer.shadowMap.enabled = true;
    previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    previewScene = new THREE.Scene();

    // Studio lighting setup
    const amb = new THREE.AmbientLight(0xffffff, 1.2);
    previewScene.add(amb);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(2, 3, 2);
    previewScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 1.0);
    fillLight.position.set(-2, -1, -2);
    previewScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 1.6);
    rimLight.position.set(0, 2, -3);
    previewScene.add(rimLight);

    previewCamera = new THREE.PerspectiveCamera(40, 1, 0.05, 10);
    previewCamera.position.set(0, 0.25, 0.65);
    previewCamera.lookAt(0, 0, 0);

    previewGroup = new THREE.Group();
    previewScene.add(previewGroup);
  }

  // Clear previous preview model
  while (previewGroup.children.length > 0) {
    const child = previewGroup.children.pop();
    if (child.geometry) child.geometry.dispose();
  }

  // Add new model
  const model = buildDetailedSensorModel(sensorId);
  previewGroup.add(model);

  // Center model and frame camera
  const bbox = new THREE.Box3().setFromObject(model);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  model.position.sub(center); // center at (0, 0, 0)

  const maxDim = Math.max(size.x, size.y, size.z, 0.15);
  previewCamera.position.set(0, maxDim * 0.45, maxDim * 2.2);
  previewCamera.lookAt(0, 0, 0);

  // Resize to container
  const w = containerEl.clientWidth || 280;
  const h = containerEl.clientHeight || 180;
  previewRenderer.setSize(w, h);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();

  // Attach canvas to container
  containerEl.innerHTML = '';
  containerEl.appendChild(previewRenderer.domElement);

  // Add HUD overlay badge & controls
  const badge = document.createElement('div');
  badge.className = 'sensor-3d-badge';
  badge.innerHTML = `
    <span><b>360° 3D MODEL</b> · Drag to Inspect</span>
  `;
  containerEl.appendChild(badge);

  if (onFocus) {
    const focusBtn = document.createElement('button');
    focusBtn.className = 'sensor-focus-btn';
    focusBtn.innerHTML = `<span>Focus 3D View</span>`;
    focusBtn.title = 'Zoom camera to inspect this sensor on the car';
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onFocus();
    });
    containerEl.appendChild(focusBtn);
  }

  // Mouse / Touch drag interaction for 360° rotation
  userRotation = { x: 0.25, y: 0.4 };
  autoRotate = true;

  const canvas = previewRenderer.domElement;
  canvas.style.cursor = 'grab';

  const onPointerDown = (e) => {
    isDragging = true;
    autoRotate = false;
    canvas.style.cursor = 'grabbing';
    previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    userRotation.y += deltaX * 0.015;
    userRotation.x = Math.max(-1.2, Math.min(1.2, userRotation.x + deltaY * 0.015));

    previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
  };

  canvas.onpointerdown = onPointerDown;
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Start animation loop
  if (animFrameId) cancelAnimationFrame(animFrameId);

  const animate = () => {
    animFrameId = requestAnimationFrame(animate);

    if (autoRotate) {
      userRotation.y += autoRotateSpeed;
    }

    if (previewGroup) {
      previewGroup.rotation.x = userRotation.x;
      previewGroup.rotation.y = userRotation.y;
    }

    if (previewRenderer && previewScene && previewCamera) {
      previewRenderer.render(previewScene, previewCamera);
    }
  };

  animate();
}

/**
 * Stop preview animation loop when card is closed.
 */
export function unmountSensorPreview() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

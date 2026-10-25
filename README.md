# Formula 1 Rules & Motorsport IoT Sensors Explorer

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/chandan-bk/formula1-sensors)

An interactive, explodable 3D Formula 1 car (Three.js + Vite) explaining both the 2026 FIA Formula 1 Technical Regulations and **32 Real-Time Motorsport IoT Telemetry Sensors**.

👉 **Live Demo on GitHub**: [https://github.com/chandan-bk/formula1-sensors](https://github.com/chandan-bk/formula1-sensors)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Features

- **Motorsport IoT Sensors Layer**: 32 real-world motorsport telemetry sensors modeled in 3D across 55 physical mounting locations (pitot tube array, brake pyrometers, pushrod load cells, damper potentiometers, ultrasonic fuel flow meters, ADR crash black boxes, RF antennas, and the FIA SECU).
- **Interactive 3D 360° Turntable Inspector**: Clicking any sensor opens a live 3D mini-studio inside the callout card with auto-turntable and mouse/touch drag controls to inspect physical hardware geometry.
- **Camera Focus Zoom**: Click "Focus 3D View" or pick any sensor to fly the camera close-up to inspect it directly in place on the car.
- **Subsystem & Authority Filters**: Filter sensors by `Control`, `Monitoring`, `Instrumentation`, `FIA Mandatory`, and `Team Engineering`.
- **Disassemble & Explode**: Presets and an explode slider to view all internals and see physical sensors track outward with their parent assemblies.
- **X-Ray & Active Aero**: Inspect powertrain internals through translucent bodywork and toggle active aerodynamics.
- **Rule & Category Colors**: Tint components by regulatory design classification.

## Deployment to Vercel

Click the **Deploy with Vercel** button above or import the repository `chandan-bk/formula1-sensors` into your Vercel dashboard.

```bash
npx vercel --prod
```

## Sources & References

- FIA 2026 Formula 1 Technical Regulations (Issue 20).
- McLaren Applied Standard Electronic Control Unit (TAG-320 / SECU) specifications.
- Texense, Gill Sensors & Controls, Bosch Motorsport technical documentation.

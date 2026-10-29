# F1 Telemetry Lab — Motorsport IoT Sensors Explorer

An interactive 3D Formula 1-inspired car built with Three.js and Vite. It combines an explodable car model, representative sensor locations, a searchable sensor catalog, and a telemetry control-room dashboard.

## Features

- Interactive 3D car with assembled, no-bodywork, and exploded views.
- 32 representative sensor types across control, monitoring, and engineering instrumentation categories.
- Searchable sensor catalog with category and authority filters.
- Select a sensor from the catalog to focus the 3D camera on its placement.
- Sensor callouts with measurement purpose and representative data path.
- Telemetry control-room overlay with metric cards, signal history chart, health indicators, and IoT data-path diagram.
- Clearly labelled simulated demo data, pause/resume controls, reset history, and CSV export.
- Optional WebSocket bridge input for external hardware gateways that send JSON measurements.
- X-ray, camera presets, dimensions, part exploration, and responsive layout.

## Run locally

Requires a current Node.js installation.

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Optional hardware data bridge

Open **Telemetry** in the top bar. The dashboard runs simulated data by default and explicitly labels it as demo data. To use actual sensor readings, a compatible WebSocket bridge must be running and configured in the dashboard. The browser cannot directly read arbitrary ESP32 sensor pins; the ESP32 firmware and/or a gateway must publish the measurements over a protocol the browser can access.

The bridge should send JSON objects with these numeric keys (timestamp is optional):

```json
{
  "timestamp": "2026-10-29T10:00:00.000Z",
  "rpm": 850,
  "temperature": 43.2,
  "voltage": 7.6,
  "current": 1.25,
  "accel": 0.2,
  "vibration": 0.15
}
```

Use `ws://localhost:81` only if a bridge is actually listening at that address. For a remote device, enter its reachable WebSocket URL. HTTPS-hosted deployments generally require a secure `wss://` endpoint.

## Important limitations

This is an educational 3D visualization. The listed sensor locations and data paths are representative, not official team layouts. The default dashboard values are simulated, not actual Formula 1 telemetry. The application does not connect to a real F1 car. Sensor fitment, data rates, and regulatory details vary by system and season; consult current regulations and manufacturer documentation for technical claims. Do not use this educational prototype as a safety system.

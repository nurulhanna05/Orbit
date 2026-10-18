// Mock telemetry for edge inference nodes, IoT sensors and supporting infrastructure.
// Shapes mirror what the FastAPI service would expose at /api/v1/health.

export type EdgeNode = {
  id: string;
  hardware: string;
  site: string;
  model: string;
  cpu: number;
  gpu: number;
  tempC: number;
  fps: number;
  uptimeDays: number;
};

export type SensorKind = 'water_pressure' | 'lux' | 'bin_fill' | 'rain_gauge' | 'power_meter';

export type IotSensor = {
  id: string;
  kind: SensorKind;
  site: string;
  value: number;
  unit: string;
  min: number; // healthy range
  max: number;
  battery: number;
  lastSeenMins: number;
};

export const EDGE_NODES: EdgeNode[] = [
  { id: 'EN-01', hardware: 'Jetson Orin Nano 8GB', site: 'Central Park kiosk', model: 'yolov8n-ag 0.4.2', cpu: 38, gpu: 61, tempC: 52, fps: 24, uptimeDays: 41 },
  { id: 'EN-02', hardware: 'Jetson Orin Nano 8GB', site: 'Precinct 2 M&E room', model: 'yolov8n-ag 0.4.2', cpu: 44, gpu: 67, tempC: 57, fps: 22, uptimeDays: 41 },
  { id: 'EN-03', hardware: 'Jetson Orin NX 16GB', site: 'Main gate guardhouse', model: 'yolov8s-ag 0.4.2', cpu: 51, gpu: 72, tempC: 61, fps: 20, uptimeDays: 12 },
  { id: 'EN-04', hardware: 'Intel NUC + Coral TPU', site: 'Commercial hub riser', model: 'yolov8n-ag 0.4.1', cpu: 63, gpu: 0, tempC: 66, fps: 14, uptimeDays: 6 },
];

export const IOT_SENSORS: IotSensor[] = [
  { id: 'WP-01', kind: 'water_pressure', site: 'Lakeside irrigation main', value: 2.9, unit: 'bar', min: 2.5, max: 4.5, battery: 81, lastSeenMins: 1 },
  { id: 'WP-02', kind: 'water_pressure', site: 'Block C riser', value: 2.3, unit: 'bar', min: 2.5, max: 4.5, battery: 64, lastSeenMins: 2 },
  { id: 'LX-01', kind: 'lux', site: 'Central Park path', value: 14, unit: 'lux', min: 10, max: 200, battery: 72, lastSeenMins: 1 },
  { id: 'LX-02', kind: 'lux', site: 'Main gate apron', value: 31, unit: 'lux', min: 10, max: 200, battery: 90, lastSeenMins: 3 },
  { id: 'BF-01', kind: 'bin_fill', site: 'Block C bin bay', value: 78, unit: '%', min: 0, max: 85, battery: 55, lastSeenMins: 4 },
  { id: 'BF-02', kind: 'bin_fill', site: 'Playground bin', value: 34, unit: '%', min: 0, max: 85, battery: 18, lastSeenMins: 6 },
  { id: 'RG-01', kind: 'rain_gauge', site: 'Elmina Lakeside', value: 3.2, unit: 'mm/h', min: 0, max: 30, battery: 88, lastSeenMins: 2 },
  { id: 'PM-01', kind: 'power_meter', site: 'Street lighting feeder A', value: 11.4, unit: 'kW', min: 8, max: 16, battery: 100, lastSeenMins: 1 },
];

export const SENSOR_LABELS: Record<SensorKind, string> = {
  water_pressure: 'Water pressure',
  lux: 'Ambient light',
  bin_fill: 'Bin fill level',
  rain_gauge: 'Rain gauge',
  power_meter: 'Lighting power',
};

export const SERVICES = [
  { name: 'Detection API (FastAPI)', uptime30d: 99.93, latencyMs: 42 },
  { name: 'Event bus (MQTT)', uptime30d: 99.98, latencyMs: 8 },
  { name: 'Anonymised clip store', uptime30d: 99.9, latencyMs: 65 },
  { name: 'Contractor dispatch gateway', uptime30d: 99.71, latencyMs: 180 },
];

// Small bounded random walk so gauges move on each provider tick.
export function jitter(value: number, tick: number, seed: number, spread: number) {
  const wave = Math.sin((tick + seed * 7) / 3) * spread;
  return Math.round((value + wave) * 10) / 10;
}

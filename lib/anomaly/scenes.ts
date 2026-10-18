import type { ZoneType } from '@/lib/types';

// Fixed points of interest in each zone's rendered scene, in frame percentages.
// The scene renderer and the simulator share these so boxes land on the right object.
export type Rect = { x: number; y: number; w: number; h: number };

export type SceneLayout = {
  lamp: Rect;
  pipe: Rect;
  bin: Rect;
  ramp: Rect;
  ground: { yMin: number; yMax: number }; // band where pedestrians walk
  night: boolean;
};

export const SCENES: Record<ZoneType, SceneLayout> = {
  jogging_track: {
    lamp: { x: 74, y: 8, w: 10, h: 52 },
    pipe: { x: 8, y: 72, w: 22, h: 16 },
    bin: { x: 88, y: 58, w: 8, h: 16 },
    ramp: { x: 40, y: 70, w: 20, h: 18 },
    ground: { yMin: 52, yMax: 74 },
    night: true,
  },
  playground: {
    lamp: { x: 6, y: 10, w: 10, h: 52 },
    pipe: { x: 80, y: 74, w: 16, h: 14 },
    bin: { x: 86, y: 56, w: 8, h: 16 },
    ramp: { x: 40, y: 72, w: 20, h: 16 },
    ground: { yMin: 54, yMax: 76 },
    night: false,
  },
  bin_bay: {
    lamp: { x: 84, y: 6, w: 10, h: 46 },
    pipe: { x: 62, y: 40, w: 16, h: 44 },
    bin: { x: 20, y: 46, w: 34, h: 36 },
    ramp: { x: 2, y: 74, w: 16, h: 14 },
    ground: { yMin: 60, yMax: 80 },
    night: false,
  },
  main_gate: {
    lamp: { x: 8, y: 6, w: 10, h: 54 },
    pipe: { x: 26, y: 76, w: 16, h: 12 },
    bin: { x: 22, y: 58, w: 8, h: 16 },
    ramp: { x: 62, y: 62, w: 30, h: 28 },
    ground: { yMin: 56, yMax: 78 },
    night: true,
  },
  car_park: {
    lamp: { x: 50, y: 4, w: 10, h: 50 },
    pipe: { x: 84, y: 30, w: 12, h: 52 },
    bin: { x: 70, y: 58, w: 8, h: 16 },
    ramp: { x: 4, y: 60, w: 26, h: 30 },
    ground: { yMin: 58, yMax: 82 },
    night: true,
  },
  corridor: {
    lamp: { x: 42, y: 2, w: 16, h: 10 },
    pipe: { x: 4, y: 20, w: 10, h: 64 },
    bin: { x: 80, y: 60, w: 10, h: 18 },
    ramp: { x: 34, y: 80, w: 32, h: 12 },
    ground: { yMin: 48, yMax: 74 },
    night: false,
  },
};

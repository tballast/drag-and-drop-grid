import { Segment } from '../models/segment.model';
import { TOTAL_COLUMNS } from './grid.utils';

const POINTS_PER_COLUMN = 10;

export function generateSegmentData(duration: number, seed: number): number[] {
  const count = duration * POINTS_PER_COLUMN;
  const points: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const phase = seed * 1.7;
    const amplitude = 0.8;
    const freq = (2 + (seed % 3)) * Math.PI;
    const value = amplitude * Math.sin(freq * t + phase);
    points.push(value);
  }
  return points;
}

export const POINTS_PER_COL = POINTS_PER_COLUMN;

import { FRAME_HEIGHT } from "./character-model";

const WIDTH_RATIO = 0.5;
const CLEARANCE = 1.05;
// FRAME_HEIGHT is defined at 7 units, so a lone body frames the same as on a fixed camera.
const ORBIT_MARGIN = 7;

export type Placement = {
  x: number;
  z: number;
  angle: number;
  fraction: number;
};

// Neighbour chord is 2R·sin(π/n); solve for R so neighbours are CLEARANCE body-widths apart.
export function circleGroup(count: number, requestedFraction: number): { places: Placement[]; radius: number } {
  const fraction = requestedFraction;
  if (count <= 0) return { places: [], radius: 0 };
  if (count === 1) return { places: [{ x: 0, z: 0, angle: 0, fraction }], radius: 0 };

  const height = FRAME_HEIGHT * fraction;
  const bodyWidth = height * WIDTH_RATIO;
  const minChord = bodyWidth * CLEARANCE;
  const radius = minChord / (2 * Math.sin(Math.PI / count));

  const places = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, angle, fraction };
  });

  return { places, radius };
}

export function orbitDistance(radius: number): number {
  return radius + ORBIT_MARGIN;
}

export function groundY(floorFraction: number): number {
  return -FRAME_HEIGHT / 2 + FRAME_HEIGHT * floorFraction;
}

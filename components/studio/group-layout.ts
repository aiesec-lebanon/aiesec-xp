import { FRAME_HEIGHT } from "./character-model";

/** How wide a body is against its own height, arms included. */
const WIDTH_RATIO = 0.5;
/**
 * Gap between neighbours, as a multiple of the width they need. Tighter than
 * the old row layout's 1.16 -- a group asked to stand close together, not
 * spaced out (D-63).
 */
const CLEARANCE = 1.05;
/**
 * How far beyond the circle's own radius the orbiting camera stands. `7` is
 * the distance `FRAME_HEIGHT` itself is defined against (fov 42 at 7 units),
 * so a lone body on this circle frames exactly as it always has; a bigger
 * group's camera backs off from there by the circle's own radius.
 */
const ORBIT_MARGIN = 7;

export type Placement = {
  x: number;
  z: number;
  /** Radians from +Z, the same convention `facing` already uses. */
  angle: number;
  /** Share of the frame this body fills, the same for all of them. */
  fraction: number;
};

/**
 * Stands a group in a circle, all the same size, everyone equally far from
 * its centre.
 *
 * The previous layout staggered depth and shrank bodies to fit a *fixed*
 * camera (D-55) -- a stage a static viewer stands in front of. A circle is
 * the opposite: nobody has a "back row", everybody is close to everybody
 * else, and it only reads as a circle from a camera that moves around it,
 * which is what replaces the fixed one here (D-63).
 *
 * Spacing is solved from one requirement -- neighbours end up `CLEARANCE`
 * body-widths apart, measured as a straight chord across the circle, which is
 * also the true closest distance between two points on it (unlike the old
 * layout's perspective trick, there is no camera distance to fold in). For
 * `n` evenly spaced points the chord between neighbours is `2R·sin(π/n)`, so
 * solving that for `R` is the whole function.
 */
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

/** How far back the orbiting camera stands from a circle of this radius. */
export function orbitDistance(radius: number): number {
  return radius + ORBIT_MARGIN;
}

/** The world y every body in a group stands on. */
export function groundY(floorFraction: number): number {
  return -FRAME_HEIGHT / 2 + FRAME_HEIGHT * floorFraction;
}

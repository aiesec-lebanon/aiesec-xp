import { FRAME_HEIGHT } from "./character-model";

/** Where XpCanvas puts the camera, on z, looking at the origin. */
const CAMERA = 6;
/** How wide a body is against its own height, arms included. */
const WIDTH_RATIO = 0.5;
/** How much further from the camera each step out from the centre stands. */
const DEPTH_RATIO = 0.18;
/** Gap between neighbours, as a multiple of the width they need. */
const CLEARANCE = 1.16;

export type Placement = {
  x: number;
  z: number;
  /** Share of the frame this body fills, the same for all of them. */
  fraction: number;
};

/**
 * 0, -1, +1, -2, +2 ... so the best-placed member stands in the middle and the
 * group builds outwards evenly rather than growing off one shoulder.
 */
function slotOf(index: number): number {
  const step = Math.ceil(index / 2);
  return index % 2 === 1 ? -step : step;
}

/**
 * Stands a group on one floor, using distance rather than scale.
 *
 * Every body is the same size in the world; the ones further out stand further
 * back, so perspective does the shrinking. That is also why spacing cannot be a
 * constant: a body twice as far away covers half the screen width, so the world
 * gap has to grow with depth or the group closes up and the bodies intersect.
 *
 * The spacing is solved in projected units -- `x / distance` -- where each slot
 * is `k` apart and `k` is the widest overlap any neighbouring pair could have,
 * which is the pair nearest the camera. If the result is wider than the canvas,
 * the whole group shrinks until it fits instead of being clipped.
 */
export function placeGroup(
  count: number,
  viewportWidth: number,
  requestedFraction: number,
): Placement[] {
  const maxSlot = Math.floor(count / 2);
  // The frustum half-width at any distance d is (viewportWidth / 2) * d / CAMERA,
  // so in projected units everything has to sit inside this one number.
  const limit = viewportWidth / (2 * CAMERA);

  const solve = (height: number) => {
    const depth = height * DEPTH_RATIO;
    const halfWidth = (height * WIDTH_RATIO) / 2;
    // The nearest pair needs the most room, so sizing on it covers every pair.
    const step = halfWidth * (1 / CAMERA + 1 / (CAMERA + depth)) * CLEARANCE;
    const extent = maxSlot * step + halfWidth / (CAMERA + maxSlot * depth);
    return { depth, halfWidth, step, extent };
  };

  let height = FRAME_HEIGHT * requestedFraction;
  let solved = solve(height);
  // extent is near enough linear in height, so one correction lands it and the
  // second only tidies the rounding.
  for (let pass = 0; pass < 2 && solved.extent > limit; pass += 1) {
    height *= limit / solved.extent;
    solved = solve(height);
  }

  const fraction = height / FRAME_HEIGHT;
  return Array.from({ length: count }, (_, index) => {
    const slot = slotOf(index);
    const distance = CAMERA + Math.abs(slot) * solved.depth;
    return { x: slot * solved.step * distance, z: -Math.abs(slot) * solved.depth, fraction };
  });
}

/** The world y every body in a group stands on. */
export function groundY(floorFraction: number): number {
  return -FRAME_HEIGHT / 2 + FRAME_HEIGHT * floorFraction;
}

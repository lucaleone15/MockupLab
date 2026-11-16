/** Shared with the viewport (drops): floor / device picking at screen coordinates. */
export const picking = {
  /** Point on the vertical plane z = const under the pointer (objects sliding along a wall). */
  wall: null as null | ((clientX: number, clientY: number, z: number) => [number, number, number] | null),
  /** Point on the horizontal plane at height `y` (floor by default) under the pointer. */
  floor: null as null | ((clientX: number, clientY: number, y?: number) => [number, number, number] | null),
  item: null as null | ((clientX: number, clientY: number) => string | null),
};

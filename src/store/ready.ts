/** Settles once the autosaved project (and the imported 3D models) are back: the landing shows before that,
 * and what it starts (an example, a dropped capture) waits for it, or the restore would replace it. */
let settle!: () => void;
export const projectReady = new Promise<void>((resolve) => (settle = resolve));
export const markProjectReady = () => settle();

/**
 * Glass labels that follow a device of the 3D story: the page registers each
 * label's element under the device's key; the stage moves it every frame to
 * the device's place on screen (no React render, no layout read).
 */
export const anchors = new Map<string, Set<HTMLElement>>();

/** A ref callback for a label pinned above the device `key`. */
export const anchorTo = (key: string) => (el: HTMLElement | null) => {
  if (!el) return;
  let set = anchors.get(key);
  if (!set) anchors.set(key, (set = new Set()));
  set.add(el);
  return () => {
    set!.delete(el);
  };
};

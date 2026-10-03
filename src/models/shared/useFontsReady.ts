import { useEffect, useState } from 'react';

/** True once the UI font can be used to draw on canvases (toolbar, key legends…). */
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts
      .load('400 32px "Geist Variable"')
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

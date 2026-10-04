/*
 * Entry points of the video features; the encoders (Mediabunny, gifenc) load
 * only when a video is actually exported or previewed.
 */

export const exportVideo = () => import('./video').then((m) => m.exportVideo());
export const togglePreview = () => import('./video').then((m) => m.togglePreview());

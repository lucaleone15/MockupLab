import { createStore } from 'idb-keyval';

/** The app's IndexedDB store: projects index, projects, images, thumbnails, exports. */
export const db = createStore('mockuplab', 'kv');

/*
 * Build-time only, loaded by prerender.html from scripts/prerender.mjs: the landing rendered to an HTML string
 * with React's server renderer, so the browser can hydrate it later without repainting (the markup, ids
 * included, is exactly what hydration expects). `?path=/en/` picks the language.
 */
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';

declare global {
  interface Window {
    __prerender?: Promise<string>;
  }
}

const path = new URLSearchParams(location.search).get('path') ?? '/';
// the address decides the language: set it before the app's modules read it
history.replaceState(null, '', path);
window.__prerender = import('./app/App').then(({ App }) =>
  renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

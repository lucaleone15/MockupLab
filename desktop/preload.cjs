// The bridge the web app sees as window.mockuplabDesktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mockuplabDesktop', {
  platform: process.platform,
  version: process.env.npm_package_version || '',
  onUpdate: (cb) => ipcRenderer.on('mockuplab:update', (_e, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('mockuplab:install-update'),
});

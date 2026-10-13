// The bridge the web app sees as window.mockuplabDesktop.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mockuplabDesktop', {
  platform: process.platform,
  onUpdate: (cb) => {
    ipcRenderer.on('mockuplab:update', (_e, info) => cb(info));
    // an update found before the page was ready is sent again
    ipcRenderer.send('mockuplab:update-query');
  },
  installUpdate: () => ipcRenderer.send('mockuplab:install-update'),
});

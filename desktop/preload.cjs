// The only bridge between the game page and the desktop app: Google sign-in in the system browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fieldDesktop', {
  googleSignIn: {
    start: () => ipcRenderer.invoke('google-sign-in:start'),
    open: url => ipcRenderer.invoke('google-sign-in:open', String(url)),
    cancel: () => ipcRenderer.invoke('google-sign-in:cancel'),
  },
});

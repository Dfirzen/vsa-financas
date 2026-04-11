/**
 * Preload Script - Secure bridge between main and renderer processes.
 * Exposes a safe API via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (data) => ipcRenderer.invoke('save-config', data),

    // Metas
    getMetas: () => ipcRenderer.invoke('get-metas'),
    updateMeta: (id, data) => ipcRenderer.invoke('update-meta', id, data),
    createMeta: (data) => ipcRenderer.invoke('create-meta', data),
    deleteMeta: (id) => ipcRenderer.invoke('delete-meta', id),

    // Extrato
    getExtratoFile: () => ipcRenderer.invoke('get-extrato-file'),

    // Market Data
    getQuotes: (tickers, force) => ipcRenderer.invoke('get-quotes', tickers, force),
    getIndices: () => ipcRenderer.invoke('get-indices'),
    getMonthlyPrices: (tickers, period) => ipcRenderer.invoke('get-monthly-prices', tickers, period),

    // AI
    aiStatus: () => ipcRenderer.invoke('ai-status'),
    aiAnalyze: (data) => ipcRenderer.invoke('ai-analyze', data),
    aiChat: (data) => ipcRenderer.invoke('ai-chat', data),

    // Native dialogs
    selectFile: (options) => ipcRenderer.invoke('select-file', options)
});

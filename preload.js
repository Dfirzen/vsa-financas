/**
 * Preload Script - Secure bridge between main and renderer processes.
 * Exposes a safe API via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
    const listener = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('api', {
    customWindowFrame: process.platform === 'win32',
    windowAction: (action) => ipcRenderer.invoke('window:action', action),
    onWindowState: (callback) => subscribe('window:state', callback),
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (data) => ipcRenderer.invoke('save-config', data),

    // Metas
    getMetas: () => ipcRenderer.invoke('get-metas'),
    updateMeta: (id, data) => ipcRenderer.invoke('update-meta', id, data),
    createMeta: (data) => ipcRenderer.invoke('create-meta', data),
    deleteMeta: (id) => ipcRenderer.invoke('delete-meta', id),

    // Extrato
    getExtratoFiles: () => ipcRenderer.invoke('get-extrato-files'),

    // Market Data
    getQuotes: (tickers, force) => ipcRenderer.invoke('get-quotes', tickers, force),
    getQuoteStatus: (tickers) => ipcRenderer.invoke('get-quote-status', tickers),
    getIndices: (period, force) => ipcRenderer.invoke('get-indices', period, force),
    getMonthlyPrices: (tickers, period, force) => ipcRenderer.invoke('get-monthly-prices', tickers, period, force),
    getNextDividends: (tickers) => ipcRenderer.invoke('get-next-dividends', tickers),

    // AI
    aiStatus: () => ipcRenderer.invoke('ai-status'),
    aiAnalyze: (data) => ipcRenderer.invoke('ai-analyze', data),
    aiChat: (data) => ipcRenderer.invoke('ai-chat', data),

    // Strategy (persistent memory)
    getStrategy: () => ipcRenderer.invoke('get-strategy'),
    inferStrategy: (data) => ipcRenderer.invoke('infer-strategy', data),

    // Conversations (multi-chat history)
    getConversations: () => ipcRenderer.invoke('get-conversations'),
    getActiveConversation: () => ipcRenderer.invoke('get-active-conversation'),
    getConversationMessages: (id) => ipcRenderer.invoke('get-conversation-messages', id),
    createConversation: (title) => ipcRenderer.invoke('create-conversation', title),
    setActiveConversation: (id) => ipcRenderer.invoke('set-active-conversation', id),
    deleteConversation: (id) => ipcRenderer.invoke('delete-conversation', id),
    renameConversation: (id, title) => ipcRenderer.invoke('rename-conversation', id, title),

    // Native dialogs
    selectFile: (options) => ipcRenderer.invoke('select-file', options),
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Version & Changelog
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    readChangelog: () => ipcRenderer.invoke('read-changelog'),

    // Theme (nativeTheme)
    setThemeSource: (source) => ipcRenderer.invoke('set-theme-source', source),
    getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),

    // Auto Updater
    onUpdateAvailable: (callback) => subscribe('updater:update-available', callback),
    onDownloadProgress: (callback) => subscribe('updater:download-progress', callback),
    onUpdateDownloaded: (callback) => subscribe('updater:update-downloaded', callback),
    onUpdateNotAvailable: (callback) => subscribe('updater:update-not-available', callback),
    onUpdaterError: (callback) => subscribe('updater:error', callback),
    quitAndInstallUpdate: () => ipcRenderer.send('updater:quit-and-install'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check')
});

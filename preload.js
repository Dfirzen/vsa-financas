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

    // Version & Changelog
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    readChangelog: () => ipcRenderer.invoke('read-changelog'),

    // Theme (nativeTheme)
    setThemeSource: (source) => ipcRenderer.invoke('set-theme-source', source),
    getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),

    // Auto Updater
    onUpdateAvailable: (callback) => ipcRenderer.on('updater:update-available', callback),
    onDownloadProgress: (callback) => ipcRenderer.on('updater:download-progress', (event, percent) => callback(percent)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('updater:update-downloaded', callback),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('updater:update-not-available', callback),
    onUpdaterError: (callback) => ipcRenderer.on('updater:error', (event, message) => callback(message)),
    quitAndInstallUpdate: () => ipcRenderer.send('updater:quit-and-install'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check')
});


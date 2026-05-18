/**
 * Electron Main Process
 * Creates the native desktop window and initializes all backend services.
 */
const { app, BrowserWindow, Menu, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerIpcHandlers } = require('./src/ipc-handlers');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
}

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        icon: path.join(__dirname, 'Icone.png'),
        title: 'V S & A',
        backgroundColor: '#15191C', // Match app background for instant paint
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    // Remove default menu bar
    Menu.setApplicationMenu(null);

    // Load the renderer HTML
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Show window when content is ready (prevents white flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Register IPC handlers before window creation
app.whenReady().then(() => {
    registerIpcHandlers();

    // --- Version & Changelog IPC ---
    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('read-changelog', () => {
        try {
            const changelogPath = path.join(__dirname, 'CHANGELOG.md');
            if (fs.existsSync(changelogPath)) {
                return fs.readFileSync(changelogPath, 'utf-8');
            }
            return '# Changelog\n\nNenhum changelog disponível.';
        } catch (e) {
            return '# Changelog\n\nErro ao ler changelog.';
        }
    });

    // --- Theme Source IPC (nativeTheme) ---
    ipcMain.handle('set-theme-source', (_, source) => {
        nativeTheme.themeSource = source; // 'light', 'dark', 'system'
        return nativeTheme.shouldUseDarkColors;
    });

    ipcMain.handle('get-system-theme', () => {
        return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    });

    createWindow();
});

// Handle second instance (focus existing window)
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// Quit when all windows are closed (Windows behavior)
app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

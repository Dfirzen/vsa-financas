/**
 * IPC Handlers - Replaces Flask routes.
 * Each handler maps to a former API endpoint.
 */
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { configService } = require('./services/config-service');
const { marketDataService } = require('./services/market-data-service');
const { aiService } = require('./services/ai-service');

function getBasePath() {
    return path.dirname(__dirname); // project root
}

const DEFAULT_METAS = [
    {
        id: 'renda_mensal',
        title: 'Renda Passiva Mensal',
        icon: '💰',
        value_current: 0,
        value_target: 500,
        status: 'in_progress',
        type: 'currency'
    },
    {
        id: 'aporte_mensal',
        title: 'Aporte Mensal',
        icon: '📈',
        value_current: 0,
        value_target: 1000,
        status: 'in_progress',
        type: 'currency'
    },
    {
        id: 'aporte_anual',
        title: 'Aporte no Ano',
        icon: '📅',
        value_current: 0,
        value_target: 12000,
        status: 'in_progress',
        type: 'currency'
    },
    {
        id: 'patrimonio',
        title: 'Patrimônio Acumulado',
        icon: '🏦',
        value_current: 0,
        value_target: 100000,
        status: 'in_progress',
        type: 'currency'
    }
];

function getMetasPath() {
    const { app } = require('electron');
    const userDataPath = app ? app.getPath('userData') : path.join(require('os').homedir(), 'InvestAI');
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, 'metas.json');
}

function loadMetas() {
    const metasFile = getMetasPath();
    if (!fs.existsSync(metasFile)) {
        fs.writeFileSync(metasFile, JSON.stringify(DEFAULT_METAS, null, 4), 'utf-8');
        return [...DEFAULT_METAS];
    }
    try {
        const data = fs.readFileSync(metasFile, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Error loading metas: ${e}`);
        return [...DEFAULT_METAS];
    }
}

function saveMetas(metas) {
    const { app } = require('electron');
    const userDataPath = app ? app.getPath('userData') : path.join(require('os').homedir(), 'InvestAI');
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const metasFile = path.join(dataDir, 'metas.json');
    fs.writeFileSync(metasFile, JSON.stringify(metas, null, 4), 'utf-8');
}

// Initialize AI from saved config
function initAiFromConfig() {
    const cfg = configService.getConfig();
    if (cfg.is_configured && cfg.ai_api_key) {
        aiService.configure(
            cfg.ai_provider || 'gemini',
            cfg.ai_api_key || '',
            cfg.user_name || ''
        );
    }
}

function registerIpcHandlers() {
    // Initialize AI on startup
    initAiFromConfig();

    // ==========================================
    // CONFIG
    // ==========================================
    ipcMain.handle('get-config', () => {
        const cfg = configService.getConfig();
        const safeCfg = { ...cfg };
        if (safeCfg.ai_api_key) {
            const key = safeCfg.ai_api_key;
            safeCfg.ai_api_key_masked = key.length > 12
                ? key.substring(0, 8) + '...' + key.substring(key.length - 4)
                : '***';
            safeCfg.ai_api_key = ''; // Don't send full key
        }
        return safeCfg;
    });

    ipcMain.handle('save-config', async (_event, data) => {
        // If API key came empty, keep the previous one
        const currentCfg = configService.getConfig();
        if (!data.ai_api_key && currentCfg.ai_api_key) {
            data.ai_api_key = currentCfg.ai_api_key;
        }
        data.is_configured = true;

        const success = configService.saveConfig(data);

        if (success) {
            // Reconfigure AI service with new settings
            await aiService.configure(
                data.ai_provider || 'gemini',
                data.ai_api_key || '',
                data.user_name || ''
            );
        }

        return { status: success ? 'success' : 'error' };
    });

    // ==========================================
    // METAS
    // ==========================================
    ipcMain.handle('get-metas', () => {
        return loadMetas();
    });

    ipcMain.handle('update-meta', (_event, metaId, data) => {
        const metas = loadMetas();
        let updatedMeta = null;

        for (const meta of metas) {
            if (meta.id === metaId) {
                if (data.title !== undefined) meta.title = data.title;
                if (data.value_target !== undefined) meta.value_target = parseFloat(data.value_target);
                if (data.value_current !== undefined) meta.value_current = parseFloat(data.value_current);
                if (data.icon !== undefined) meta.icon = data.icon;
                updatedMeta = meta;
                break;
            }
        }

        // Auto-calculate annual if monthly is updated
        if (metaId === 'aporte_mensal' && data.value_target !== undefined) {
            for (const m of metas) {
                if (m.id === 'aporte_anual') {
                    m.value_target = parseFloat(data.value_target) * 12;
                }
            }
        }

        saveMetas(metas);
        return { status: 'success', meta: updatedMeta };
    });

    ipcMain.handle('create-meta', (_event, data) => {
        const metas = loadMetas();
        const newMeta = {
            id: data.id || `custom_${Date.now()}`,
            title: data.title || 'Nova Meta',
            icon: data.icon || '🎯',
            value_current: parseFloat(data.value_current || 0),
            value_target: parseFloat(data.value_target || 1000),
            status: 'in_progress',
            type: data.type || 'currency'
        };
        metas.push(newMeta);
        saveMetas(metas);
        return { status: 'success', meta: newMeta };
    });

    ipcMain.handle('delete-meta', (_event, metaId) => {
        let metas = loadMetas();
        metas = metas.filter(m => m.id !== metaId);
        saveMetas(metas);
        return { status: 'success' };
    });

    // ==========================================
    // EXTRATO FILE
    // ==========================================
    ipcMain.handle('get-extrato-file', () => {
        // Try configured path first
        const cfg = configService.getConfig();
        const configuredPath = cfg.excel_path || '';

        if (configuredPath && fs.existsSync(configuredPath)) {
            const buffer = fs.readFileSync(configuredPath);
            return buffer;
        }

        // Fallback: local file
        const excelPath = path.join(getBasePath(), 'Extrato.xlsx');
        if (fs.existsSync(excelPath)) {
            const buffer = fs.readFileSync(excelPath);
            return buffer;
        }

        return null;
    });

    // ==========================================
    // MARKET DATA
    // ==========================================
    ipcMain.handle('get-quotes', async (_event, tickers, forceRefresh) => {
        if (!tickers || tickers.length === 0) return {};
        return await marketDataService.getPrices(tickers, forceRefresh);
    });

    ipcMain.handle('get-indices', async () => {
        return await marketDataService.getIndicesHistory();
    });

    ipcMain.handle('get-monthly-prices', async (_event, tickers, period) => {
        if (!tickers || tickers.length === 0) return {};
        return await marketDataService.getMonthlyPrices(tickers, period || '2y');
    });

    // ==========================================
    // AI
    // ==========================================
    ipcMain.handle('ai-status', () => {
        return { configured: aiService.isConfigured() };
    });

    ipcMain.handle('ai-analyze', async (_event, data) => {
        return await aiService.analyzePortfolio(data || {});
    });

    ipcMain.handle('ai-chat', async (_event, data) => {
        const sessionId = data.session_id || 'default';
        const message = data.message || '';
        const portfolioData = data.portfolio_data || null;

        if (!message) {
            return { error: 'Message is required' };
        }

        return await aiService.chat(sessionId, message, portfolioData);
    });

    // ==========================================
    // NATIVE DIALOGS
    // ==========================================
    ipcMain.handle('select-file', async (_event, options) => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: options?.filters || [
                { name: 'Excel', extensions: ['xlsx', 'xls'] },
                { name: 'Todos', extensions: ['*'] }
            ]
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });
}

module.exports = { registerIpcHandlers };

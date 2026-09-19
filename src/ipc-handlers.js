/**
 * IPC Handlers - Replaces Flask routes.
 * Each handler maps to a former API endpoint.
 */
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { writeJson } = require('./services/json-store');
const GoalsCore = require('../renderer/goals-core');
const { configService } = require('./services/config-service');
const { marketDataService } = require('./services/market-data-service');
const { aiService } = require('./services/ai-service');
const { dividendsService } = require('./services/dividends-service');
const { strategyService } = require('./services/strategy-service');
const { conversationsService } = require('./services/conversations-service');

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
        value_target: 500,
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
        const defaults = DEFAULT_METAS.map(m => GoalsCore.normalize(m));
        writeJson(metasFile, defaults);
        return defaults;
    }
    try {
        const data = fs.readFileSync(metasFile, 'utf-8');
        const original = JSON.parse(data);
        if (!Array.isArray(original)) throw new Error('Formato inválido.');
        const normalized = original.map(m => GoalsCore.normalize(m));
        if (JSON.stringify(original) !== JSON.stringify(normalized)) {
            const backup = metasFile + '.before-redesign.json';
            if (!fs.existsSync(backup)) fs.copyFileSync(metasFile, backup);
            writeJson(metasFile, normalized);
        }
        return normalized;
    } catch (e) {
        console.error(`Error loading metas: ${e}`);
        throw new Error('Não foi possível ler as metas. O arquivo original foi preservado.');
    }
}

function saveMetas(metas) {
    const { app } = require('electron');
    const userDataPath = app ? app.getPath('userData') : path.join(require('os').homedir(), 'InvestAI');
    const dataDir = path.join(userDataPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const metasFile = path.join(dataDir, 'metas.json');
    writeJson(metasFile, metas);
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
    const trustedURL = pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
    const handle = (channel, callback) => ipcMain.handle(channel, (event, ...args) => {
        if (event.senderFrame?.url !== trustedURL || event.senderFrame !== event.sender.mainFrame) throw new Error('Origem IPC não autorizada.');
        return callback(event, ...args);
    });
    const validateMeta = data => {
        GoalsCore.validate(data || {});
        if (!data || typeof data !== 'object') throw new Error('Meta inválida.');
        if (data.title !== undefined && (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200)) throw new Error('Título inválido.');
        for (const field of ['value_target', 'value_current']) {
            if (data[field] !== undefined && (!Number.isFinite(Number(data[field])) || Number(data[field]) < 0 || (field === 'value_target' && Number(data[field]) === 0))) throw new Error('Valor da meta inválido.');
        }
        if (data.icon !== undefined && (typeof data.icon !== 'string' || data.icon.length > 20)) throw new Error('Ícone inválido.');
    };
    // Initialize AI on startup
    initAiFromConfig();

    // ==========================================
    // CONFIG
    // ==========================================
    handle('get-config', () => {
        const cfg = configService.getConfig();
        const safeCfg = { ...cfg };
        for (const field of ['ai_api_key', 'brapi_token']) {
            if (safeCfg[field]) safeCfg[`${field}_masked`] = '••••' + safeCfg[field].slice(-4);
            safeCfg[field] = '';
        }
        return safeCfg;
    });

    handle('save-config', async (_event, data) => {
        if (!data || typeof data !== 'object') throw new Error('Configuração inválida.');
        // If API key came empty, keep the previous one
        const currentCfg = configService.getConfig();
        if (!data.ai_api_key && currentCfg.ai_api_key) {
            data.ai_api_key = currentCfg.ai_api_key;
        }
        if (!data.brapi_token && currentCfg.brapi_token) data.brapi_token = currentCfg.brapi_token;
        data.is_configured = true;

        const success = configService.saveConfig(data);

        if (success) {
            // Reconfigure AI service with new settings
            await aiService.configure(
                configService.getConfig().ai_provider,
                configService.getConfig().ai_api_key,
                configService.getConfig().user_name
            );
        }

        return { status: success ? 'success' : 'error' };
    });

    // ==========================================
    // METAS
    // ==========================================
    handle('get-metas', () => {
        return loadMetas();
    });

    handle('update-meta', (_event, metaId, data) => {
        validateMeta(data);
        const metas = loadMetas();
        let updatedMeta = null;

        for (const meta of metas) {
            if (meta.id === metaId) {
                if (data.title !== undefined) meta.title = data.title;
                if (data.value_target !== undefined) meta.value_target = parseFloat(data.value_target);
                if (data.value_current !== undefined) meta.value_current = parseFloat(data.value_current);
                if (data.icon !== undefined) meta.icon = data.icon;
                GoalsCore.validate({...meta,...data});
                for (const key of ['kind','metric','year','start_month']) if (data[key] !== undefined) meta[key] = data[key];
                updatedMeta = meta;
                break;
            }
        }

        if (!updatedMeta) throw new Error('Meta não encontrada.');
        saveMetas(metas);
        return { status: 'success', meta: updatedMeta };
    });

    handle('create-meta', (_event, data) => {
        validateMeta(data);
        const metas = loadMetas();
        const newMeta = {
            id: `custom_${require('crypto').randomUUID()}`,
            title: data.title || 'Nova Meta',
            icon: data.icon || '🎯',
            value_current: parseFloat(data.value_current || 0),
            value_target: parseFloat(data.value_target || 1000),
            status: 'in_progress',
            type: data.type || 'currency'
        };
        Object.assign(newMeta, GoalsCore.normalize({...newMeta, ...Object.fromEntries(['kind','metric','year','start_month'].filter(k=>data[k]!==undefined).map(k=>[k,data[k]]))}));
        GoalsCore.validate(newMeta);
        metas.push(newMeta);
        saveMetas(metas);
        return { status: 'success', meta: newMeta };
    });

    handle('delete-meta', (_event, metaId) => {
        let metas = loadMetas();
        metas = metas.filter(m => m.id !== metaId);
        saveMetas(metas);
        return { status: 'success' };
    });

    // ==========================================
    // EXTRATO FILES
    // ==========================================
    handle('get-extrato-files', () => {
        const cfg = configService.getConfig();
        const folderPath = cfg.excel_folder_path || '';

        if (!folderPath) return [];
        if (!fs.existsSync(folderPath)) throw new Error('A pasta de extratos configurada não foi encontrada.');

        try {
            const stat = fs.statSync(folderPath);
            if (!stat.isDirectory()) {
                throw new Error('O caminho configurado não é uma pasta.');
            }

            const files = fs.readdirSync(folderPath);
            const excelFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return !file.startsWith('~$') && (ext === '.xlsx' || ext === '.xls');
            });

            const result = [];
            for (const file of excelFiles) {
                const filePath = path.join(folderPath, file);
                try {
                    const buffer = fs.readFileSync(filePath);
                    result.push({
                        fileName: file,
                        buffer: buffer
                    });
                } catch (err) {
                    throw new Error('Não foi possível ler um dos extratos. Confira acesso aos arquivos da pasta B3.');
                }
            }
            return result;
        } catch (e) {
            throw new Error('Não foi possível ler a pasta de extratos. Confira o caminho e as permissões dos arquivos.');
        }
    });

    // ==========================================
    // MARKET DATA
    // ==========================================
    handle('get-quotes', async (_event, tickers, forceRefresh) => {
        if (!tickers || tickers.length === 0) return {};
        return await marketDataService.getPrices(tickers, forceRefresh);
    });

    handle('get-indices', async (_event, period, force) => {
        return await marketDataService.getIndicesHistory(period || '2y', !!force);
    });

    handle('get-quote-status', (_event, tickers) => {
        return marketDataService.getQuoteStatus(tickers);
    });

    handle('get-monthly-prices', async (_event, tickers, period, force) => {
        if (!tickers || tickers.length === 0) return {};
        return await marketDataService.getMonthlyPrices(tickers, period || '2y', !!force);
    });

    handle('get-next-dividends', async (_event, tickers) => {
        if (!tickers || tickers.length === 0) return {};
        try {
            return await dividendsService.getNextPaymentDates(tickers);
        } catch (e) {
            console.error('[IPC] get-next-dividends error:', e.message);
            return {};
        }
    });

    // ==========================================
    // AI
    // ==========================================
    handle('ai-status', () => {
        return { configured: aiService.isConfigured() };
    });

    handle('ai-analyze', async (_event, data) => {
        const strategyText = strategyService.getCurrentStrategySummary();
        return await aiService.analyzePortfolio(data || {}, strategyText);
    });

    handle('ai-chat', async (_event, data) => {
        const sessionId = data.session_id || 'default';
        const message = data.message || '';
        const portfolioData = data.portfolio_data || null;
        const conversationId = data.conversation_id || null;

        if (!message) {
            return { error: 'Message is required' };
        }
        if (typeof message !== 'string' || message.length > 30000) throw new Error('Mensagem inválida ou muito longa.');
        if (conversationId && !conversationsService.getAllConversations().some(c => c.id === conversationId)) throw new Error('Conversa não encontrada.');
        if (conversationId) aiService.restoreSession(sessionId, conversationsService.getMessages(conversationId), portfolioData, strategyService.getCurrentStrategySummary());

        // Persist user message
        if (conversationId) {
            conversationsService.appendMessage(conversationId, 'user', message);
        }

        const strategyText = strategyService.getCurrentStrategySummary();
        const result = await aiService.chat(sessionId, message, portfolioData, strategyText);

        // Persist bot response
        if (conversationId && result.response) {
            conversationsService.appendMessage(conversationId, 'bot', result.response);
        }

        return result;
    });

    // ==========================================
    // STRATEGY
    // ==========================================
    handle('get-strategy', () => {
        return strategyService.loadStrategy();
    });

    handle('infer-strategy', async (_event, data) => {
        const portfolioData = data.portfolio_data || {};
        const metas = data.metas || [];

        // Only re-infer if portfolio has changed
        if (!strategyService.needsReInference(portfolioData, metas)) {
            const existing = strategyService.loadStrategy();
            return { strategy: existing.current.summary, cached: true };
        }

        const result = await aiService.inferStrategy(portfolioData);
        if (result.strategy) {
            const hash = strategyService.getPortfolioHash(portfolioData, metas);
            strategyService.saveStrategy({
                summary: result.strategy,
                portfolioHash: hash,
                portfolioData,
                metas
            });
        }
        return result;
    });

    // ==========================================
    // CONVERSATIONS
    // ==========================================
    handle('get-conversations', () => {
        return conversationsService.getAllConversations();
    });

    handle('get-active-conversation', () => {
        return conversationsService.getOrCreateActiveConversation();
    });

    handle('get-conversation-messages', (_event, conversationId) => {
        return conversationsService.getMessages(conversationId);
    });

    handle('create-conversation', (_event, title) => {
        return conversationsService.createConversation(title || null);
    });

    handle('set-active-conversation', (_event, conversationId) => {
        return conversationsService.setActiveConversation(conversationId);
    });

    handle('delete-conversation', (_event, conversationId) => {
        return conversationsService.deleteConversation(conversationId);
    });

    handle('rename-conversation', (_event, conversationId, newTitle) => {
        return conversationsService.renameConversation(conversationId, newTitle);
    });

    // ==========================================
    // NATIVE DIALOGS
    // ==========================================
    handle('select-file', async (_event, options) => {
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

    handle('select-folder', async (_event) => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });
}

module.exports = { registerIpcHandlers };

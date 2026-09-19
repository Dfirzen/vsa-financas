const fs = require('fs');
const path = require('path');
const {writeJson} = require('./json-store');

class ConfigService {
    constructor() {
        this.config = null;
        this.configFile = null;
        this.defaultConfig = {is_configured: false, user_name: '', excel_folder_path: '', ai_provider: 'openai', ai_api_key: '', brapi_token: '', asset_class_overrides: {}};
    }
    _load() {
        if (this.config) return;
        const {app, safeStorage} = require('electron');
        this.configFile = path.join(app.getPath('userData'), 'data', 'config.json');
        let stored = {};
        if (fs.existsSync(this.configFile)) stored = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        const parsed = {...this.defaultConfig, ...stored};
        if (parsed.excel_path && !parsed.excel_folder_path) parsed.excel_folder_path = path.dirname(parsed.excel_path);
        delete parsed.excel_path;
        for (const field of ['ai_api_key', 'brapi_token']) {
            if (stored[`${field}_encrypted`]) {
                if (!safeStorage.isEncryptionAvailable()) throw new Error('A proteção de credenciais do Windows está indisponível.');
                parsed[field] = safeStorage.decryptString(Buffer.from(stored[`${field}_encrypted`], 'base64'));
            }
            delete parsed[`${field}_encrypted`];
        }
        if ((stored.ai_api_key || stored.brapi_token || stored.excel_path) && safeStorage.isEncryptionAvailable()) this._persist(parsed);
        this.config = parsed;
    }
    _persist(config) {
        const {safeStorage} = require('electron');
        const stored = {...config};
        for (const field of ['ai_api_key', 'brapi_token']) {
            if (stored[field]) {
                if (!safeStorage.isEncryptionAvailable()) throw new Error('Não foi possível proteger a chave. As configurações anteriores foram preservadas.');
                stored[`${field}_encrypted`] = safeStorage.encryptString(stored[field]).toString('base64');
            }
            delete stored[field];
        }
        writeJson(this.configFile, stored);
    }
    getConfig() { this._load(); return structuredClone(this.config); }
    saveConfig(data) {
        this._load();
        const next = {...this.config};
        for (const field of Object.keys(this.defaultConfig)) if (data[field] !== undefined) next[field] = data[field];
        if (!['openai', 'gemini', 'anthropic'].includes(next.ai_provider)) throw new Error('Provedor de IA inválido.');
        for (const field of ['user_name', 'excel_folder_path', 'ai_api_key', 'brapi_token']) {
            if (typeof next[field] !== 'string' || next[field].length > 4096) throw new Error(`Configuração inválida: ${field}`);
        }
        const overrides = next.asset_class_overrides;
        if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || Object.entries(overrides).some(([ticker, c]) => !/^[A-Z0-9.\-]{1,20}$/.test(ticker) || !['FIIs', 'Ações', 'ETFs', 'Tesouro Direto'].includes(c))) throw new Error('Classificação de ativos inválida.');
        this._persist(next);
        this.config = next;
        return true;
    }
}
const configService = new ConfigService();
module.exports = {configService, ConfigService};

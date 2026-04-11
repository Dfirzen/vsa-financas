/**
 * Config Service - Port of config_service.py
 * Manages application configuration stored in data/config.json
 */
const fs = require('fs');
const path = require('path');

class ConfigService {
    constructor() {
        const { app } = require('electron');
        this.basePath = app ? app.getPath('userData') : path.join(require('os').homedir(), 'InvestAI');
        this.configDir = path.join(this.basePath, 'data');
        this.configFile = path.join(this.configDir, 'config.json');

        this.defaultConfig = {
            is_configured: false,
            user_name: '',
            excel_path: '',
            ai_provider: 'gemini',
            ai_api_key: ''
        };

        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }

        this.config = this._load();
    }

    _load() {
        if (!fs.existsSync(this.configFile)) {
            return { ...this.defaultConfig };
        }

        try {
            const data = fs.readFileSync(this.configFile, 'utf-8');
            const parsed = JSON.parse(data);
            // Merge with default config to ensure all keys exist
            return { ...this.defaultConfig, ...parsed };
        } catch (e) {
            console.error(`Error loading config.json: ${e}`);
            return { ...this.defaultConfig };
        }
    }

    getConfig() {
        return { ...this.config };
    }

    saveConfig(newConfig) {
        this.config = {
            ...this.config,
            is_configured: newConfig.is_configured ?? true,
            user_name: newConfig.user_name ?? this.config.user_name,
            excel_path: newConfig.excel_path ?? this.config.excel_path,
            ai_provider: newConfig.ai_provider ?? this.config.ai_provider,
            ai_api_key: newConfig.ai_api_key ?? this.config.ai_api_key
        };

        try {
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 4), 'utf-8');
            return true;
        } catch (e) {
            console.error(`Error saving config.json: ${e}`);
            return false;
        }
    }
}

// Singleton
const configService = new ConfigService();
module.exports = { configService };

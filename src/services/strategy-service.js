/**
 * Strategy Service
 * Manages persistent strategic memory for the VSA bot.
 * - Infers the user's investment strategy via AI
 * - Persists strategy locally with versioning
 * - Only re-infers when the portfolio has materially changed (hash comparison)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StrategyService {
    constructor() {
        this._dataDir = null;
        this._strategyFile = null;
    }

    _initPaths() {
        if (this._dataDir) return;
        try {
            const { app } = require('electron');
            const userDataPath = app.getPath('userData');
            this._dataDir = path.join(userDataPath, 'data');
        } catch (_) {
            this._dataDir = path.join(require('os').homedir(), 'VSA', 'data');
        }
        if (!fs.existsSync(this._dataDir)) {
            fs.mkdirSync(this._dataDir, { recursive: true });
        }
        this._strategyFile = path.join(this._dataDir, 'strategy.json');
    }

    /**
     * Creates a deterministic hash of the portfolio state to detect changes.
     * Only hashes the meaningful parts: ticker quantities and goal targets.
     */
    _buildPortfolioHash(portfolioData, metas) {
        const fingerprint = {
            ativos: {},
            metas: {}
        };

        if (portfolioData && portfolioData.categories) {
            for (const [cat, catData] of Object.entries(portfolioData.categories)) {
                fingerprint.ativos[cat] = {};
                const ativos = catData.ativos || {};
                for (const [ticker, info] of Object.entries(ativos)) {
                    if ((info.quant || 0) > 0) {
                        fingerprint.ativos[cat][ticker] = Math.round(info.quant || 0);
                    }
                }
            }
        }

        if (Array.isArray(metas)) {
            for (const m of metas) {
                fingerprint.metas[m.id] = {
                    target: m.value_target,
                    current: Math.floor(m.value_current || 0)
                };
            }
        }

        return crypto
            .createHash('sha256')
            .update(JSON.stringify(fingerprint))
            .digest('hex')
            .substring(0, 12);
    }

    /**
     * Load the current strategy from disk.
     * Returns null if no strategy has been inferred yet.
     */
    loadStrategy() {
        this._initPaths();
        if (!fs.existsSync(this._strategyFile)) return null;
        try {
            const raw = fs.readFileSync(this._strategyFile, 'utf-8');
            return JSON.parse(raw);
        } catch (e) {
            console.error('[StrategyService] Error reading strategy.json:', e.message);
            return null;
        }
    }

    /**
     * Save a new strategy entry, archiving the previous one (history, max 10).
     */
    saveStrategy({ summary, portfolioHash, portfolioData, metas }) {
        this._initPaths();
        const existing = this.loadStrategy() || {};
        const history = existing.history || [];

        // Archive current if it exists
        if (existing.current) {
            history.unshift(existing.current);
            if (history.length > 10) history.pop();
        }

        const newCurrent = {
            summary,
            inferred_at: new Date().toISOString(),
            portfolio_hash: portfolioHash,
            version: (history.length + 1)
        };

        const toWrite = { current: newCurrent, history };
        fs.writeFileSync(this._strategyFile, JSON.stringify(toWrite, null, 2), 'utf-8');
        return newCurrent;
    }

    /**
     * Returns true if the portfolio has changed since the last inference.
     * Used to decide whether to call the AI again.
     */
    needsReInference(portfolioData, metas) {
        const newHash = this._buildPortfolioHash(portfolioData, metas);
        const stored = this.loadStrategy();
        if (!stored || !stored.current) return true;
        return stored.current.portfolio_hash !== newHash;
    }

    /**
     * Returns the current hash for the given portfolio state.
     */
    getPortfolioHash(portfolioData, metas) {
        return this._buildPortfolioHash(portfolioData, metas);
    }

    /**
     * Returns the existing strategy summary (or empty string if none).
     */
    getCurrentStrategySummary() {
        const stored = this.loadStrategy();
        if (!stored || !stored.current) return '';
        return stored.current.summary || '';
    }

    getStrategyHistory() {
        const stored = this.loadStrategy();
        if (!stored) return [];
        return stored.history || [];
    }

    /**
     * Check which metas have been newly completed vs the last saved state.
     * Returns array of completed meta objects.
     */
    checkCompletedGoals(metas) {
        if (!Array.isArray(metas)) return [];
        return metas.filter(m => {
            const pct = m.value_target > 0 ? (m.value_current / m.value_target) * 100 : 0;
            return pct >= 100;
        });
    }
}

const strategyService = new StrategyService();
module.exports = { strategyService };

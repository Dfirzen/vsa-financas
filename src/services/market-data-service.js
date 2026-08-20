/**
 * Market Data Service - Port of market_data_service.py
 * Fetches stock prices, indices, and monthly price history.
 * Uses yahoo-finance2 instead of yfinance, and node-fetch for BCB API.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { configService } = require('./config-service');

class MarketDataService {
    constructor() {
        const { app } = require('electron');
        this.basePath = app ? app.getPath('userData') : path.join(require('os').homedir(), 'InvestAI');
        this.cacheDir = path.join(this.basePath, 'data');
        this.cacheFile = path.join(this.cacheDir, 'quotes_cache.json');

        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        this.cache = this._loadCache();
        this._yahooFinance = null;
    }

    // --- HELPER: Control Rate Limit ---
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _executeWithRetry(apiCallFn, ticker, maxRetries = 2) {
        let retries = 0;
        while (retries < maxRetries) {
            try {
                return await apiCallFn();
            } catch (error) {
                if (retries < maxRetries - 1) {
                    retries++;
                    await this._delay(1000);
                } else {
                    console.warn(`[API] Falha final ao buscar ${ticker}: ${error.message}`);
                    throw error;
                }
            }
        }
        return null;
    }

    _ensureSuffix(ticker) {
        if (ticker.endsWith('.SA') || ticker.startsWith('^') || ticker.includes('-')) return ticker;
        return `${ticker}.SA`;
    }

    async _getYahooFinance() {
        if (!this._yahooFinance) {
            const yf = await import('yahoo-finance2');
            const YFClass = yf.default || yf;
            this._yahooFinance = typeof YFClass === 'function' ? new YFClass() : YFClass;
            // Suppress validation log noise
            try {
                this._yahooFinance.suppressNotices(['yahooSurvey', 'cookie']); // Add cookie warnings to suppression
            } catch (e) { /* ignore */ }
        }
        return this._yahooFinance;
    }

    _loadCache() {
        if (!fs.existsSync(this.cacheFile)) {
            return {};
        }
        try {
            const data = fs.readFileSync(this.cacheFile, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Error loading cache: ${e}`);
            return {};
        }
    }

    _saveCache() {
        try {
            fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 4), 'utf-8');
        } catch (e) {
            console.error(`Error saving cache: ${e}`);
        }
    }

    /**
     * Get current prices for a list of tickers via brapi.dev API.
     * Fetches each ticker individually in parallel (respecting free-tier 1-ticker limit).
     * Falls back to cache on error or when token is not configured.
     */
    async getPrices(tickers, forceRefresh = false) {
        const results = {};
        const toFetch = [];

        for (const ticker of tickers) {
            const cached = this.cache[ticker];
            if (cached && !forceRefresh) {
                if (Date.now() / 1000 - (cached.timestamp || 0) < 900) {
                    results[ticker] = cached.price;
                    continue;
                }
            }
            toFetch.push(ticker);
        }

        if (toFetch.length === 0) return results;

        const token = configService.getConfig().brapi_token || '';

        if (!token) {
            console.warn('[Brapi] Token não configurado, usando cache.');
            for (const ticker of toFetch) {
                if (this.cache[ticker]) results[ticker] = this.cache[ticker].price;
            }
            return results;
        }

        const fetchPromises = toFetch.map(async (ticker) => {
            const cleanTicker = ticker.replace('.SA', '').trim();
            const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}?token=${token}`;

            try {
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 8000
                });

                const json = await res.json();

                if (json.error || json.message) {
                    console.warn(`[Brapi] Falha ao buscar cotação de ${ticker}: ${json.message || json.error}`);
                    if (this.cache[ticker]) {
                        results[ticker] = this.cache[ticker].price;
                    }
                    return;
                }

                const item = json.results && json.results[0];
                if (item && typeof item.regularMarketPrice === 'number') {
                    const price = item.regularMarketPrice;
                    results[ticker] = price;
                    this.cache[ticker] = {
                        price,
                        timestamp: Date.now() / 1000
                    };
                } else if (this.cache[ticker]) {
                    results[ticker] = this.cache[ticker].price;
                }
            } catch (e) {
                console.warn(`[Brapi] Erro de rede ao buscar cotação de ${ticker}: ${e.message}`);
                if (this.cache[ticker]) {
                    results[ticker] = this.cache[ticker].price;
                }
            }
        });

        await Promise.all(fetchPromises);
        this._saveCache();
        return results;
    }

    // ========== ÍNDICES DE MERCADO ==========

    async getIndicesHistory() {
        const cacheKey = '__indices_history__';
        const cached = this.cache[cacheKey];
        if (cached && Date.now() / 1000 - (cached.timestamp || 0) < 86400) {
            return cached.data;
        }

        const result = {};

        // CDI from BCB (series 4390)
        result['CDI'] = await this._fetchBcbSeries(4390);

        // IPCA from BCB (series 433)
        result['IPCA'] = await this._fetchBcbSeries(433);

        // B3 indices via Stooq (free, no API key needed)
        const stooqIndices = {
            'IBOV': '^bvsp',
            'IFIX': 'ifix.in',
            'IVVB11': 'ivvb11.sa',
            'SMLL': 'smal11.sa',
            'IDIV': 'divo11.sa'
        };

        for (const [name, ticker] of Object.entries(stooqIndices)) {
            result[name] = await this._fetchStooqMonthlyReturns(ticker);
        }

        // Cache result
        this.cache[cacheKey] = { data: result, timestamp: Date.now() / 1000 };
        this._saveCache();

        return result;
    }

    async _fetchBcbSeries(seriesCode) {
        try {
            const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=01/01/2024`;
            const resp = await fetch(url, { timeout: 15000 });
            if (resp.ok) {
                const data = await resp.json();
                const result = {};
                for (const item of data) {
                    const parts = item.data.split('/');
                    const key = `${parts[2]}-${parts[1]}`;
                    result[key] = parseFloat(item.valor);
                }
                return result;
            }
        } catch (e) {
            console.error(`Error fetching BCB series ${seriesCode}: ${e.message}`);
        }
        return {};
    }

    /**
     * Fetch monthly returns via Stooq CSV (free, no key, supports B3 tickers).
     * URL: https://stooq.com/q/d/l/?s=petr4.sa&i=m
     */
    async _fetchStooqMonthlyReturns(symbol) {
        try {
            const url = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}&i=m`;
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            if (!resp.ok) return {};

            const csv = await resp.text();
            const lines = csv.trim().split('\n');
            if (lines.length < 2) return {};

            const monthlyCloses = {};
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 5) continue;
                const dateStr = cols[0]; // YYYY-MM-DD
                const closeVal = parseFloat(cols[4]);
                if (!isNaN(closeVal) && dateStr) {
                    const key = dateStr.substring(0, 7); // YYYY-MM
                    monthlyCloses[key] = closeVal;
                }
            }

            const sortedMonths = Object.keys(monthlyCloses).sort();
            const returns = {};
            for (let i = 1; i < sortedMonths.length; i++) {
                const prev = monthlyCloses[sortedMonths[i - 1]];
                const curr = monthlyCloses[sortedMonths[i]];
                if (prev > 0) {
                    const pct = ((curr / prev) - 1) * 100;
                    returns[sortedMonths[i]] = Math.round(pct * 10000) / 10000;
                }
            }
            return returns;
        } catch (e) {
            console.warn(`[Stooq] Failed to fetch benchmark ${symbol}: ${e.message}`);
            return {};
        }
    }

    // ========== PREÇOS MENSAIS HISTÓRICOS ==========

    async getMonthlyPrices(tickers, period = '2y') {
        const results = {};
        const toFetch = [];

        for (const ticker of tickers) {
            const cacheKey = `__monthly_${ticker}__`;
            const cached = this.cache[cacheKey];
            if (cached && Date.now() / 1000 - (cached.timestamp || 0) < 86400) {
                results[ticker] = cached.prices;
            } else {
                toFetch.push(ticker);
            }
        }

        // Parallel fetch via Stooq (free historical CSV)
        const fetchPromises = toFetch.map(async (ticker) => {
            const cleanTicker = ticker.replace('.SA', '').toLowerCase();
            const symbol = `${cleanTicker}.sa`;
            try {
                const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;
                const resp = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const csv = await resp.text();
                const lines = csv.trim().split('\n');
                if (lines.length < 2) throw new Error('Empty CSV');

                const prices = {};
                const years = parseInt(period) || 2;
                const cutoff = new Date();
                cutoff.setFullYear(cutoff.getFullYear() - years);

                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length < 5) continue;
                    const dateStr = cols[0]; // YYYY-MM-DD
                    const closeVal = parseFloat(cols[4]);
                    const dateObj = new Date(dateStr);
                    if (!isNaN(closeVal) && dateObj >= cutoff) {
                        const key = dateStr.substring(0, 7); // YYYY-MM
                        prices[key] = Math.round(closeVal * 100) / 100;
                    }
                }

                results[ticker] = prices;
                this.cache[`__monthly_${ticker}__`] = {
                    prices,
                    timestamp: Date.now() / 1000
                };
            } catch (e) {
                console.warn(`[Stooq] Failed monthly prices for ${ticker}: ${e.message}`);
                const cacheKey = `__monthly_${ticker}__`;
                if (this.cache[cacheKey]) {
                    results[ticker] = this.cache[cacheKey].prices;
                }
            }
        });

        await Promise.all(fetchPromises);

        if (toFetch.length > 0) {
            this._saveCache();
        }

        return results;
    }
}

// Singleton
const marketDataService = new MarketDataService();
module.exports = { marketDataService };



/**
 * Market Data Service - Port of market_data_service.py
 * Fetches stock prices, indices, and monthly price history.
 * Uses yahoo-finance2 instead of yfinance, and node-fetch for BCB API.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

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

    async _getYahooFinance() {
        if (!this._yahooFinance) {
            const yf = await import('yahoo-finance2');
            const YFClass = yf.default || yf;
            this._yahooFinance = typeof YFClass === 'function' ? new YFClass() : YFClass;
            // Suppress validation log noise
            try {
                this._yahooFinance.suppressNotices(['yahooSurvey']);
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
     * Get current prices for a list of tickers.
     * @param {string[]} tickers - e.g. ['PETR4', 'MXRF11']
     * @param {boolean} forceRefresh
     * @returns {Object} { 'PETR4': 35.50, ... }
     */
    async getPrices(tickers, forceRefresh = false) {
        const yahooFinance = await this._getYahooFinance();
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

        for (const ticker of toFetch) {
            const symbol = ticker.endsWith('.SA') ? ticker : `${ticker}.SA`;
            try {
                const quote = await yahooFinance.quote(symbol);
                if (quote && quote.regularMarketPrice) {
                    const currentPrice = quote.regularMarketPrice;
                    results[ticker] = currentPrice;
                    this.cache[ticker] = {
                        price: currentPrice,
                        timestamp: Date.now() / 1000
                    };
                } else if (this.cache[ticker]) {
                    results[ticker] = this.cache[ticker].price;
                }
            } catch (e) {
                console.error(`MarketDataService Error fetching ${ticker}: ${e.message}`);
                if (this.cache[ticker]) {
                    results[ticker] = this.cache[ticker].price;
                }
            }
        }

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

        // B3 indices via yahoo-finance2
        const yfIndices = {
            'IBOV': '^BVSP',
            'IFIX': 'IFIX.SA',
            'SMLL': 'SMAL11.SA',
            'IDIV': 'DIVO11.SA',
            'IVVB11': 'IVVB11.SA'
        };

        for (const [name, ticker] of Object.entries(yfIndices)) {
            result[name] = await this._fetchYfMonthlyReturns(ticker);
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

    async _fetchYfMonthlyReturns(ticker) {
        try {
            const yahooFinance = await this._getYahooFinance();
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 2);

            const result = await yahooFinance.chart(ticker, {
                period1: startDate,
                period2: endDate,
                interval: '1d'
            });

            if (result && result.quotes && result.quotes.length > 0) {
                // Build monthly close prices
                const monthlyCloses = {};
                for (const quote of result.quotes) {
                    if (quote.close && quote.date) {
                        const d = new Date(quote.date);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        monthlyCloses[key] = quote.close;
                    }
                }

                // Calculate monthly returns
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
            }
        } catch (e) {
            console.error(`Error fetching yfinance ${ticker}: ${e.message}`);
        }
        return {};
    }

    // ========== PREÇOS MENSAIS HISTÓRICOS ==========

    async getMonthlyPrices(tickers, period = '2y') {
        const yahooFinance = await this._getYahooFinance();
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

        for (const ticker of toFetch) {
            const symbol = ticker.endsWith('.SA') ? ticker : `${ticker}.SA`;
            try {
                const endDate = new Date();
                const startDate = new Date();
                const years = parseInt(period) || 2;
                startDate.setFullYear(startDate.getFullYear() - years);

                const result = await yahooFinance.chart(symbol, {
                    period1: startDate,
                    period2: endDate,
                    interval: '1d'
                });

                if (result && result.quotes && result.quotes.length > 0) {
                    const prices = {};
                    for (const quote of result.quotes) {
                        if (quote.close && quote.date) {
                            const d = new Date(quote.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            prices[key] = Math.round(quote.close * 100) / 100;
                        }
                    }
                    results[ticker] = prices;
                    this.cache[`__monthly_${ticker}__`] = {
                        prices,
                        timestamp: Date.now() / 1000
                    };
                }
            } catch (e) {
                console.error(`Error fetching monthly history for ${ticker}: ${e.message}`);
            }
        }

        if (toFetch.length > 0) {
            this._saveCache();
        }

        return results;
    }
}

// Singleton
const marketDataService = new MarketDataService();
module.exports = { marketDataService };

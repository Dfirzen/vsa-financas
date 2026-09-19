const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const {writeJson} = require('./json-store');
const {configService} = require('./config-service');
const {monthlyClosesFromChart, monthlyReturnsFromCloses} = require('./market-series');
const QUOTE_TTL = 30 * 60 * 1000;
const HISTORY_TTL = 24 * 60 * 60 * 1000;
const validSeries = value => value && Object.keys(value).length > 0 && Object.values(value).every(Number.isFinite);

class MarketDataService {
    constructor(options = {}) {
        const app = options.basePath ? null : require('electron').app;
        this.basePath = options.basePath || (app ? app.getPath('userData') : path.join(require('os').homedir(), 'InvestAI'));
        this.cacheFile = path.join(this.basePath, 'data', 'quotes_cache.json');
        this.fetch = options.fetch || fetch;
        this.getConfig = options.getConfig || (() => configService.getConfig());
        this.now = options.now || Date.now;
        this.sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
        this.requestInterval = options.requestInterval ?? 350;
        this.cache = this._loadCache();
        this.quoteErrors = new Map();
        this.inFlight = new Map();
        this.brapiQueue = Promise.resolve();
        this.historyQueue = Promise.resolve();
        this.lastBrapiRequest = 0;
        this.brapiBlockedUntil = 0;
    }
    _loadCache() {
        try { return JSON.parse(fs.readFileSync(this.cacheFile, 'utf8')); }
        catch { return {}; }
    }
    _saveCache() {
        try { writeJson(this.cacheFile, this.cache); }
        catch (error) { console.warn('[Cotações] Não foi possível salvar o cache:', error.message); }
    }
    _singleFlight(key, job) {
        if (this.inFlight.has(key)) return this.inFlight.get(key);
        const promise = Promise.resolve().then(job).finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, promise);
        return promise;
    }
    _enqueue(queue, job) {
        const next = this[queue].then(job);
        this[queue] = next.catch(() => {});
        return next;
    }
    _fresh(entry, ttl) { return !!entry && this.now() - entry.timestamp * 1000 < ttl; }
    _tickers(tickers) {
        if (!Array.isArray(tickers) || tickers.length > 1000) throw new Error('Lista de ativos inválida.');
        return [...new Set(tickers.map(t => String(t).trim().toUpperCase()).filter(Boolean))];
    }
    getQuoteStatus(tickers) {
        return Object.fromEntries(this._tickers(tickers).map(ticker => {
            const cached = this.cache[ticker], error = this.quoteErrors.get(ticker);
            return [ticker, {
                timestamp: cached?.timestamp || null,
                stale: !this._fresh(cached, QUOTE_TTL),
                refreshFailed: !!error,
                error: error || null,
                available: Number.isFinite(cached?.price)
            }];
        }));
    }
    async _requestBrapi(ticker) {
        const token = this.getConfig().brapi_token;
        if (!token) throw new Error('Token da Brapi não configurado.');
        if (this.now() < this.brapiBlockedUntil) throw new Error('Brapi limitou temporariamente as chamadas; tente novamente mais tarde.');
        const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker.replace(/\.SA$/i, ''))}?token=${encodeURIComponent(token)}`;
        for (let attempt = 0; attempt < 3; attempt++) {
            const wait = Math.max(0, this.requestInterval - (this.now() - this.lastBrapiRequest));
            if (wait) await this.sleep(wait);
            this.lastBrapiRequest = this.now();
            let response;
            try { response = await this.fetch(url, {timeout: 10000, headers: {'User-Agent': 'VSA/5.2'}}); }
            catch {
                if (attempt < 2) { await this.sleep(1000 * 2 ** attempt); continue; }
                throw new Error('Sem conexão com a Brapi.');
            }
            if (response.status === 429 || response.status >= 500) {
                response.body?.resume?.();
                const retryAfter = response.headers?.get('retry-after');
                const retryMs = retryAfter ? (/^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - this.now()) : 1000 * 2 ** attempt;
                const delay = Number.isFinite(retryMs) ? Math.max(0, retryMs) : 1000 * 2 ** attempt;
                if (attempt < 2 && delay <= 30000) { await this.sleep(delay); continue; }
                if (response.status === 429) this.brapiBlockedUntil = this.now() + Math.max(delay, 30000);
                throw new Error(response.status === 429 ? 'Limite temporário da Brapi atingido.' : 'Brapi temporariamente indisponível.');
            }
            if (!response.ok) throw new Error([401, 403].includes(response.status) ? 'Brapi recusou o acesso: confira token, plano e cota.' : `Brapi retornou HTTP ${response.status}.`);
            let json;
            try { json = await response.json(); }
            catch { throw new Error('Brapi retornou uma resposta inválida.'); }
            const item = json.results?.[0];
            if (json.error || !Number.isFinite(item?.regularMarketPrice) || item.regularMarketPrice < 0) throw new Error('Brapi não retornou uma cotação válida para este ativo.');
            return {price: item.regularMarketPrice, marketTime: item.regularMarketTime || null};
        }
    }
    async _stockPrice(ticker, forceRefresh) {
        const entry = this.cache[ticker];
        if (!forceRefresh && this._fresh(entry, QUOTE_TTL) && Number.isFinite(entry.price)) return entry.price;
        return this._singleFlight('quote:' + ticker, () => this._enqueue('brapiQueue', async () => {
            try {
                const quote = await this._requestBrapi(ticker);
                this.cache[ticker] = {...quote, timestamp: this.now() / 1000, source: 'Brapi'};
                this.quoteErrors.delete(ticker);
                this._saveCache();
                return quote.price;
            } catch (error) {
                this.quoteErrors.set(ticker, error.message);
                console.warn(`[Brapi] ${ticker}: ${error.message} ${this.cache[ticker] ? 'Mantida a última cotação disponível.' : ''}`);
                return this.cache[ticker]?.price;
            }
        }));
    }
    async _cryptoPrice(ticker, forceRefresh) {
        if (!forceRefresh && this._fresh(this.cache[ticker], QUOTE_TTL)) return this.cache[ticker].price;
        return this._singleFlight('quote:' + ticker, async () => {
            try {
                const clean = ticker.replace(/-?BRL$/, '');
                const response = await this.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(clean + 'BRL')}`, {timeout: 8000});
                if (!response.ok) throw new Error();
                const price = Number((await response.json()).price);
                if (!Number.isFinite(price) || price <= 0) throw new Error();
                this.cache[ticker] = {price, timestamp: this.now() / 1000, source: 'Binance'};
                this.quoteErrors.delete(ticker); this._saveCache();
                return price;
            } catch {
                this.quoteErrors.set(ticker, 'Não foi possível atualizar a cotação da criptomoeda.');
                return this.cache[ticker]?.price;
            }
        });
    }
    async getPrices(tickers, forceRefresh = false) {
        const symbols = this._tickers(tickers);
        const crypto = new Set(['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX', 'DOT', 'LINK']);
        const results = await Promise.all(symbols.map(async ticker => {
            const price = crypto.has(ticker) || /-BRL$/.test(ticker) ? await this._cryptoPrice(ticker, forceRefresh) : await this._stockPrice(ticker, forceRefresh);
            return [ticker, price];
        }));
        return Object.fromEntries(results.filter(([, price]) => Number.isFinite(price)));
    }
    _periodYears(period) {
        const years = Number(String(period).replace(/y$/, ''));
        if (!Number.isInteger(years) || years < 1 || years > 60) throw new Error('Período histórico inválido.');
        return years;
    }
    async _yahooMonthlyPrices(symbol, period) {
        return this._singleFlight(`history:${symbol}:${period}`, () => this._enqueue('historyQueue', async () => {
            const years = this._periodYears(period);
            const from = Math.floor(Date.UTC(new Date(this.now()).getUTCFullYear() - years, 0, 1) / 1000);
            const query = new URLSearchParams({period1: String(from), period2: String(Math.floor(this.now() / 1000)), interval: '1d', events: 'history', includeAdjustedClose: 'false'});
            const response = await this.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`, {timeout: 15000});
            if (!response.ok) throw new Error(`Histórico indisponível (HTTP ${response.status}).`);
            return monthlyClosesFromChart(await response.json());
        }));
    }
    async getMonthlyPrices(tickers, period = '2y', forceRefresh = false) {
        this._periodYears(period);
        const pairs = await Promise.all(this._tickers(tickers).map(ticker => this._singleFlight(`monthly:${ticker}:${period}`, async () => {
            const key = `__monthly_v2_${ticker}_${period}__`;
            const cached = this.cache[key];
            if (!forceRefresh && this._fresh(cached, HISTORY_TTL) && validSeries(cached.prices)) return [ticker, cached.prices];
            try {
                const prices = await this._yahooMonthlyPrices(ticker.endsWith('.SA') || ticker.startsWith('^') ? ticker : ticker + '.SA', period);
                this.cache[key] = {prices, timestamp: this.now() / 1000, source: 'Yahoo Finance'};
                this._saveCache();
                return [ticker, prices];
            } catch (error) {
                console.warn(`[Histórico] ${ticker}: ${error.message}`);
                // Empty legacy caches must never suppress a new request.
                const fallback = cached?.prices || this.cache[`__monthly_${ticker}_${period}__`]?.prices || this.cache[`__monthly_${ticker}__`]?.prices;
                return [ticker, validSeries(fallback) ? fallback : {}];
            }
        })));
        return Object.fromEntries(pairs);
    }
    async _bcbSeries(code, period) {
        const year = new Date(this.now()).getUTCFullYear() - this._periodYears(period);
        const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=01/01/${year}`;
        const response = await this.fetch(url, {timeout: 15000});
        if (!response.ok) throw new Error(`Banco Central retornou HTTP ${response.status}.`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Série do Banco Central inválida.');
        const values = {};
        for (const item of data) {
            const parts = String(item.data).split('/'), value = Number(item.valor);
            if (parts.length === 3 && Number.isFinite(value)) values[`${parts[2]}-${parts[1]}`] = value;
        }
        if (!validSeries(values)) throw new Error('Banco Central não retornou observações.');
        return values;
    }
    async getIndicesHistory(period = '2y', forceRefresh = false) {
        this._periodYears(period);
        return this._singleFlight('indices:' + period, async () => {
            const sources = {CDI: () => this._bcbSeries(4390, period), IPCA: () => this._bcbSeries(433, period), IBOV: async () => monthlyReturnsFromCloses(await this._yahooMonthlyPrices('^BVSP', period))};
            const pairs = await Promise.all(Object.entries(sources).map(async ([name, request]) => {
                const key = `__index_v2_${name}_${period}__`, cached = this.cache[key];
                if (!forceRefresh && this._fresh(cached, HISTORY_TTL) && validSeries(cached.data)) return [name, cached.data];
                try {
                    const data = await request();
                    if (!validSeries(data)) throw new Error('Série sem observações válidas.');
                    this.cache[key] = {data, timestamp: this.now() / 1000};
                    this._saveCache();
                    return [name, data];
                } catch (error) {
                    console.warn(`[Índices] ${name}: ${error.message}`);
                    const fallback = cached?.data || this.cache.__indices_history__?.data?.[name];
                    return [name, validSeries(fallback) ? fallback : {}];
                }
            }));
            // Preserve supplementary cached series without blocking the three
            // main benchmarks on the availability of other providers.
            const legacy = this.cache.__indices_history__?.data || {};
            return {...Object.fromEntries(Object.entries(legacy).filter(([k, v]) => !['CDI','IPCA','IBOV'].includes(k) && validSeries(v))), ...Object.fromEntries(pairs)};
        });
    }
}
let singleton;
module.exports = {MarketDataService, get marketDataService() { return singleton ||= new MarketDataService(); }};

/**
 * Dividends Service
 * Fetches the next scheduled dividend payment date for FII tickers
 * from Status Invest (https://statusinvest.com.br).
 *
 * Uses Status Invest's public AJAX endpoint that returns dividend history JSON,
 * from which we extract the first future (or most recent announced) payment date.
 *
 * - Cache is persisted locally and refreshed at most once per day.
 * - All errors are swallowed — never blocks the UI.
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const CACHE_TTL_SECONDS = 86400; // 24 hours
const REQUEST_TIMEOUT_MS = 10000;

class DividendsService {
    constructor() {
        const { app } = require('electron');
        const basePath = app
            ? app.getPath('userData')
            : path.join(require('os').homedir(), 'InvestAI');

        this.cacheDir = path.join(basePath, 'data');
        this.cacheFile = path.join(this.cacheDir, 'next_dividends_cache.json');

        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        this._cache = this._loadCache();
    }

    // ── Cache helpers ──────────────────────────────────────────────────────────

    _loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                return JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
            }
        } catch (e) {
            console.warn('[DividendsService] Could not load cache:', e.message);
        }
        return {};
    }

    _saveCache() {
        try {
            fs.writeFileSync(this.cacheFile, JSON.stringify(this._cache, null, 2), 'utf-8');
        } catch (e) {
            console.warn('[DividendsService] Could not save cache:', e.message);
        }
    }

    _isFresh(entry) {
        return entry && (Date.now() / 1000 - (entry.timestamp || 0)) < CACHE_TTL_SECONDS;
    }

    // ── Status Invest scraper ──────────────────────────────────────────────────

    /**
     * Fetch the next dividend payment date for a single FII ticker.
     * Uses Status Invest's dividend history endpoint and picks the nearest future date.
     * Returns a string "DD/MM" or null if unavailable.
     */
    async _fetchNextPaymentDate(ticker) {
        const cleanTicker = ticker.replace(/\.SA$/i, '').toUpperCase();

        // Status Invest has a public endpoint for FII dividends history.
        // It returns JSON with fields including "pd" (payment date) in format "DD/MM/YYYY HH:mm"
        const url = `https://statusinvest.com.br/fundo-imobiliario/payoutresult?code=${cleanTicker}&type=2&futureData=false`;

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Referer': `https://statusinvest.com.br/fundos-imobiliarios/${cleanTicker.toLowerCase()}`,
            'X-Requested-With': 'XMLHttpRequest',
        };

        try {
            // Strategy 1: Try the JSON API endpoint
            const result = await this._tryStatusInvestAPI(cleanTicker, headers);
            if (result) return result;

            // Strategy 2: Scrape the HTML page directly
            const htmlResult = await this._scrapeStatusInvestPage(cleanTicker, headers);
            return htmlResult;

        } catch (e) {
            console.warn(`[DividendsService] Fetch error for ${cleanTicker}:`, e.message);
            return null;
        }
    }

    /**
     * Try Status Invest's dividend history API endpoint.
     * Returns "DD/MM" for the next upcoming payment or null.
     */
    async _tryStatusInvestAPI(ticker, headers) {
        const endpoints = [
            `https://statusinvest.com.br/fundo-imobiliario/payoutresult?code=${ticker}&type=2&futureData=true`,
            `https://statusinvest.com.br/fundo-imobiliario/payoutresult?code=${ticker}&type=2`,
        ];

        for (const url of endpoints) {
            try {
                const res = await fetch(url, { headers, timeout: REQUEST_TIMEOUT_MS });
                if (!res.ok) continue;
                const text = await res.text();
                if (!text || text.trim().startsWith('<')) continue;

                const data = JSON.parse(text);
                const entries = Array.isArray(data) ? data : (data.assetEarningsModels || []);
                if (!entries || entries.length === 0) continue;

                const result = this._bestPaymentDateFromEntries(entries, ticker, 'API');
                if (result) return result;
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    /**
     * Scrape the Status Invest HTML page for the next payment date.
     *
     * Status Invest embeds dividend data as JSON inside a hidden input:
     *   <input id="results" type="hidden" value="[{&quot;pd&quot;:&quot;14/04/2026&quot;,...}]">
     * where:
     *   pd = data de pagamento (the payment date we want)
     *   ed = data base / ex-dividend date
     *
     * This is the most reliable extraction method.
     */
    async _scrapeStatusInvestPage(ticker, headers) {
        const url = `https://statusinvest.com.br/fundos-imobiliarios/${ticker.toLowerCase()}`;

        try {
            const res = await fetch(url, {
                headers: {
                    ...headers,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: REQUEST_TIMEOUT_MS,
            });

            if (!res.ok) return null;
            const html = await res.text();

            // ── Strategy 1: Parse the hidden <input id="results"> JSON ──────────
            // Status Invest embeds dividend history as HTML-entity-encoded JSON.
            // Example:  value="[{&quot;ed&quot;:&quot;31/03/2026&quot;,&quot;pd&quot;:&quot;14/04/2026&quot;,...}]"
            const inputMatch = html.match(/id="results"[^>]*value="([^"]+)"/);
            if (inputMatch) {
                try {
                    // Decode HTML entities (&quot; → ", &#xNN; → char, etc.)
                    const decoded = inputMatch[1]
                        .replace(/&quot;/g, '"')
                        .replace(/&#x27;/g, "'")
                        .replace(/&amp;/g, '&')
                        .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

                    const entries = JSON.parse(decoded);
                    if (Array.isArray(entries) && entries.length > 0) {
                        const result = this._bestPaymentDateFromEntries(entries, ticker, 'input#results');
                        if (result) return result;
                    }
                } catch (e) {
                    console.warn(`[DividendsService] ${ticker}: could not parse input#results:`, e.message);
                }
            }

            // ── Strategy 2: Look for "Data Pagamento" label + nearby date in HTML ─
            // Status Invest renders two cards: last payment and next payment.
            // The second "Data Pagamento" label corresponds to the upcoming one.
            const pagSlices = [];
            const pagRe = /Data Pagamento/gi;
            let pm;
            while ((pm = pagRe.exec(html)) !== null) {
                pagSlices.push(html.slice(pm.index, pm.index + 400));
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const cutoff = new Date(today);
            cutoff.setDate(cutoff.getDate() - 7); // allow up to 7 days in the past

            for (const slice of pagSlices) {
                const dm = slice.match(/(\d{2}\/\d{2}\/\d{4})/);
                if (dm) {
                    const parsed = this._parseDateString(dm[1]);
                    if (parsed && parsed >= cutoff) {
                        const dd = String(parsed.getDate()).padStart(2, '0');
                        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                        console.log(`[DividendsService] ${ticker}: found ${dd}/${mm} via "Data Pagamento" label`);
                        return `${dd}/${mm}`;
                    }
                }
            }

            return null;
        } catch (e) {
            console.warn(`[DividendsService] HTML scrape error for ${ticker}:`, e.message);
            return null;
        }
    }

    /**
     * From an array of dividend entries (Status Invest format),
     * pick the best "next payment date" (pd field).
     * Prefers the earliest upcoming date; falls back to the most recent within 7 days.
     */
    _bestPaymentDateFromEntries(entries, ticker, source) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 7);

        const upcoming = [];
        const recent = [];

        for (const entry of entries) {
            // Status Invest uses "pd" for payment date
            const rawDate = entry.pd || entry.paymentDate || entry.dt_pagamento || entry.datapagamento;
            if (!rawDate) continue;
            const parsed = this._parseDateString(rawDate);
            if (!parsed) continue;

            if (parsed >= today) {
                upcoming.push(parsed);
            } else if (parsed >= cutoff) {
                recent.push(parsed);
            }
        }

        if (upcoming.length > 0) {
            upcoming.sort((a, b) => a - b);
            const d = upcoming[0];
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            console.log(`[DividendsService] ${ticker}: next payment ${dd}/${mm} (via ${source})`);
            return `${dd}/${mm}`;
        }

        if (recent.length > 0) {
            recent.sort((a, b) => b - a);
            const d = recent[0];
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            console.log(`[DividendsService] ${ticker}: recent payment ${dd}/${mm} (via ${source})`);
            return `${dd}/${mm}`;
        }

        return null;
    }

    /**
     * Recursively search an object for payment date fields.
     */
    _findPaymentDateInObject(obj, depth = 0) {
        if (depth > 8 || !obj || typeof obj !== 'object') return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 7);

        const paymentKeys = ['pd', 'paymentDate', 'payment_date', 'datapagamento', 'dt_pagamento',
                             'nextPayment', 'nextPaymentDate', 'proximo_pagamento'];

        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string' && paymentKeys.some(k => key.toLowerCase().includes(k.toLowerCase().slice(0, 4)))) {
                const parsed = this._parseDateString(val);
                if (parsed && parsed >= cutoff) {
                    const dd = String(parsed.getDate()).padStart(2, '0');
                    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                    return `${dd}/${mm}`;
                }
            }
            if (typeof val === 'object' && val !== null) {
                const found = this._findPaymentDateInObject(val, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Parse various date string formats into a Date object.
     * Handles: "DD/MM/YYYY", "DD/MM/YYYY HH:mm", "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss"
     */
    _parseDateString(str) {
        if (!str || typeof str !== 'string') return null;
        str = str.trim();

        // DD/MM/YYYY or DD/MM/YYYY HH:mm
        const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (brMatch) {
            const d = new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
            if (!isNaN(d.getTime())) return d;
        }

        // YYYY-MM-DD or ISO
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
            if (!isNaN(d.getTime())) return d;
        }

        return null;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Get next dividend payment dates for a list of FII tickers.
     * Returns: { MXRF11: "15/05", KNCR11: "14/04", HGLG11: null, ... }
     *
     * Always non-blocking — stale cache is returned on errors.
     */
    async getNextPaymentDates(tickers) {
        if (!tickers || tickers.length === 0) return {};

        const results = {};
        const toFetch = [];

        // Check cache first
        for (const ticker of tickers) {
            const key = ticker.replace(/\.SA$/i, '').toUpperCase();
            const cached = this._cache[key];
            if (this._isFresh(cached)) {
                results[key] = cached.value;
                console.log(`[DividendsService] ${key}: cache hit → ${cached.value}`);
            } else {
                toFetch.push(key);
            }
        }

        if (toFetch.length === 0) return results;

        console.log(`[DividendsService] Fetching ${toFetch.length} tickers from Status Invest: ${toFetch.join(', ')}`);

        // Fetch sequentially to avoid rate limiting (Status Invest is stricter)
        for (const ticker of toFetch) {
            try {
                const value = await this._fetchNextPaymentDate(ticker);
                results[ticker] = value;
                this._cache[ticker] = { value, timestamp: Date.now() / 1000 };
                console.log(`[DividendsService] ${ticker}: fetched → ${value}`);
            } catch (e) {
                console.warn(`[DividendsService] Skipping ${ticker}:`, e.message);
                results[ticker] = this._cache[ticker]?.value ?? null;
            }

            // Polite delay between requests
            await new Promise(r => setTimeout(r, 400));
        }

        this._saveCache();
        return results;
    }
}

// Singleton
const dividendsService = new DividendsService();
module.exports = { dividendsService };

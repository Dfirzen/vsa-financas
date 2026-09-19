/* Pure B3 accounting helpers, shared by the renderer and node:test. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PortfolioCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const columns = ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'];
    const text = value => String(value ?? '').trim();
    const normalized = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    function number(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
        let s = text(value).replace(/R\$|\s/g, '');
        if (!s || s === '-') return NaN;
        if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
        return Number(s);
    }
    function date(value) {
        let d;
        if (value instanceof Date) d = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
        else if (typeof value === 'number') d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
        else {
            const s = text(value);
            const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
            if (!br && !iso) return null;
            const [y, m, day] = br ? [+br[3], +br[2], +br[1]] : [+iso[1], +iso[2], +iso[3]];
            d = new Date(Date.UTC(y, m - 1, day));
            if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== day) return null;
        }
        return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
    }
    function sheetRows(rows) {
        const index = rows.findIndex(r => r && r.some(c => text(c) === 'Produto') && r.some(c => text(c) === 'Movimentação'));
        if (index < 0) throw new Error('A planilha não contém o cabeçalho de movimentações da B3.');
        const headers = rows[index].map(text);
        for (const name of ['Data', 'Movimentação', 'Produto', 'Quantidade', 'Valor da Operação']) {
            if (!headers.includes(name)) throw new Error(`Coluna obrigatória ausente: ${name}`);
        }
        return rows.slice(index + 1).filter(r => r && r.some(v => text(v))).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
    }
    // Keep repeated trades within one extract. Across overlapping extracts use the
    // maximum occurrence count, not a Set that would silently delete real trades.
    function mergeExtracts(extracts) {
        const counts = new Map();
        const merged = [];
        for (const rows of extracts) {
            const local = new Map();
            for (const row of rows) {
                const key = JSON.stringify(columns.map(c => c === 'Data' ? date(row[c]) || text(row[c]) :
                    ['Quantidade', 'Preço unitário', 'Valor da Operação'].includes(c) ? (Number.isFinite(number(row[c])) ? number(row[c]) : text(row[c])) : normalized(row[c])));
                const count = (local.get(key) || 0) + 1;
                local.set(key, count);
                if (count > (counts.get(key) || 0)) merged.push(row);
            }
            for (const [key, count] of local) counts.set(key, Math.max(count, counts.get(key) || 0));
        }
        return [columns, ...merged.map(row => columns.map(c => c === 'Data' && date(row[c]) ? date(row[c]).split('-').reverse().join('/') : row[c]))];
    }
    function movement(row) {
        const m = normalized(row['Movimentação']);
        const direction = normalized(row['Entrada/Saída']);
        const out = /SAIDA|DEBITO/.test(direction);
        const incoming = /ENTRADA|CREDITO/.test(direction);
        if (/DIVIDENDO|JUROS|RENDIMENTO|AMORTIZACAO/.test(m)) return out ? 'income-reversal' : 'income';
        if (/TRANSFERENCIA.*LIQUIDACAO/.test(m)) return out ? 'sell' : incoming ? 'buy' : 'unknown';
        if (/VENDA|RESGATE/.test(m)) return 'sell';
        if (/COMPRA|APLICACAO|SUBSCRICAO/.test(m)) return out ? 'unknown' : 'buy';
        return 'unknown';
    }
    function account(rows, classifyAsset, classifyTicker, year = 'Todos') {
        const categories = Object.fromEntries(['FIIs', 'Ações', 'ETFs', 'Tesouro Direto'].map(c => [c, {total: 0, ativos: Object.create(null), specialAtivos: Object.create(null)}]));
        const warnings = [], investTransactions = [], yieldTransactions = [], allYields = [];
        const monthlyInvestments = {}, monthlyYields = {}, years = new Set();
        let realizedGain = 0, invalidHistory = false;
        const parsed = sheetRows(rows).map((row, i) => ({row, i, iso: date(row.Data)})).sort((a, b) => (a.iso || '').localeCompare(b.iso || '') || a.i - b.i);
        function addMonth(map, tx, value) {
            const m = map[tx.monthKey] ||= {label: `${tx.monthStr}/${tx.yearKey.slice(-2)}`, total: 0};
            m.total += value; m[tx.assetClass] = (m[tx.assetClass] || 0) + value;
        }
        for (const {row, iso} of parsed) {
            const product = text(row.Produto);
            if (!product) continue;
            if (!iso) { warnings.push(`Data inválida: ${product}`); invalidHistory = true; continue; }
            const y = iso.slice(0, 4); years.add(y);
            if (year !== 'Todos' && y > year) continue;
            // A fractional-market trade is ownership of the same ordinary share.
            const ticker = product.split(' - ')[0].trim().toUpperCase().replace(/^([A-Z]{4}\d{1,2})F$/, '$1');
            const assetClass = classifyAsset(product, ticker);
            if (!categories[assetClass]) { warnings.push(`Classe inválida: ${ticker}`); invalidHistory = true; continue; }
            const type = movement(row), q = number(row.Quantidade), rawValue = number(row['Valor da Operação']);
            const value = Number.isFinite(rawValue) ? Math.abs(rawValue) : Math.abs(q * number(row['Preço unitário']));
            const tx = {ticker, assetClass, dateStr: iso.split('-').reverse().join('/'), sortDate: iso.replace(/-/g, ''), monthKey: iso.slice(0, 7).replace('-', ''), yearKey: y, monthStr: iso.slice(5, 7), quant: q, type};
            if (type === 'unknown' || !Number.isFinite(value) || ((type === 'buy' || type === 'sell') && !(q > 0))) {
                warnings.push(`${tx.dateStr} · ${ticker}: ${text(row.Movimentação)} requer conferência.`); invalidHistory = true; continue;
            }
            if (type.startsWith('income')) {
                const income = {...tx, type: text(row.Movimentação), valTotal: type === 'income-reversal' ? -value : value};
                allYields.push(income);
                if (year === 'Todos' || y === year) { yieldTransactions.push(income); addMonth(monthlyYields, income, income.valTotal); }
                continue;
            }
            const special = classifyTicker(ticker);
            const cat = categories[assetClass];
            const assets = special.type === 'normal' ? cat.ativos : cat.specialAtivos;
            const a = assets[ticker] ||= {quant: 0, totalVal: 0, investedVal: 0, realizedGain: 0, costKnown: true, type: special.type, typeLabel: special.label, expiration: ''};
            if (type === 'buy') { a.quant += q; a.investedVal += value; }
            else {
                if (q > a.quant + 1e-8) { warnings.push(`${ticker}: venda superior à posição conhecida; importe o histórico anterior.`); a.costKnown = false; invalidHistory = true; }
                const cost = a.quant > 0 ? a.investedVal / a.quant * Math.min(q, a.quant) : 0;
                a.realizedGain += value - cost;
                if (special.type === 'normal' && (year === 'Todos' || y === year)) realizedGain += value - cost;
                a.investedVal = Math.max(0, a.investedVal - cost);
                a.quant -= q;
                if (Math.abs(a.quant) < 1e-8) { a.quant = 0; a.investedVal = 0; }
            }
            a.totalVal = a.investedVal;
            a.avgPrice = a.quant > 0 && a.costKnown ? a.investedVal / a.quant : 0;
            if (special.type !== 'normal') continue;
            tx.quant = type === 'sell' ? -q : q; tx.value = type === 'sell' ? -value : value;
            investTransactions.push(tx);
            if (year === 'Todos' || y === year) addMonth(monthlyInvestments, tx, tx.value);
        }
        for (const cat of Object.values(categories)) cat.investedTotal = cat.total = Object.values(cat.ativos).reduce((s, a) => s + a.investedVal, 0);
        return {categories, investTransactions, yieldTransactions, allYields, monthlyInvestments, monthlyYields, years: [...years].sort().reverse(), realizedGain, invalidHistory, warnings: [...new Set(warnings)], totalCost: Object.values(categories).reduce((s, c) => s + c.total, 0), income: yieldTransactions.reduce((s, t) => s + t.valTotal, 0)};
    }
    // Monthly Modified Dietz approximation for invested securities (cash is not
    // available in the B3 movement extract). Never substitute today's price for history.
    // NaN explicitly means unavailable and must propagate through cumulative returns.
    function monthlyReturns(transactions, prices, yields = [], endDate = new Date(), audit = null) {
        const txs = [...transactions].sort((a, b) => a.sortDate.localeCompare(b.sortDate));
        if (!txs.length) return {};
        const end = date(endDate), lastMonth = end.slice(0, 7).replace('-', '');
        let key = txs[0].monthKey;
        const holdings = Object.create(null), result = {};
        function valuation(month) {
            let value = 0;
            for (const [ticker, q] of Object.entries(holdings)) {
                if (q < -1e-8) return NaN;
                if (q <= 1e-8) continue;
                const p = prices[ticker]?.[month];
                if (!Number.isFinite(p) || p < 0) return NaN;
                value += q * p;
            }
            return value;
        }
        while (key <= lastMonth) {
            const year = +key.slice(0, 4), month = +key.slice(4), label = `${key.slice(0, 4)}-${key.slice(4)}`;
            const prev = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 7);
            const start = valuation(prev);
            const trades = txs.filter(t => t.monthKey === key);
            const income = yields.filter(t => t.monthKey === key && txs.some(x => x.ticker === t.ticker));
            for (const t of trades) holdings[t.ticker] = (holdings[t.ticker] || 0) + t.quant;
            const finish = valuation(label);
            let days = key === lastMonth ? +end.slice(8) : new Date(Date.UTC(year, month, 0)).getUTCDate();
            // A fully liquidated period ends at its last flow, before idle cash days.
            if (Object.values(holdings).every(q => Math.abs(q) < 1e-8) && trades.length) days = Math.max(...trades.map(t => +t.sortDate.slice(6)), ...income.map(t => +t.sortDate.slice(6)));
            const flows = [...trades.map(t => ({day: +t.sortDate.slice(6), value: t.value})), ...income.map(t => ({day: +t.sortDate.slice(6), value: -t.valTotal}))];
            const net = flows.reduce((s, f) => s + f.value, 0);
            const weighted = flows.reduce((s, f) => s + f.value * ((days - f.day) / days), 0);
            let denom = start + weighted;
            // Initial contributions are valued at the start of the first active day.
            if (start === 0 && trades.length && trades[0].type === 'buy') {
                const firstDay = Math.min(...trades.map(t => +t.sortDate.slice(6)));
                denom = days === firstDay ? trades.filter(t => t.type === 'buy').reduce((sum, t) => sum + t.value, 0) :
                    flows.reduce((s, f) => s + f.value * ((days - f.day) / (days - firstDay)), 0);
            }
            result[label] = Number.isFinite(start) && Number.isFinite(finish) && denom > 1e-8 ? (finish - start - net) / denom * 100 :
                (start === 0 && finish === 0 && flows.length === 0 ? 0 : NaN);
            if (audit) audit[label] = {
                openingValue: start, closingValue: finish,
                purchases: trades.filter(t => t.value > 0).reduce((s, t) => s + t.value, 0),
                sales: -trades.filter(t => t.value < 0).reduce((s, t) => s + t.value, 0),
                income: income.reduce((s, t) => s + t.valTotal, 0),
                result: finish - start - net, weightedCapital: denom, monthlyReturn: result[label]
            };
            const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
            key = next.replace('-', '');
        }
        return result;
    }
    return {columns, number, date, sheetRows, mergeExtracts, movement, account, monthlyReturns};
});

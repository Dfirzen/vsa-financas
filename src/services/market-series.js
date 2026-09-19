// Shared parsing rules: missing observations never become zero returns.
function monthlyClosesFromChart(payload) {
    const result = payload?.chart?.result?.[0];
    if (payload?.chart?.error || !Array.isArray(result?.timestamp)) throw new Error('Histórico não disponível para este ativo.');
    const closes = result.indicators?.quote?.[0]?.close || [];
    const observations = result.timestamp.map((stamp, i) => ({stamp, close: closes[i]})).sort((a, b) => a.stamp - b.stamp);
    const prices = {};
    for (const {stamp, close} of observations) {
        if (!Number.isFinite(stamp) || !Number.isFinite(close) || close < 0) continue;
        const month = new Date(stamp * 1000).toISOString().slice(0, 7);
        // quote.close is not dividend-adjusted: B3 cash distributions are added separately.
        prices[month] = Math.round(close * 1e6) / 1e6;
    }
    if (!Object.keys(prices).length) throw new Error('Histórico retornou sem preços válidos.');
    return prices;
}
function monthlyReturnsFromCloses(prices) {
    const months = Object.keys(prices).sort(), returns = {};
    for (let i = 1; i < months.length; i++) {
        const [year, month] = months[i].split('-').map(Number);
        const previous = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 7);
        if (previous === months[i - 1] && prices[previous] > 0) returns[months[i]] = (prices[months[i]] / prices[previous] - 1) * 100;
    }
    return returns;
}
module.exports = {monthlyClosesFromChart, monthlyReturnsFromCloses};

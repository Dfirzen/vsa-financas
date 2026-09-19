const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {MarketDataService} = require('../src/services/market-data-service');
const {monthlyClosesFromChart, monthlyReturnsFromCloses} = require('../src/services/market-series');
const now = Date.UTC(2026,8,18);
const response = (json, status=200, retryAfter=null) => ({ok:status>=200&&status<300,status,json:async()=>json,headers:{get:()=>retryAfter}});
const chart = {chart:{result:[{timestamp:[Date.UTC(2026,0,2)/1000,Date.UTC(2026,0,31)/1000,Date.UTC(2026,1,28)/1000],indicators:{quote:[{close:[10,12,15]}],adjclose:[{adjclose:[8,9,10]}]}}]}};
function service(t, fetch, options={}) {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vsa-market-test-'));
    t.after(()=>{if(path.dirname(path.resolve(dir))===path.resolve(os.tmpdir()) && path.basename(dir).startsWith('vsa-market-test-'))fs.rmSync(dir,{recursive:true,force:true});});
    return new MarketDataService({basePath:dir,fetch,getConfig:()=>({brapi_token:'test-token'}),requestInterval:0,now:()=>now,sleep:async()=>{},...options});
}
test('Brapi serializes all callers, sends one symbol and coalesces duplicate tickers',async t=>{
    let active=0,maxActive=0; const urls=[];
    const s=service(t,async url=>{urls.push(url);active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;return response({results:[{regularMarketPrice:10}]});});
    const [a,b]=await Promise.all([s.getPrices(['KNSC11','HGRE11','KNSC11'],true),s.getPrices(['KNSC11','MXRF11'],true)]);
    assert.equal(maxActive,1);assert.equal(urls.length,3);assert.equal(a.KNSC11,10);assert.equal(b.KNSC11,10);
    assert.ok(urls.every(url=>!new URL(url).pathname.includes(',')));
});
test('fresh 30-minute cache saves API quota but force refresh bypasses it',async t=>{
    let calls=0;const s=service(t,async()=>{calls++;return response({results:[{regularMarketPrice:11}]});});
    s.cache.KNSC11={price:10,timestamp:(now-20*60*1000)/1000};
    assert.equal((await s.getPrices(['KNSC11'])).KNSC11,10);assert.equal(calls,0);
    assert.equal((await s.getPrices(['KNSC11'],true)).KNSC11,11);assert.equal(calls,1);
});
test('429 respects Retry-After then clears prior failure on success',async t=>{
    let calls=0;const waits=[];
    const s=service(t,async()=>++calls===1?response({},429,'2'):response({results:[{regularMarketPrice:9}]}),{sleep:async ms=>waits.push(ms)});
    s.quoteErrors.set('KNSC11','previous failure');
    assert.equal((await s.getPrices(['KNSC11'],true)).KNSC11,9);assert.deepEqual(waits,[2000]);
    assert.equal(s.getQuoteStatus(['KNSC11']).KNSC11.refreshFailed,false);
});
test('long rate limit prevents a burst across queued symbols and retains old timestamp',async t=>{
    let calls=0;const s=service(t,async()=>{calls++;return response({},429,'120');});
    const stamp=(now-3600000)/1000;s.cache.KNSC11={price:8,timestamp:stamp};
    const prices=await s.getPrices(['KNSC11','HGRE11'],true);
    assert.equal(calls,1);assert.equal(prices.KNSC11,8);assert.equal(prices.HGRE11,undefined);assert.equal(s.cache.KNSC11.timestamp,stamp);
    assert.equal(s.getQuoteStatus(['KNSC11']).KNSC11.stale,true);
});
test('authentication error does not retry or expose token and permits subsequent recovery',async t=>{
    let calls=0;const s=service(t,async()=>++calls===1?response({},401):response({results:[{regularMarketPrice:12}]}));
    await s.getPrices(['KNSC11'],true);assert.equal(calls,1);
    assert.ok(!s.getQuoteStatus(['KNSC11']).KNSC11.error.includes('test-token'));
    assert.equal((await s.getPrices(['KNSC11'],true)).KNSC11,12);
});
test('Yahoo parsing uses unadjusted closing prices and the last valid day of each month',()=>{
    assert.deepEqual(monthlyClosesFromChart(chart),{'2026-01':12,'2026-02':15});
    assert.equal(monthlyReturnsFromCloses(monthlyClosesFromChart(chart))['2026-02'],25);
    assert.deepEqual(monthlyReturnsFromCloses({'2026-01':10,'2026-03':12}),{});
    assert.throws(()=>monthlyClosesFromChart({chart:{result:[{timestamp:[],indicators:{}}]}}));
});
test('empty old historical cache is repaired and duplicate requests share one fetch',async t=>{
    let calls=0;const s=service(t,async()=>{calls++;return response(chart);});
    s.cache.__monthly_KNSC11_2y__={prices:{},timestamp:now/1000};
    const [a,b]=await Promise.all([s.getMonthlyPrices(['KNSC11'],'2y'),s.getMonthlyPrices(['KNSC11'],'2y')]);
    assert.deepEqual(a.KNSC11,{'2026-01':12,'2026-02':15});assert.deepEqual(a,b);assert.equal(calls,1);
    await s.getMonthlyPrices(['KNSC11'],'2y');assert.equal(calls,1);
    await s.getMonthlyPrices(['KNSC11'],'2y',true);assert.equal(calls,2);
});
test('invalid history response preserves valid cache rather than replacing it with empty data',async t=>{
    const s=service(t,async()=>({ok:true,status:200,json:async()=>{throw new Error('not JSON');}}));
    s.cache.__monthly_v2_KNSC11_2y__={prices:{'2026-01':12},timestamp:1};
    assert.deepEqual((await s.getMonthlyPrices(['KNSC11'],'2y',true)).KNSC11,{'2026-01':12});
    assert.equal(s.cache.__monthly_v2_KNSC11_2y__.timestamp,1);
});
test('CDI, IPCA and Ibovespa use independent valid series and do not fabricate unpublished IPCA',async t=>{
    const s=service(t,async url=>response(url.includes('finance/chart')?chart:[{data:'01/01/2026',valor:url.includes('433')?'0.4':'1.0'},{data:'01/02/2026',valor:'0.5'}]));
    const data=await s.getIndicesHistory('2y');
    assert.equal(data.CDI['2026-01'],1);assert.equal(data.IPCA['2026-01'],.4);assert.equal(data.IBOV['2026-02'],25);
    assert.equal(data.IPCA['2026-03'],undefined);
});

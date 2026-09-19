const {test}=require('node:test');const assert=require('node:assert/strict');
const {build}=require('../renderer/analysis-core');const {AIService}=require('../src/services/ai-service');
const now=new Date(2026,8,19);
const state={categories:{FIIs:{ativos:{TEST11:{quant:10,investedVal:1000,totalVal:950,avgPrice:100,currentPrice:95}}}},realizedGain:0,investTransactions:[{type:'buy',monthKey:'202601',sortDate:'20260101',value:1000}],yieldTransactions:[{ticker:'TEST11',monthKey:'202609',sortDate:'20260915',valTotal:50}]};
test('analysis separates purchase cost, price losses, income and combined result',()=>{
    const s=build(state,{},[{id:'aporte_mensal',value_target:100}], 'Todos',now);
    assert.equal(s.totals.cost,1000);assert.equal(s.totals.priceGain,-50);assert.equal(s.totals.income,50);assert.equal(s.totals.combinedResult,0);
    assert.equal(s.goals[0].periodTarget,900);assert.equal(s.goals[0].status,'Em dia no acumulado');assert.equal(s.goals[0].monthsEquivalent,10);
});
test('unavailable quotes are not described as market value or zero return',()=>{
    const copy=structuredClone(state);copy.categories.FIIs.ativos.TEST11.quoteUnavailable=true;
    const s=build(copy,{},[], 'Todos',now);assert.equal(s.positions[0].price,null);assert.equal(s.totals.marketValue,null);assert.equal(s.totals.combinedResult,null);
});
test('benchmark uses the same available end month and preserves missing data',()=>{
    const s=build(state,{monthlyReturns:{'2026-07':1,'2026-08':2,'2026-09':9},indices:{IPCA:{'2026-07':.5,'2026-08':.5}}},[],'Todos',now);
    assert.equal(s.performance.benchmarks.IPCA.through,'2026-08');assert.ok(Math.abs(s.performance.benchmarks.IPCA.portfolio-3.02)<1e-9);assert.equal(s.performance.benchmarks.CDI.index,null);
});
test('OpenAI analysis receives the real topic and snapshot with grounded instructions, without network',async()=>{
    const ai=new AIService();let request;ai._apiKey='synthetic';ai._provider='openai';
    ai._model={chat:{completions:{create:async data=>{request=data;return {choices:[{message:{content:'Análise calculada.'}}]};}}}};
    const snapshot=build(state,{},[], 'Todos',now);const result=await ai.analyzePortfolio({snapshot,analysisType:'income'});
    assert.equal(result.analysis,'Análise calculada.');assert.ok(request.messages[0].content.includes('Compromissos recorrentes continuam ativos'));
    assert.ok(request.messages[1].content.includes('proventos por mês'));assert.ok(request.messages[1].content.includes('"priceGain": -50'));
    assert.ok(!request.messages[1].content.includes('Proventos Recebidos (12M)'));
});
test('unconfigured AI returns an actionable error without attempting a request',async()=>{
    assert.ok((await new AIService().analyzePortfolio({})).error.includes('Configurações'));
});

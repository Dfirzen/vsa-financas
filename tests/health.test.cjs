const {test}=require('node:test');
const assert=require('node:assert/strict');
const Health=require('../renderer/health-core');
const now=new Date(2026,8,22);
const state={
    categories:{FIIs:{ativos:{AAA11:{quant:10,investedVal:1000,totalVal:1200,currentPrice:120,quoteUnavailable:false},BBB11:{quant:5,investedVal:1000,totalVal:800,currentPrice:160,quoteUnavailable:false}}},ETFs:{ativos:{ETF11:{quant:10,investedVal:1000,totalVal:1000,currentPrice:100,quoteUnavailable:false}}}},
    allYields:[{ticker:'AAA11',monthKey:'202606',sortDate:'20260615',valTotal:30},{ticker:'AAA11',monthKey:'202607',sortDate:'20260715',valTotal:60},{ticker:'BBB11',monthKey:'202608',sortDate:'20260815',valTotal:90}],
    investTransactions:[{sortDate:'20260820'}],quoteStatuses:{AAA11:{stale:false}},invalidHistory:false
};
test('health separates allocation, contributions and recent completed-month income',()=>{
    const r=Health.build(state,{maxAssetPercent:35,maxCategoryPercent:60,incomeMonths:3},now);
    assert.equal(r.marketValue,3000);assert.equal(r.positions[0].ticker,'AAA11');assert.equal(r.positions[0].weight,40);
    assert.equal(r.allocation[0].name,'FIIs');assert.equal(Math.round(r.allocation[0].weight),67);
    assert.equal(r.income.total,180);assert.equal(r.income.average,60);assert.deepEqual(r.income.months.map(x=>x.month),['202606','202607','202608']);
    assert.equal(r.contributions.positive[0].ticker,'AAA11');assert.equal(r.contributions.negative[0].ticker,'BBB11');
    assert.equal(r.signals.find(x=>x.id==='asset').level,'warning');assert.equal(r.signals.find(x=>x.id==='category').level,'warning');
});
test('health makes missing and invalid data explicit',()=>{
    const copy=structuredClone(state);copy.invalidHistory=true;copy.categories.FIIs.ativos.BBB11.quoteUnavailable=true;
    const r=Health.build(copy,{},now);
    assert.equal(r.data.invalidHistory,true);assert.deepEqual(r.data.quoteIssues,['BBB11']);assert.equal(r.signals.find(x=>x.id==='data').level,'critical');
    assert.equal(r.marketValue,2200);
});
test('personal rules are bounded and do not invent defaults from invalid values',()=>{
    assert.deepEqual(Health.normalizeRules({maxAssetPercent:2,maxCategoryPercent:200,incomeMonths:0}),{maxAssetPercent:25,maxCategoryPercent:80,incomeMonths:3});
    assert.deepEqual(Health.normalizeRules({maxAssetPercent:30,maxCategoryPercent:70,incomeMonths:6}),{maxAssetPercent:30,maxCategoryPercent:70,incomeMonths:6});
});

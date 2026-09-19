const {test} = require('node:test');
const assert = require('node:assert/strict');
const G = require('../renderer/goals-core');
const now = new Date(2026,8,18);
const buy = (month,value) => ({type:'buy',monthKey:month,value});
test('legacy definitions keep targets and receive independent goal types',()=>{
    const monthly=G.normalize({id:'aporte_mensal',value_target:500},2026);
    const annual=G.normalize({id:'aporte_anual',value_target:12000},2026);
    assert.equal(monthly.kind,'recurring');assert.equal(annual.kind,'annual');assert.equal(annual.value_target,12000);
    assert.equal(G.normalize({id:'custom_old',value_current:250}).metric,'manual');
});
test('lump sum counts toward elapsed calendar months without completing the recurring commitment',()=>{
    const r=G.evaluate({id:'aporte_mensal',value_target:500},{investTransactions:[buy('202601',23500)]},now);
    assert.equal(r.target,4500);assert.equal(r.active,9);assert.equal(r.status,'Em dia no acumulado');
    assert.equal(r.purchases[1],0);assert.equal(r.equivalent,47);
});
test('start month and historical years use their actual elapsed months',()=>{
    assert.equal(G.evaluate({id:'aporte_mensal',value_target:500,start_month:6},{},now).target,2000);
    assert.equal(G.evaluate({id:'aporte_mensal',value_target:500},{},now,2025).target,6000);
    assert.equal(G.evaluate({id:'aporte_mensal',value_target:500},{},now,2027).target,0);
});
test('annual target uses its own year and excludes sales and other years',()=>{
    const r=G.evaluate({id:'aporte_anual',year:2025,value_target:12000},{investTransactions:[buy('202501',13000),buy('202601',2000),{type:'sell',monthKey:'202502',value:-1000}]},now);
    assert.equal(r.value,13000);assert.equal(r.status,'Objetivo atingido');
});
test('income average includes zero months and excludes the partial current month',()=>{
    const r=G.evaluate({id:'renda_mensal',value_target:500},{investTransactions:[buy('202601',1000)],allYields:[{monthKey:'202606',valTotal:300},{monthKey:'202608',valTotal:600},{monthKey:'202609',valTotal:900}]},now);
    assert.equal(r.value,300);
});
test('new portfolio income does not invent history before its first month',()=>{
    const r=G.evaluate({id:'renda_mensal',value_target:500},{investTransactions:[buy('202608',1000)],allYields:[{monthKey:'202608',valTotal:20}]},now);
    assert.equal(r.value,20);
});
test('invalid schema and incompatible automatic indicators are rejected',()=>{
    assert.throws(()=>G.validate({kind:'fake'}));assert.throws(()=>G.validate({year:2026.5}));
    assert.throws(()=>G.validate({kind:'recurring',metric:'income'}));assert.throws(()=>G.validate({start_month:0}));
});

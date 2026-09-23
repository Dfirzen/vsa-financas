const {test}=require('node:test');const assert=require('node:assert/strict');const F=require('../renderer/fii-segments');
test('owned FIIs are grouped by FII segment instead of investment class',()=>{
    const cat={ativos:{BTLG11:{quant:2,totalVal:200,investedVal:180},KNCR11:{quant:1,totalVal:100,investedVal:98},BCFF11:{quant:1,totalVal:70,investedVal:75}},specialAtivos:{KNCR12:{quant:3,totalVal:0}}};
    const r=F.group(cat);assert.deepEqual(Object.keys(r.categories),['Tijolo','Papel e recebíveis','Fundo de fundos']);assert.equal(r.total,370);assert.ok(r.categories['Papel e recebíveis'].specialAtivos.KNCR12);
});
test('unknown funds stay explicit and a user override wins',()=>{
    assert.equal(F.classify('NOVO11'),'Não classificado');assert.equal(F.classify('NOVO11',{NOVO11:'Tijolo'}),'Tijolo');
});

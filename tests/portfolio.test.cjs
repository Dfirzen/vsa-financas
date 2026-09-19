const {test} = require('node:test');
const assert = require('node:assert/strict');
const P = require('../renderer/portfolio-core');
const XLSX = require('xlsx');
const classify = () => 'Ações';
const normal = () => ({type:'normal', label:'Normal'});
const row = (overrides = {}) => ({'Entrada/Saída':'Credito', Data:'01/01/2026', Movimentação:'Compra', Produto:'TEST3 - TESTE', Instituição:'Corretora A', Quantidade:10, 'Preço unitário':10, 'Valor da Operação':100, ...overrides});
const rows = (...data) => [P.columns, ...data.map(r => P.columns.map(c => r[c]))];
const account = (...data) => P.account(rows(...data), classify, normal);
test('partial sale preserves average cost and separates realized gain', () => {
    const ledger = account(row(), row({Data:'10/01/2026',Movimentação:'Venda',Quantidade:5,'Valor da Operação':60}));
    const a = ledger.categories.Ações.ativos.TEST3;
    assert.equal(a.quant, 5); assert.equal(a.avgPrice, 10); assert.equal(a.investedVal, 50); assert.equal(ledger.realizedGain, 10);
});
test('reverse chronological B3 extracts produce the same ledger', () => {
    const sale = row({Data:'10/01/2026',Movimentação:'Venda',Quantidade:5,'Valor da Operação':60});
    assert.deepEqual(account(sale, row()).categories, account(row(), sale).categories);
});
test('full liquidation and repurchase start a new cost basis', () => {
    const l = account(row(),row({Data:'02/01/2026',Movimentação:'Venda','Valor da Operação':120}),row({Data:'03/01/2026',Quantidade:2,'Valor da Operação':30}));
    assert.equal(l.categories.Ações.ativos.TEST3.avgPrice,15); assert.equal(l.realizedGain,20);
});
test('liquidation transfer uses debit/credit direction', () => {
    assert.equal(P.movement(row({Movimentação:'Transferência - Liquidação','Entrada/Saída':'Débito'})), 'sell');
    assert.equal(P.movement(row({Movimentação:'Transferência - Liquidação','Entrada/Saída':'Crédito'})), 'buy');
    assert.equal(P.movement(row({Movimentação:'Transferência - Liquidação','Entrada/Saída':''})), 'unknown');
});
test('overlap deduplication preserves identical trades and different institutions', () => {
    const a = row(), b = row({Instituição:'Corretora B'});
    assert.equal(P.mergeExtracts([[a,a,b],[a,a,b]]).length,4);
    assert.equal(P.mergeExtracts([[a],[a,a]]).length,3);
    assert.equal(P.mergeExtracts([[a,row({'Entrada/Saída':'Débito'})]]).length,3);
});
test('numeric and string representations deduplicate without rounding away trades', () => {
    assert.equal(P.mergeExtracts([[row()],[row({Quantidade:'10,0000','Valor da Operação':'100,00','Preço unitário':'10,00'})]]).length,2);
    assert.equal(P.mergeExtracts([[row({Quantidade:0.00001}),row({Quantidade:0.00002})]]).length,3);
});
test('real XLSX round trip handles serial dates, localized values and title rows', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Extrato'], ...rows(row({Data:46023,Quantidade:'10,00','Valor da Operação':'1.000,00'}))]), 'Movimentação');
    const buffer = XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
    const read = XLSX.read(buffer,{type:'buffer'});
    const extract = P.sheetRows(XLSX.utils.sheet_to_json(read.Sheets.Movimentação,{header:1}));
    assert.equal(P.date(extract[0].Data),'2026-01-01');
    const l = P.account(P.mergeExtracts([extract]),classify,normal);
    assert.equal(l.totalCost,1000); assert.equal(l.investTransactions[0].sortDate,'20260101');
});
test('invalid dates and incomplete sale history are flagged', () => {
    assert.equal(P.date('31/02/2026'),null);
    assert.equal(account(row({Movimentação:'Venda'})).invalidHistory,true);
    assert.equal(account(row({Movimentação:'Bonificação'})).warnings.length,1);
});
test('fractional market suffix is consolidated with ordinary shares', () => {
    assert.equal(account(row({Produto:'TEST3F - TESTE'})).categories.Ações.ativos.TEST3.quant,10);
});
const tx = (date,quant,value) => ({ticker:'TEST3',monthKey:date.slice(0,6),sortDate:date,quant,value,type:quant>0?'buy':'sell'});
test('full sale includes realized return and does not require a closing quote', () => {
    const returns = P.monthlyReturns([tx('20260101',10,100),tx('20260228',-10,-120)],{TEST3:{'2026-01':10}},[],new Date(2026,1,28));
    assert.equal(returns['2026-01'],0); assert.equal(returns['2026-02'],20);
});
test('buy and full sale within one month preserve the gain', () => {
    assert.equal(P.monthlyReturns([tx('20260101',10,100),tx('20260115',-10,-120)],{},[],new Date(2026,0,31))['2026-01'],20);
});
test('missing historical quote stays unavailable instead of becoming 0%', () => {
    assert.ok(Number.isNaN(P.monthlyReturns([tx('20260101',10,100)],{},[],new Date(2026,0,31))['2026-01']));
});
test('total loss remains -100%, not 0%', () => {
    assert.equal(P.monthlyReturns([tx('20260101',10,100)],{TEST3:{'2026-01':0}},[],new Date(2026,0,31))['2026-01'],-100);
});
test('income is included in monthly total return', () => {
    const yields = [{ticker:'TEST3',sortDate:'20260228',monthKey:'202602',valTotal:5}];
    assert.equal(P.monthlyReturns([tx('20260101',10,100)],{TEST3:{'2026-01':10,'2026-02':10}},yields,new Date(2026,1,28))['2026-02'],5);
});
test('year filter preserves prior purchases and complete income history', () => {
    const l = P.account(rows(row({Data:'01/01/2025'}),row({Data:'10/01/2025',Movimentação:'Rendimento','Valor da Operação':5}),row({Data:'10/01/2026',Movimentação:'Rendimento','Valor da Operação':7})),classify,normal,'2026');
    assert.equal(l.totalCost,100); assert.equal(l.income,7); assert.equal(l.allYields.length,2);
});

test('new purchases increase assets but never create performance', () => {
    const audit = {};
    const result = P.monthlyReturns([tx('20260101',90,9000),tx('20260210',50,5000)],{TEST3:{'2026-01':100,'2026-02':100}},[],new Date(2026,1,28),audit);
    assert.equal(result['2026-02'],0);
    assert.equal(audit['2026-02'].closingValue,14000);
    assert.equal(audit['2026-02'].purchases,5000);
    assert.equal(audit['2026-02'].result,0);
});

test('monthly audit reconciles price losses and cash income separately', () => {
    const audit = {};
    const result = P.monthlyReturns([tx('20260101',10,1000)],{TEST3:{'2026-01':100,'2026-02':95}},[{ticker:'TEST3',monthKey:'202602',sortDate:'20260228',valTotal:50}],new Date(2026,1,28),audit);
    assert.equal(result['2026-02'],0);
    assert.equal(audit['2026-02'].income,50);
    assert.equal(audit['2026-02'].closingValue,950);
    assert.equal(audit['2026-02'].result,0);
});

test('six percent price appreciation is independent of purchased quantity', () => {
    assert.equal(P.monthlyReturns([tx('20260101',90,9000)],{TEST3:{'2026-01':106}},[],new Date(2026,0,31))['2026-01'],6);
});

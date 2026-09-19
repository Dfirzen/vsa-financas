const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const profile = process.env.VSA_TEST_PROFILE;
if (!profile || !path.basename(profile).startsWith('vsa-smoke-')) throw new Error('An isolated test profile is required.');
app.setPath('userData', profile);
BrowserWindow.prototype.show = function () {};
const data = path.join(profile, 'data'), extracts = path.join(profile, 'extracts');
fs.mkdirSync(data, {recursive:true}); fs.mkdirSync(extracts,{recursive:true});
const configPath = path.join(data, 'config.json');
if (!fs.existsSync(configPath)) fs.writeFileSync(configPath,JSON.stringify({is_configured:true,user_name:'Teste',excel_folder_path:extracts,ai_provider:'openai',ai_api_key:'test-only-secret',brapi_token:'test-only-token'}));
const P = require('../../renderer/portfolio-core');
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([P.columns,
    ['Credito','01/01/2026','Transferência - Liquidação','TEST3 - TESTE','A',10,10,100],
    ['Debito','28/02/2026','Transferência - Liquidação','TEST3 - TESTE','A',5,12,60],
    ['Credito','28/02/2026','Dividendo','TEST3 - TESTE','A',5,1,5]
]),'Movimentação');
XLSX.writeFile(workbook,path.join(extracts,'fixture.xlsx'));
const {marketDataService} = require('../../src/services/market-data-service');
marketDataService.getPrices = async () => {
    if (app.__vsaQuoteFailure) {
        marketDataService.quoteErrors.set('TEST3','Limite temporário da Brapi atingido.');
        return {TEST3:12};
    }
    marketDataService.cache.TEST3 = {price:12,timestamp:Date.now()/1000};
    marketDataService.quoteErrors.delete('TEST3');
    return {TEST3:12};
};
marketDataService.getMonthlyPrices = async () => ({TEST3:Object.fromEntries(Array.from({length:12},(_,i)=>[`2026-${String(i+1).padStart(2,'0')}`,i?12:10]))});
marketDataService.getIndicesHistory = async () => ({CDI:{'2026-01':1,'2026-02':1},IBOV:{'2026-01':2,'2026-02':-1},IPCA:{'2026-01':.4,'2026-02':.3}});
require('../../src/services/dividends-service').dividendsService.getNextPaymentDates = async () => ({});
const {aiService} = require('../../src/services/ai-service');
aiService.configure = async () => {};
aiService.isConfigured = () => true;
aiService.analyzePortfolio = async (data) => {
    app.__analysisCalls=(app.__analysisCalls||0)+1;app.__analysisPayload=data;
    if(app.__analysisFailure)return {error:'Falha temporária de teste. Tente novamente.'};
    return {analysis:'**Análise de teste**<img src="x" onerror="window.injected=true">'};
};
aiService.chat = async (id) => ({response:'**Resposta de teste**<img src="x" onerror="window.injected=true"><script>window.injected=true</script> Histórico: ' + (aiService.restoredMessages[id]?.length || 0)});
require('../../main');

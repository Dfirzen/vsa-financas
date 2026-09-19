// Opt-in live diagnostic: two Brapi quotes using the locally configured token.
// Never prints credentials, modifies the personal profile, or invokes AI APIs.
const fs = require('fs');
const path = require('path');
const os = require('os');
if (!process.argv.includes('--electron-worker')) {
    const {spawnSync} = require('child_process');
    const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsa-market-live-'));
    try {
        // Windows safeStorage also needs the profile's encrypted master key.
        // Clone only that state into the isolated diagnostic profile.
        fs.copyFileSync(path.join(process.env.APPDATA,'investai-desktop','Local State'), path.join(temp,'Local State'));
        env.VSA_MARKET_DIAG_PROFILE = temp;
        const result = spawnSync(require('electron'), [__filename, '--electron-worker'], {env, stdio:'inherit', windowsHide:true});
        process.exitCode = result.status ?? 1;
    } finally {
        if (path.dirname(path.resolve(temp)) === path.resolve(os.tmpdir()) && path.basename(temp).startsWith('vsa-market-live-')) fs.rmSync(temp,{recursive:true,force:true});
    }
} else {
    const {app, safeStorage} = require('electron');
    const temp = process.env.VSA_MARKET_DIAG_PROFILE;
    if (!temp || !path.basename(temp).startsWith('vsa-market-live-')) throw new Error('Perfil temporário inválido.');
    app.setPath('userData',temp);
    app.whenReady().then(async () => {
        const profile = path.join(process.env.APPDATA, 'investai-desktop', 'data');
        const saved = JSON.parse(fs.readFileSync(path.join(profile,'config.json'),'utf8'));
        const token = saved.brapi_token_encrypted ? safeStorage.decryptString(Buffer.from(saved.brapi_token_encrypted,'base64')) : saved.brapi_token;
        if (!token) throw new Error('Token da Brapi não configurado.');
        const {MarketDataService} = require('../src/services/market-data-service');
        const service = new MarketDataService({basePath:temp,getConfig:()=>({brapi_token:token})});
        const quotes = await service.getPrices(['KNSC11','HGRE11'],true);
        const history = await service.getMonthlyPrices(['KNSC11','HGRE11'],'2y');
        const indices = await service.getIndicesHistory('2y');
        const summarize = values => ({months:Object.keys(values).length,first:Object.keys(values).sort()[0],last:Object.keys(values).sort().at(-1)});
        let portfolioHistory = null;
        if (saved.excel_folder_path && fs.existsSync(saved.excel_folder_path)) {
            const XLSX = require('xlsx'), P = require('../renderer/portfolio-core'), vm = require('vm');
            const extracts = fs.readdirSync(saved.excel_folder_path).filter(f=>/\.xlsx?$/i.test(f) && !f.startsWith('~$')).map(file=> {
                const w = XLSX.readFile(path.join(saved.excel_folder_path,file));
                const name = w.SheetNames.find(n=>n==='Movimentação') || w.SheetNames[0];
                return P.sheetRows(XLSX.utils.sheet_to_json(w.Sheets[name],{header:1}));
            });
            if (extracts.length) {
                const renderer = fs.readFileSync(path.join(__dirname,'../renderer/script.js'),'utf8');
                const classification = vm.runInNewContext(renderer.slice(renderer.indexOf('    function classifyTicker('),renderer.indexOf('    // ==== CORES POR CLASSE'))+';({classifyAsset,classifyTicker})');
                const ledger = P.account(P.mergeExtracts(extracts),(p,t)=>classification.classifyAsset(p,t,saved.asset_class_overrides||{}),classification.classifyTicker);
                const tickers = [...new Set(ledger.investTransactions.map(t=>t.ticker))];
                const years = Math.max(2, new Date().getFullYear() - Number(ledger.investTransactions[0]?.sortDate.slice(0,4) || new Date().getFullYear()) + 1);
                const allPrices = await service.getMonthlyPrices(tickers,years+'y');
                const returns = P.monthlyReturns(ledger.investTransactions,allPrices,ledger.allYields);
                portfolioHistory = {assets:tickers.length,invalidHistory:ledger.invalidHistory,monthlyReturns:Object.keys(returns).length,monthsWithValidReturn:Object.values(returns).filter(Number.isFinite).length,missingPrices:tickers.filter(t=>!Object.keys(allPrices[t]||{}).length)};
                if (ledger.invalidHistory || portfolioHistory.missingPrices.length || portfolioHistory.monthlyReturns !== portfolioHistory.monthsWithValidReturn) process.exitCode = 1;
            }
        }
        console.log(JSON.stringify({quotes,quoteStatus:service.getQuoteStatus(['KNSC11','HGRE11']),history:Object.fromEntries(Object.entries(history).map(([k,v])=>[k,summarize(v)])),indices:Object.fromEntries(Object.entries(indices).map(([k,v])=>[k,summarize(v)])),portfolioHistory},null,2));
        if (Object.keys(quotes).length!==2 || Object.values(history).some(v=>!Object.keys(v).length) || ['CDI','IPCA','IBOV'].some(k=>!Object.keys(indices[k]||{}).length)) throw new Error('Diagnóstico incompleto. Verifique o resumo acima.');
        app.exit(process.exitCode || 0);
    }).catch(error=>{console.error('Diagnóstico:',error.message);app.exit(1);});
}

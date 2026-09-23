const {_electron:electron}=require('@playwright/test');
const XLSX=require('xlsx');const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
(async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vsa-smoke-fii-')),fixture=path.join(profile,'fiis.xlsx');
    const rows=[['Entrada/Saída','Data','Movimentação','Produto','Instituição','Quantidade','Preço unitário','Valor da Operação'],
        ['Credito','01/01/2026','Transferência - Liquidação','BTLG11 - FUNDO','Teste',2,100,200],
        ['Credito','01/01/2026','Transferência - Liquidação','KNCR11 - FUNDO','Teste',2,100,200],
        ['Credito','01/01/2026','Transferência - Liquidação','BCFF11 - FUNDO','Teste',2,100,200],
        ['Credito','15/02/2026','Rendimento','BTLG11 - FUNDO','Teste',2,1,2],
        ['Credito','15/02/2026','Rendimento','KNCR11 - FUNDO','Teste',2,2,4]];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Movimentação');XLSX.writeFile(wb,fixture);
    const env={...process.env,VSA_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
    const app=await electron.launch({args:[path.resolve(__dirname,'../tests/fixtures/electron-main.cjs')],env});
    try{
        const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.dashboardState?.categories?.Ações?.ativos?.TEST3);await page.locator('#excel-upload').setInputFiles(fixture);
        await page.waitForFunction(()=>window.dashboardState?.categories?.FIIs?.ativos?.BTLG11);
        await page.locator('[data-target="visao-geral"]').click();
        const groups=await page.locator('#assets-list-container .group-name').allTextContents();
        assert.deepEqual(groups,['Tijolo','Papel e recebíveis','Fundo de fundos']);
        assert.equal(groups.includes('Ações'),false);assert.equal(groups.includes('ETFs'),false);
        await page.locator('[data-fii-tab="proventos"]').first().click();
        assert.deepEqual(await page.locator('#prov-filter-fundo option').allTextContents(),['Todos os fundos','BTLG11','KNCR11']);
        await page.locator('#prov-filter-fundo').selectOption('KNCR11');
        assert.equal((await page.locator('#prov-list-tbody').textContent()).includes('BTLG11'),false);
        assert.equal((await page.locator('#prov-list-tbody').textContent()).includes('KNCR11'),true);
        assert.equal((await page.locator('#prov-total-carteira').textContent()).replace(/\s/g,''),'R$4,00');
        fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
        await page.screenshot({path:path.resolve(__dirname,'../test-results/proventos-filter.png'),fullPage:true});
        console.log('FIIs OK: segmentos corretos e filtro de proventos aplicado ao resumo e à lista.');
    }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

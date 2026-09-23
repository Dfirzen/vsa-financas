const {_electron:electron}=require('@playwright/test');
const XLSX=require('xlsx');const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
(async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vsa-smoke-fii-')),fixture=path.join(profile,'fiis.xlsx');
    const rows=[['Entrada/Saída','Data','Movimentação','Produto','Instituição','Quantidade','Preço unitário','Valor da Operação'],
        ['Credito','01/01/2026','Transferência - Liquidação','BTLG11 - FUNDO','Teste',2,100,200],
        ['Credito','01/01/2026','Transferência - Liquidação','KNCR11 - FUNDO','Teste',2,100,200],
        ['Credito','01/01/2026','Transferência - Liquidação','BCFF11 - FUNDO','Teste',2,100,200]];
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
        console.log('Categorias de FIIs OK: Tijolo, Papel e recebíveis e Fundo de fundos; sem classes de investimento.');
    }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

const {_electron:electron}=require('@playwright/test');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
(async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vsa-smoke-audit-'));
    const env={...process.env,VSA_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
    const app=await electron.launch({args:[path.resolve(__dirname,'../tests/fixtures/electron-main.cjs')],env});
    try{
        const page=await app.firstWindow();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.waitForFunction(()=>window.dashboardState?.categories?.Ações?.ativos?.TEST3);
        async function nav(target){await page.locator(`[data-target="${target}"]`).click();await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));}
        const targets=await page.locator('.sidebar-item[data-target]').evaluateAll(els=>els.map(e=>e.dataset.target));
        for(const target of targets)await nav(target);
        await nav('screen-renda-fixa');await page.locator('#btn-add-rf').click();
        await page.locator('#rf-nome').fill('<img src=x onerror=alert(1)>');
        await page.locator('#rf-valor-investido').fill('1000');await page.locator('#rf-valor-atual').fill('1100');await page.locator('#btn-save-rf').click();
        assert.equal(await page.locator('#rf-table-tbody img').count(),0);
        assert.ok((await page.locator('#rf-table-tbody').textContent()).includes('<img src=x'));
        assert.equal(await page.locator('#val-rf-lucro').textContent().then(s=>s.replace(/\s/g,'')),'R$100,00');
        const rf=await page.evaluate(()=>JSON.parse(localStorage.getItem('vsa_multi_assets')).rendaFixa[0]);
        await page.evaluate(id=>window.editRendaFixa(id),rf.id);await page.locator('#rf-valor-atual').fill('1200');await page.locator('#btn-save-rf').click();
        assert.equal(await page.locator('#val-rf-lucro').textContent().then(s=>s.replace(/\s/g,'')),'R$200,00');
        page.once('dialog',d=>d.accept());await page.evaluate(id=>window.deleteRendaFixa(id),rf.id);
        await nav('screen-etfs');await page.locator('#btn-add-etf').click();await page.locator('#manual-ticker').fill('ETF11');await page.locator('#manual-nome').fill('<b>ETF teste</b>');await page.locator('#manual-quant').fill('10');await page.locator('#manual-pm').fill('100');await page.locator('#btn-save-manual-asset').click();
        assert.equal(await page.locator('#etfs-table-tbody b').count(),0);
        const manual=await page.evaluate(()=>JSON.parse(localStorage.getItem('vsa_multi_assets')).manualAssets[0]);
        page.once('dialog',d=>d.accept());await page.evaluate(id=>window.deleteManualAsset(id,'ETFs'),manual.id);
        await nav('ir-control');await page.locator('#btn-ir-add').click();await page.locator('#ir-form-class').selectOption('fiis');await page.locator('#ir-form-vendas').fill('100');await page.locator('#ir-form-custo').fill('50');await page.locator('#ir-form-pago').fill('5');await page.locator('#btn-ir-save').click();
        await page.locator('.ir-filter-btn[data-class="fiis"]').click();
        assert.ok((await page.locator('#ir-table-body').textContent()).includes('50,00'));
        assert.equal(await page.locator('#ir-kpi-ir-ano').textContent().then(s=>s.replace(/\s/g,'')),'R$5,00');
        assert.equal(await page.locator('#ir-kpi-darf-mes').textContent(),'Não calculado');
        // A corrupt local store must never be silently overwritten by a new registration.
        await page.evaluate(()=>localStorage.setItem('vsa_multi_assets','{broken'));
        await nav('screen-etfs');await page.locator('#btn-add-etf').click();await page.locator('#manual-ticker').fill('ETF11');await page.locator('#manual-quant').fill('1');await page.locator('#manual-pm').fill('100');
        page.once('dialog',d=>d.accept());await page.locator('#btn-save-manual-asset').click();
        assert.equal(await page.evaluate(()=>localStorage.getItem('vsa_multi_assets')),'{broken');
        assert.deepEqual(errors,[]);console.log('Audit flows OK: navigation, manual assets CRUD, escaped names, RF valuation, IR bookkeeping and corrupt-store protection.');
    }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

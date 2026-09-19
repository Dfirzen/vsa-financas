const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vsa-smoke-'));
const main = path.resolve(__dirname, '../tests/fixtures/electron-main.cjs');
const errors = [];
async function launch() {
    const env = {...process.env,VSA_TEST_PROFILE:profile}; delete env.ELECTRON_RUN_AS_NODE;
    const application = await electron.launch({args:[main],env,timeout:60000});
    application.process().stderr.on('data', chunk => process.stderr.write(chunk));
    application.process().stdout.on('data', chunk => process.stdout.write(chunk));
    const page = await application.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('console', message => { if (message.type() === 'error') console.log('Renderer:',message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    try { await page.waitForFunction(() => window.dashboardState?.categories?.['Ações']?.ativos?.TEST3); }
    catch(error) { console.log(await page.evaluate(()=>({state:!!window.dashboardState,api:!!window.api,body:document.body.textContent.slice(-500)}))); await application.close(); throw error; }
    return {application,page};
}
(async () => {
    let application;
    try {
        let run = await launch(); application = run.application; const page = run.page;
        const actual = await page.evaluate(() => ({asset:window.dashboardState.categories['Ações'].ativos.TEST3,api:!!window.api,node:typeof require,charts:typeof Chart,xlsx:typeof XLSX}));
        assert.equal(actual.asset.quant,5); assert.equal(actual.asset.investedVal,50); assert.equal(actual.asset.totalVal,60);
        assert.equal(actual.api,true); assert.equal(actual.node,'undefined'); assert.equal(actual.charts,'function'); assert.equal(actual.xlsx,'object');
        const config = await page.evaluate(() => window.api.getConfig());
        assert.equal(config.ai_api_key,''); assert.equal(config.brapi_token,'');
        const disk = fs.readFileSync(path.join(profile,'data','config.json'),'utf8');
        assert.ok(!disk.includes('test-only-secret') && !disk.includes('test-only-token'));
        assert.ok(JSON.parse(disk).ai_api_key_encrypted);
        await page.evaluate(async () => {
            const {meta} = await window.api.createMeta({title:'Meta teste',value_target:100});
            await window.api.updateMeta(meta.id,{title:'Meta editada',value_target:200});
            const metas = await window.api.getMetas();
            if (metas.find(m=>m.id===meta.id)?.value_target !== 200) throw new Error('Meta did not persist');
            await window.api.deleteMeta(meta.id);
            if ((await window.api.getMetas()).some(m=>m.id===meta.id)) throw new Error('Meta was not deleted');
            try { await window.api.createMeta({title:'Inválida',value_target:-1}); throw new Error('invalid meta accepted'); }
            catch (e) { if (e.message==='invalid meta accepted') throw e; }
        });
        await page.evaluate(() => window.editMeta('aporte_mensal'));
        await page.locator('#edit-meta-name').fill('Aporte corrigido');
        await page.locator('#edit-meta-target').fill('250');
        await page.locator('#btn-save-meta').click();
        await page.waitForFunction(async () => (await window.api.getMetas()).find(m=>m.id==='aporte_mensal')?.value_target === 250);
        assert.equal((await page.evaluate(()=>window.api.getMetas())).find(m=>m.id==='aporte_anual').value_target,12000);
        await page.locator('[data-target="metas"]').click();
        // The hidden Electron window throttles animation frames; finish navigation animation.
        await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
        await page.waitForFunction(()=>document.querySelector('.goal-card.recurring'));
        assert.equal(await page.locator('.goal-section').count(),3);
        assert.ok((await page.locator('.goal-card.recurring').textContent()).includes('Equivalência do acumulado'));
        await page.locator('#btn-create-meta').click();
        await page.locator('#edit-meta-name').fill('Minha renda futura');
        await page.locator('#edit-meta-kind').selectOption('milestone');
        await page.locator('#edit-meta-metric').selectOption('income');
        await page.locator('#edit-meta-target').fill('500');
        await page.locator('#btn-save-meta').click();
        await page.waitForFunction(async()=> (await window.api.getMetas()).some(m=>m.title==='Minha renda futura' && m.metric==='income' && m.kind==='milestone'));
        await page.locator('#meta-modal').waitFor({state:'hidden'});
        fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
        await page.screenshot({path:path.resolve(__dirname,'../test-results/goals.png'),fullPage:true,animations:'disabled'});
        const customGoal=(await page.evaluate(()=>window.api.getMetas())).find(m=>m.title==='Minha renda futura');
        await page.evaluate(id=>window.api.deleteMeta(id),customGoal.id);
        await page.locator('[data-target="visao-executiva"]').click();
        await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
        await page.locator('[data-target="analise"]').click();
        await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
        assert.equal(await application.evaluate(({app})=>app.__analysisCalls||0),0);
        assert.equal(await page.locator('#analise #simuladorChart').count(),0);
        await page.locator('[data-analysis-topic="goals"]').click();
        await page.waitForFunction(()=>document.getElementById('analysis-status').textContent==='Análise concluída.');
        assert.equal(await page.locator('#ai-analysis-content img').count(),0);
        assert.equal(await application.evaluate(({app})=>app.__analysisPayload.analysisType),'goals');
        assert.equal(await application.evaluate(({app})=>app.__analysisPayload.snapshot.totals.combinedResult),25);
        await page.screenshot({path:path.resolve(__dirname,'../test-results/analysis.png'),fullPage:true,animations:'disabled'});
        await application.evaluate(({app})=>{app.__analysisFailure=true;});
        await page.locator('[data-analysis-topic="income"]').click();
        await page.waitForFunction(()=>document.getElementById('analysis-status').textContent.includes('Falha temporária'));
        assert.ok((await page.locator('#ai-analysis-content').textContent()).includes('Análise de teste'));
        await application.evaluate(({app})=>{app.__analysisFailure=false;});
        await page.locator('[data-target="simulador"]').click();
        await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
        assert.ok(await page.locator('#sim-aporte').isVisible());
        assert.equal(await application.evaluate(({app})=>app.__analysisCalls),2);
        await page.locator('[data-target="visao-executiva"]').click();
        await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
        page.once('dialog',dialog=>dialog.accept());
        await page.evaluate(() => window.deleteMeta('aporte_mensal'));
        assert.ok(!(await page.evaluate(()=>window.api.getMetas())).some(m=>m.id==='aporte_mensal'));
        await page.evaluate(() => document.getElementById('btn-toggle-chat').click());
        await page.locator('#ai-chat-input').fill('Mensagem persistente de teste');
        await page.locator('#btn-send-chat').click();
        await page.waitForFunction(() => document.querySelector('#ai-chat-messages').textContent.includes('Resposta de teste'));
        assert.equal(await page.evaluate(() => !!window.injected),false);
        assert.equal(await page.locator('.ai-msg-bubble img').count(),0);
        assert.ok((await page.evaluate(()=>window.api.getActiveConversation())).messages.length===2);
        await page.locator('#btn-new-conversation').click();
        await page.waitForFunction(() => document.querySelectorAll('#chat-conv-list .chat-conv-item').length === 2);
        await page.locator('#chat-conv-list').getByRole('button',{name:'Mensagem persistente de teste',exact:true}).click();
        await page.waitForFunction(() => document.getElementById('ai-chat-messages').textContent.includes('Resposta de teste'));
        // Validate navigation actions with script-src self and no inline handlers.
        await page.evaluate(() => document.getElementById('btn-close-chat').click());
        await page.evaluate(() => window.openRaioXModal('TEST3'));
        assert.ok(await page.locator('#raiox-title').textContent().then(t=>t.includes('TEST3')));
        await page.waitForFunction(() => !!window.rentabState?.individual?.TEST3);
        const benchmark = await page.evaluate(() => {
            const chart = Chart.getChart('execRentabilidadeChart');
            return {labels:chart.data.datasets.map(d=>d.label),ipca:chart.data.datasets.find(d=>d.label==='IPCA').data};
        });
        assert.equal(benchmark.labels.length,4);
        assert.equal(benchmark.labels[0],'Carteira VS&A (acumulado)');
        assert.ok(Math.abs(benchmark.ipca[1]-.7012)<.000001);
        assert.equal(benchmark.ipca[2],null);
        assert.equal(await page.evaluate(() => document.getElementById('exec-patrimonio-total').textContent.replace(/\s/g,'')), 'R$60,00');
        assert.equal(await page.locator('#exec-investido-total').textContent().then(s=>s.replace(/\s/g,'')), 'R$50,00');
        assert.equal(await page.locator('#exec-valorizacao-total').textContent().then(s=>s.replace(/\s/g,'')), 'R$10,00');
        assert.equal(await page.locator('#exec-proventos-total').textContent().then(s=>s.replace(/\s/g,'')), 'R$5,00');
        assert.equal(await page.locator('#exec-lucro-total').textContent().then(s=>s.replace(/\s/g,'')), 'R$25,00');
        assert.ok(await page.locator('#exec-performance-audit tr').count() >= 2);
        fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
        await page.screenshot({path:path.resolve(__dirname,'../test-results/smoke.png'),animations:'disabled'});
        await page.locator('#raiox-close').click();
        await page.screenshot({path:path.resolve(__dirname,'../test-results/benchmarks.png'),animations:'disabled'});
        // Verify the real refresh-button flow and its distinction between success and fallback.
        await page.locator('#btn-refresh-quotes').click();
        await page.waitForFunction(() => document.getElementById('btn-refresh-quotes').textContent.includes('✔ Atualizado'));
        await application.evaluate(({app}) => {app.__vsaQuoteFailure = true;});
        await page.locator('#btn-refresh-quotes').click();
        await page.waitForFunction(() => document.getElementById('btn-refresh-quotes').textContent.includes('Atualização parcial'));
        assert.ok((await page.locator('#data-quality-warning').textContent()).includes('Limite temporário'));
        await application.close(); application = null;
        run = await launch(); application = run.application;
        assert.ok((await run.page.locator('#ai-analysis-content').textContent()).includes('Análise de teste'));
        await run.page.waitForFunction(() => document.querySelector('#ai-chat-messages').textContent.includes('Mensagem persistente de teste'));
        const restored = await run.page.evaluate(async () => { const c = await window.api.getActiveConversation(); return window.api.aiChat({session_id:c.id,conversation_id:c.id,message:'Continuar',portfolio_data:{}}); });
        assert.ok(restored.response.includes('Histórico: 2'));
        assert.deepEqual(errors,[]);
        console.log('Electron smoke OK: XLSX import, accounting, sandbox, encrypted credentials, metas CRUD, sanitized chat and restart persistence.');
    } finally {
        if (application) await application.close();
        // Kept for diagnosis, contains synthetic data only; no personal profile touched.
        console.log('Synthetic test profile: '+profile);
    }
})().catch(error => {console.error(error); process.exitCode=1;});

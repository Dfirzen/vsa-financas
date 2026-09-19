const {_electron:electron}=require('@playwright/test');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vsa-smoke-layout-'));
    const env={...process.env,VSA_TEST_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
    const app=await electron.launch({args:[path.resolve(__dirname,'../tests/fixtures/electron-main.cjs')],env});
    try {
        const page=await app.firstWindow();await page.waitForFunction(()=>window.dashboardState?.categories?.Ações?.ativos?.TEST3);
        await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
        fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
        for(const width of [1400,1280,1024,800]) {
            await page.setViewportSize({width,height:700});
            for(const screen of ['visao-executiva','metas','analise','simulador']) {
                await page.locator(`[data-target="${screen}"]`).click();
                await page.evaluate(()=>gsap.globalTimeline.getChildren().forEach(t=>t.progress(1)));
                const layout=await page.evaluate(()=>{
                    const r=document.querySelector('.health-score-circle').getBoundingClientRect();
                    const clipped=Array.from(document.querySelectorAll('.screen.active .exec-kpi-card')).filter(e=>e.scrollWidth>e.clientWidth+2).length;
                    return {width:innerWidth,scroll:document.documentElement.scrollWidth,circle:[r.width,r.height],clipped};
                });
                assert.ok(layout.scroll<=width+2,`${screen} ${width}: page overflow ${layout.scroll}`);
                if(screen==='visao-executiva') {assert.equal(layout.circle[0],layout.circle[1]);assert.equal(layout.clipped,0);}
                if(width===1024&&screen==='visao-executiva')await page.screenshot({path:path.resolve(__dirname,'../test-results/responsive-1024.png'),fullPage:true});
            }
        }
        console.log('Layout OK: 1400, 1280, 1024 e 800 px; círculo quadrado e conteúdo sem overflow horizontal global.');
    }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

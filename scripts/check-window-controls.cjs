const {_electron: electron} = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');

(async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vsa-smoke-window-'));
    const env = {...process.env, VSA_TEST_PROFILE: profile};
    delete env.ELECTRON_RUN_AS_NODE;
    const app = await electron.launch({args: [path.resolve(__dirname, '../tests/fixtures/electron-main.cjs')], env});
    try {
        const page = await app.firstWindow();
        await page.waitForSelector('#app-window-bar:not([hidden])');
        assert.equal(await page.locator('#app-window-bar').isVisible(), true);
        await page.setViewportSize({width: 1280, height: 800});
        fs.mkdirSync(path.resolve(__dirname, '../test-results'), {recursive: true});
        await page.screenshot({path: path.resolve(__dirname, '../test-results/window-controls.png')});
        await page.locator('#app-window-bar [data-window-action="toggle-maximize"]').click();
        await page.waitForFunction(() => document.querySelector('#app-window-bar [data-window-action="toggle-maximize"]').getAttribute('aria-label') === 'Restaurar janela');
        assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
        await page.locator('#app-window-bar [data-window-action="toggle-maximize"]').click();
        assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized()), false);
        await page.locator('#btn-open-config').click();
        await page.locator('#config-modal [data-window-action="toggle-maximize"]').click();
        assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
        await page.locator('#config-modal [data-modal-close="config-modal"]').click();
        assert.equal(await page.locator('#config-modal').isVisible(), false);
        await page.locator('#app-window-bar [data-window-action="minimize"]').click();
        assert.equal(await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
        await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].restore());
        await Promise.all([
            page.waitForEvent('close'),
            page.locator('#app-window-bar [data-window-action="close"]').click()
        ]);
        console.log('Controles da janela OK: maximizar, restaurar, minimizar, fechar e fechar modal.');
    } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

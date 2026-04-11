const fs = require('fs');

let content = fs.readFileSync('static/script.js', 'utf-8');

// 1. Extrato File
content = content.replace(
    /const res = await fetch\('\/api\/extrato\/file'\);\s*if \(!res\.ok\) return; \/\/ ignora se no encontrar\s*const arrayBuffer = await res\.arrayBuffer\(\);\s*const data = new Uint8Array\(arrayBuffer\);/,
    "const buffer = await window.api.getExtratoFile();\n            if (!buffer) return;\n            const data = new Uint8Array(buffer);"
);
// In case the Portuguese characters got messed up in encoding:
content = content.replace(
    /const res = await fetch\('[\/]?api\/extrato\/file'\);[\s\S]*?const data = new Uint8Array\(arrayBuffer\);/,
    "const buffer = await window.api.getExtratoFile();\n            if (!buffer) return;\n            const data = new Uint8Array(buffer);"
);

// 2. Quotes
content = content.replace(
    /const res = await fetch\('[\/]?api\/quotes', \{[\s\S]*?body: JSON\.stringify\(\{ tickers: allTickers, force: forceRefresh \}\)[\s\S]*?\}\);\s*const quotes = await res\.json\(\);/,
    "const quotes = await window.api.getQuotes(allTickers, forceRefresh);"
);

// 3. Monthly prices
content = content.replace(
    /const res = await fetch\('[\/]?api\/monthly-prices', \{[\s\S]*?body: JSON\.stringify\(\{ tickers: allTickers, period: '2y' \}\)[\s\S]*?\}\);\s*rentabMonthlyPricesCache = await res\.json\(\);/,
    "rentabMonthlyPricesCache = await window.api.getMonthlyPrices(allTickers, '2y');"
);

// 4. Indices
content = content.replace(
    /const res = await fetch\('[\/]?api\/indices'\);\s*rentabIndicesCache = await res\.json\(\);/,
    "rentabIndicesCache = await window.api.getIndices();"
);

// 5. Get metas
content = content.replace(
    /const res = await fetch\('[\/]?api\/metas'\);\s*currentMetas = await res\.json\(\);/,
    "currentMetas = await window.api.getMetas();"
);

// 6. Delete meta
content = content.replace(
    /await fetch\(\/api\/metas\/\$\{metaId\},\, \{ method: 'DELETE' \}\);/,
    "await window.api.deleteMeta(metaId);"
);
// Handle double quotes fallback just to be safe
content = content.replace(
    /await fetch\(['"']\/api\/metas(?:\/|\\\$|\\\{|\w|\})*['"],\s*\{\s*method:\s*['"]DELETE['"]\s*\}\);/,
    "await window.api.deleteMeta(metaId);"
);


// 7. Create meta
content = content.replace(
    /await fetch\('[\/]?api\/metas', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ title, value_target: target \}\)\s*\}\);/,
    "await window.api.createMeta({ title, value_target: target });"
);

// 8. Update meta
content = content.replace(
    /await fetch\(\/api\/metas\/\$\{id\}\, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ title, value_target: target \}\)\s*\}\);/,
    "await window.api.updateMeta(id, { title, value_target: target });"
);

// 9. AI Analyze
content = content.replace(
    /const res = await fetch\('[\/]?api\/ai\/analyze', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(slimPortfolioData\)\s*\}\);\s*const data = await res\.json\(\);/,
    "const data = await window.api.aiAnalyze(slimPortfolioData);"
);

// 10. AI Chat
content = content.replace(
    /const res = await fetch\('[\/]?api\/ai\/chat', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*session_id: chatSessionId,\s*message: userMsg,\s*portfolio_data: slimPortfolioData\s*\}\)\s*\}\);\s*const data = await res\.json\(\);/,
    "const data = await window.api.aiChat({ session_id: chatSessionId, message: userMsg, portfolio_data: slimPortfolioData });"
);

// 11. AI Status
content = content.replace(
    /const statusRes = await fetch\('[\/]?api\/ai\/status'\);\s*const statusData = await statusRes\.json\(\);/,
    "const statusData = await window.api.aiStatus();"
);

// 12. Get Config
content = content.replace(
    /const res = await fetch\('[\/]?api\/config'\);\s*const cfg = await res\.json\(\);/,
    "const cfg = await window.api.getConfig();"
);

// 13. Save Config
content = content.replace(
    /const res = await fetch\('[\/]?api\/config', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*user_name: userName,\s*excel_path: excelPath,\s*ai_provider: aiProvider,\s*ai_api_key: aiKey\s*\}\)\s*\}\);\s*const data = await res\.json\(\);/,
    "const data = await window.api.saveConfig({ user_name: userName, excel_path: excelPath, ai_provider: aiProvider, ai_api_key: aiKey });"
);

// Add Browse button event listener right after btnCancelConfig event
content = content.replace(
    /\/\/ Cancel config/,
    // Browse Excel File
    const btnBrowseExcel = document.getElementById('btn-browse-excel');
    if (btnBrowseExcel) {
        btnBrowseExcel.addEventListener('click', async () => {
            const filePath = await window.api.selectFile({ filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }, { name: 'Todos', extensions: ['*'] }] });
            if (filePath) {
                document.getElementById('config-excel-path').value = filePath;
            }
        });
    }

    // Cancel config
);

fs.writeFileSync('renderer/script.js', content, 'utf-8');
console.log('Migrated script.js successfully!');

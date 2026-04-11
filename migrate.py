import re
import os

with open('static/script.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Extrato File
text = re.sub(
    r"const res = await fetch\('[\/]?api\/extrato\/file'\);\s*if \(!res\.ok\) return;.*?const arrayBuffer = await res\.arrayBuffer\(\);\s*const data = new Uint8Array\(arrayBuffer\);",
    "const buffer = await window.api.getExtratoFile();\n            if (!buffer) return;\n            const data = new Uint8Array(buffer);",
    text,
    flags=re.DOTALL
)

# 2. Quotes
text = re.sub(
    r"const res = await fetch\('[\/]?api\/quotes', \{.*?body: JSON\.stringify\(\{ tickers: allTickers, force: forceRefresh \}\).*?\}\);\s*const quotes = await res\.json\(\);",
    "const quotes = await window.api.getQuotes(allTickers, forceRefresh);",
    text,
    flags=re.DOTALL
)

# 3. Monthly prices
text = re.sub(
    r"const res = await fetch\('[\/]?api\/monthly-prices', \{.*?body: JSON\.stringify\(\{ tickers: allTickers, period: '2y' \}\).*?\}\);\s*rentabMonthlyPricesCache = await res\.json\(\);",
    "rentabMonthlyPricesCache = await window.api.getMonthlyPrices(allTickers, '2y');",
    text,
    flags=re.DOTALL
)

# 4. Indices
text = re.sub(
    r"const res = await fetch\('[\/]?api\/indices'\);\s*rentabIndicesCache = await res\.json\(\);",
    "rentabIndicesCache = await window.api.getIndices();",
    text
)

# 5. Get metas
text = re.sub(
    r"const res = await fetch\('[\/]?api\/metas'\);\s*currentMetas = await res\.json\(\);",
    "currentMetas = await window.api.getMetas();",
    text
)

# 6. Delete meta
text = re.sub(
    r"await fetch\(/api/metas/\$\{metaId\},\s*\{\s*method:\s*'DELETE'\s*\}\);",
    "await window.api.deleteMeta(metaId);",
    text
)
# Fallbacks for delete just in case
text = text.replace("await fetch(/api/metas/, { method: 'DELETE' });", "await window.api.deleteMeta(metaId);")

# 7. Create meta
text = re.sub(
    r"await fetch\('[\/]?api\/metas', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ title, value_target: target \}\)\s*\}\);",
    "await window.api.createMeta({ title, value_target: target });",
    text,
    flags=re.DOTALL
)

# 8. Update meta
text = re.sub(
    r"await fetch\(/api/metas/\$\{id\},\s*\{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ title, value_target: target \}\)\s*\}\);",
    "await window.api.updateMeta(id, { title, value_target: target });",
    text,
    flags=re.DOTALL
)
# fallback for update
text = text.replace("await fetch(/api/metas/, {", "await window.api.updateMeta(id, { title, value_target: target }); //")

# 9. AI Analyze
text = re.sub(
    r"const res = await fetch\('[\/]?api\/ai\/analyze', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(slimPortfolioData\)\s*\}\);\s*const data = await res\.json\(\);",
    "const data = await window.api.aiAnalyze(slimPortfolioData);",
    text,
    flags=re.DOTALL
)

# 10. AI Chat
text = re.sub(
    r"const res = await fetch\('[\/]?api\/ai\/chat', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*session_id: chatSessionId,\s*message: userMsg,\s*portfolio_data: slimPortfolioData\s*\}\)\s*\}\);\s*const data = await res\.json\(\);",
    "const data = await window.api.aiChat({ session_id: chatSessionId, message: userMsg, portfolio_data: slimPortfolioData });",
    text,
    flags=re.DOTALL
)

# 11. AI Status
text = re.sub(
    r"const statusRes = await fetch\('[\/]?api\/ai\/status'\);\s*const statusData = await statusRes\.json\(\);",
    "const statusData = await window.api.aiStatus();",
    text
)

# 12. Get Config
text = re.sub(
    r"const res = await fetch\('[\/]?api\/config'\);\s*const cfg = await res\.json\(\);",
    "const cfg = await window.api.getConfig();",
    text
)

# 13. Save Config
text = re.sub(
    r"const res = await fetch\('[\/]?api\/config', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*user_name: userName,\s*excel_path: excelPath,\s*ai_provider: aiProvider,\s*ai_api_key: aiKey\s*\}\)\s*\}\);\s*const data = await res\.json\(\);",
    "const data = await window.api.saveConfig({ user_name: userName, excel_path: excelPath, ai_provider: aiProvider, ai_api_key: aiKey });",
    text,
    flags=re.DOTALL
)

# Browse Excel Button integration
browse_code = '''// Browse Excel File
    const btnBrowseExcel = document.getElementById('btn-browse-excel');
    if (btnBrowseExcel) {
        btnBrowseExcel.addEventListener('click', async () => {
            const filePath = await window.api.selectFile({ filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }, { name: 'Todos', extensions: ['*'] }] });
            if (filePath) {
                document.getElementById('config-excel-path').value = filePath;
            }
        });
    }

    // Cancel config'''

text = text.replace('// Cancel config', browse_code)

with open('renderer/script.js', 'w', encoding='utf-8') as f:
    f.write(text)


document.addEventListener('DOMContentLoaded', () => {
    // ==== NAVEGAÇÃO ENTRE TELAS ====
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            screens.forEach(screen => screen.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                const targetScreen = document.getElementById(targetId);
                if (targetScreen) targetScreen.classList.add('active');
            }
        });
    });

    // ==== ESTADO DOS GRÁFICOS ====
    let charts = {
        evolution: null,
        allocation: null
    };

    if (typeof Chart !== 'undefined') {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
            Chart.defaults.plugins.datalabels = { display: false };
        }
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = "#9CA3AF";
        initCharts();
    }

    function initCharts() {
        const ctxEvolution = document.getElementById('evolutionBarChart');
        if (ctxEvolution) {
            charts.evolution = new Chart(ctxEvolution, {
                type: 'bar',
                data: {
                    labels: ['01/24', '02/24', '03/24', '04/24', '05/24'],
                    datasets: [{
                        label: 'Valor aplicado',
                        data: [8000, 9500, 10000, 10500, 10960],
                        backgroundColor: '#10B981', // Green
                        barThickness: 60
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 25 }
                    },
                    plugins: {
                        legend: { position: 'top', align: 'center', labels: { usePointStyle: true, boxWidth: 8 } },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            formatter: function (value) {
                                if (value === 0) return '';
                                return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                            },
                            color: '#F9FAFB',
                            font: { size: 14, weight: 'bold' }
                        }
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            grace: '20%',
                            grid: { borderDash: [4, 4], color: '#2D3748' },
                            ticks: { callback: function (value) { return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); } }
                        }
                    }
                }
            });
        }

        const ctxAllocation = document.getElementById('allocationDonutChart');
        if (ctxAllocation) {
            charts.allocation = new Chart(ctxAllocation, {
                type: 'doughnut',
                data: {
                    labels: ['FIIs', 'Ações', 'Tesouro Direto'],
                    datasets: [{
                        data: [100, 0, 0],
                        backgroundColor: ['#3B82F6', '#6366F1', '#8B5CF6'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 10, color: '#E2E8F0' } }
                    }
                }
            });
        }
    }

    // ==== AUTO-LOAD EXTRATO LOCAL ====
    async function loadLocalExtrato() {
        try {
            const res = await fetch('/api/extrato/file');
            if (!res.ok) return; // ignora se não encontrar
            const arrayBuffer = await res.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = typeof XLSX !== 'undefined' ? XLSX.read(data, { type: 'array' }) : null;
            if (workbook) {
                const firstSheetName = workbook.SheetNames[0];
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1 });
                window.b3Data = json;
                const uploadLabel = document.getElementById('btn-upload-label');
                if (uploadLabel) {
                    uploadLabel.innerHTML = `<span class="icon" style="color:#10B981">✔</span> Sincronizado`;
                }
                renderDashboards();
            }
        } catch(err) {
            console.log("Extrato local não encontrado ou erro.", err);
        }
    }

    // Chama o carregamento logo após iniciar os gráficos
    loadLocalExtrato();

    // ==== IMPORTAÇÃO EXTRATO B3 via SheetJS ====
    const excelUpload = document.getElementById('excel-upload');
    const uploadLabel = document.getElementById('btn-upload-label');

    if (excelUpload) {
        excelUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            uploadLabel.innerHTML = `<span class="icon">⌛</span> Processando...`;

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = typeof XLSX !== 'undefined' ? XLSX.read(data, { type: 'array' }) : null;
                    if (!workbook) throw new Error("SheetJS falhou");

                    const firstSheetName = workbook.SheetNames[0];
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { header: 1 });

                    window.b3Data = json;
                    renderDashboards();

                    uploadLabel.innerHTML = `<span class="icon" style="color:#10B981">✔</span> Importado`;
                } catch (err) {
                    console.error(err);
                    uploadLabel.innerHTML = `<span class="icon" style="color:#EF4444">✘</span> Erro`;
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
    const btnRefreshQuotes = document.getElementById('btn-refresh-quotes');
    if (btnRefreshQuotes) {
        btnRefreshQuotes.addEventListener('click', async () => {
            if (!window.b3Data || window.b3Data.length < 2) return;
            const originalText = btnRefreshQuotes.innerHTML;
            btnRefreshQuotes.innerHTML = `<span class="icon">⌛</span> Atualizando...`;
            await renderDashboards(true);
            btnRefreshQuotes.innerHTML = `<span class="icon" style="color:#10B981">✔</span> Atualizado`;
            setTimeout(() => { btnRefreshQuotes.innerHTML = originalText; }, 3000);
        });
    }

    async function renderDashboards(forceRefresh = false) {
        const rows = window.b3Data;
        if (!rows || rows.length < 2) return;

        let headerIndex = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            if (rows[i] && rows[i].includes && rows[i].includes("Produto")) { headerIndex = i; break; }
        }

        if (headerIndex === -1) return;

        const headers = rows[headerIndex];
        const colData = headers.findIndex(h => h === "Data");
        const colMov = headers.findIndex(h => h === "Movimentação");
        const colProd = headers.findIndex(h => h === "Produto");
        const colValor = headers.findIndex(h => h === "Valor da Operação");
        const colQuant = headers.findIndex(h => h === "Quantidade");

        if (colMov === -1 || colProd === -1 || colValor === -1) return;

        let totalPatrimonio = 0;
        let proventosTotais = 0;
        let monthsSet = new Set();

        let categories = {
            "FIIs": { total: 0, ativos: {} },
            "Ações": { total: 0, ativos: {} },
            "ETFs": { total: 0, ativos: {} },
            "Tesouro Direto": { total: 0, ativos: {} }
        };

        let monthlyInvestments = {}; // To track history for chart
        let monthlyYields = {};
        let yieldTransactions = []; // Novo tracking de rendimentos
    let investTransactions = []; // Tracking de compras/vendas para TWR

        for (let i = headerIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length <= colValor) continue;

            const movimentacao = row[colMov] ? String(row[colMov]) : "";
            const produtoStr = row[colProd] ? String(row[colProd]) : "";

            let valorNum = 0;
            if (typeof row[colValor] === "number") valorNum = row[colValor];
            else if (typeof row[colValor] === "string") valorNum = parseFloat(row[colValor].replace(/\./g, '').replace(',', '.')) || 0;

            let quantNum = 0;
            if (colQuant !== -1) {
                if (typeof row[colQuant] === "number") quantNum = row[colQuant];
                else if (typeof row[colQuant] === "string") quantNum = parseFloat(row[colQuant].replace(/\./g, '').replace(',', '.')) || 0;
            }

            if (!movimentacao || !produtoStr) continue;

            let classe = "Ações";
            const pUpper = produtoStr.toUpperCase();

            // Lista básica para identificar ETFs conhecidos antes de aplicar regra do "11"
            const isETF = pUpper.includes("BOVA") || pUpper.includes("IVVB") || pUpper.includes("HASH") || pUpper.includes("SMAL") || pUpper.includes("XINA");

            // Lógica Básica de Classificação
            if (pUpper.includes("FII ") || pUpper.includes("FUNDO DE INV IMOB") || pUpper.includes("IMOBILIARIO") || (pUpper.includes("11") && !isETF)) {
                classe = "FIIs";
            } else if (pUpper.includes("TESOURO") || pUpper.includes("CDB") || pUpper.match(/\bCRA\b/) || pUpper.match(/\bCRI\b/) || pUpper.match(/\bLCI\b/)) {
                classe = "Tesouro Direto";
            } else if (isETF) {
                classe = "ETFs";
            }

            let shortName = produtoStr.split(" - ")[0];
            if (shortName.length > 15) shortName = shortName.substring(0, 15);

            const mUpper = movimentacao.toUpperCase();
            const isCompra = mUpper.includes("COMPRA") || mUpper.includes("APLICAÇÃO") || mUpper.includes("SUBSCRIÇÃO") || mUpper.includes("TRANSFERÊNCIA - LIQUIDAÇÃO");
            const isVenda = mUpper.includes("VENDA") || mUpper.includes("RESGATE");
            const isRend = mUpper.includes("DIVIDENDO") || mUpper.includes("JUROS") || mUpper.includes("RENDIMENTO") || mUpper.includes("AMORTIZAÇÃO");


            if (isCompra || isVenda) {
                const signal = isCompra ? 1 : -1;
                const netValue = valorNum * signal;
                const netQuant = quantNum * signal;

                totalPatrimonio += netValue;
                categories[classe].total += netValue;

                if (!categories[classe].ativos[shortName]) {
                    categories[classe].ativos[shortName] = { quant: 0, totalVal: 0 };
                }
                categories[classe].ativos[shortName].quant += netQuant;
                categories[classe].ativos[shortName].totalVal += netValue;

                // Track for Evolution Chart
                let dateParts = [];
                if (row[colData]) {
                    const strD = String(row[colData]);
                    if (strD.includes('/')) dateParts = strD.split("/");
                }

                if (dateParts.length === 3) {
                    const monthYear = `${dateParts[1]}/${dateParts[2].slice(-2)}`; // MM/YY
                    const sortKey = `${dateParts[2]}${dateParts[1]}`; // YYYYMM
                    if (!monthlyInvestments[sortKey]) {
                        monthlyInvestments[sortKey] = { label: monthYear, total: 0 };
                    }
                    if (!monthlyInvestments[sortKey][classe]) monthlyInvestments[sortKey][classe] = 0;
                    
                    monthlyInvestments[sortKey].total += netValue;
                    monthlyInvestments[sortKey][classe] += netValue;

                    // Track individual transactions for TWR
                    investTransactions.push({
                        dateStr: String(row[colData]),
                        sortDate: `${dateParts[2]}${dateParts[1]}${dateParts[0]}`,
                        monthKey: sortKey,
                        ticker: shortName,
                        assetClass: classe,
                        quant: netQuant,
                        value: netValue,
                        type: isCompra ? 'buy' : 'sell'
                    });
                }

            } else if (isRend) {
                proventosTotais += valorNum;
                let dateParts = [];
                let paymentDate = row[colData] ? String(row[colData]) : "";
                if (paymentDate.includes('/')) dateParts = paymentDate.split("/");
                
                if (dateParts.length === 3) {
                    monthsSet.add(dateParts[1] + "-" + dateParts[2]);
                    const monthYear = `${dateParts[1]}/${dateParts[2].slice(-2)}`; // MM/YY
                    const sortKey = `${dateParts[2]}${dateParts[1]}`; // YYYYMM
                    if (!monthlyYields[sortKey]) {
                        monthlyYields[sortKey] = { label: monthYear, total: 0 };
                    }
                    if (!monthlyYields[sortKey][classe]) monthlyYields[sortKey][classe] = 0;
                    
                    monthlyYields[sortKey].total += valorNum;
                    monthlyYields[sortKey][classe] += valorNum;

                    // Salva histórico de todas as transações de proventos
                    yieldTransactions.push({
                        dateStr: paymentDate,         // ex: 15/03/2026
                        sortDate: `${dateParts[2]}${dateParts[1]}${dateParts[0]}`, // 20260315
                        monthKey: sortKey,            // 202603
                        yearKey: dateParts[2],        // 2026
                        monthStr: dateParts[1],       // 03
                        ticker: shortName,            // BTLG11
                        assetClass: classe,           // FIIs
                        type: movimentacao,           // DIVIDENDO, RENDIMENTO
                        quant: quantNum,              // 100
                        valTotal: valorNum            // 80.00
                    });
                }
            }
        }

        // ---------------- OBTENÇÃO DO PREÇO ATUAL ----------------
        let allTickers = [];
        Object.keys(categories).forEach(cat => {
            Object.keys(categories[cat].ativos).forEach(t => {
                if (categories[cat].ativos[t].quant > 0) {
                    allTickers.push(t);
                }
            });
        });

        let currentPatrimonioReal = 0;

        if (allTickers.length > 0) {
            try {
                const res = await fetch('/api/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tickers: allTickers, force: forceRefresh })
                });
                const quotes = await res.json();

                Object.keys(categories).forEach(cat => {
                    let catRealTotal = 0;
                    Object.keys(categories[cat].ativos).forEach(t => {
                        const ativo = categories[cat].ativos[t];
                        ativo.investedVal = ativo.totalVal; // Original cost basis

                        if (quotes[t] !== undefined) {
                            ativo.currentPrice = quotes[t];
                            ativo.totalVal = ativo.quant * quotes[t]; // New market value
                        } else {
                            ativo.currentPrice = ativo.quant > 0 ? (ativo.investedVal / ativo.quant) : 0;
                        }

                        catRealTotal += ativo.totalVal;
                    });
                    categories[cat].investedTotal = categories[cat].total;
                    categories[cat].total = catRealTotal;
                    currentPatrimonioReal += catRealTotal;
                });
            } catch (e) {
                console.error("Erro em market_data_service:", e);
                currentPatrimonioReal = totalPatrimonio;
            }
        } else {
            currentPatrimonioReal = totalPatrimonio;
        }

        const ganhoCapital = currentPatrimonioReal - totalPatrimonio;
        const lucroTotal = proventosTotais + ganhoCapital;

        document.getElementById('val-patrimonio').textContent = currentPatrimonioReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('val-investido').textContent = totalPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        document.getElementById('val-lucro').textContent = lucroTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const isPos = ganhoCapital >= 0;
        const capEl = document.getElementById('val-ganho-cap');
        capEl.textContent = ganhoCapital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + (isPos ? " ↗" : " ↘");
        capEl.style.color = isPos ? "var(--primary-color)" : "var(--danger-color)";

        document.getElementById('val-div-total').textContent = proventosTotais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('val-prov-12m').textContent = proventosTotais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('val-prov-total').textContent = proventosTotais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Armazena dados no estado global para filtro dinâmico
        window.dashboardState = {
            categories: categories,
            monthlyInvestments: monthlyInvestments,
            monthlyYields: monthlyYields,
            yieldTransactions: yieldTransactions,
            investTransactions: investTransactions,
            proventosTotais: proventosTotais
        };

        window.proventoFilters = window.proventoFilters || {
            viewType: 'Mensal',
            selectedYear: 'Todos',
            selectedType: 'Todos'
        };

        populateFilters();
        updateFilteredCharts();
        renderProventosScreen();
        renderRentabilidadeScreen();

        renderAssetsAccordion(categories, currentPatrimonioReal);

        // ---- INTEGRAÇÃO DIRETA COM AS METAS ----
        // Reload metas after B3 data is available so applyB3DataToMetas() calculates values
        loadMetas();
    }

    // --- FUNÇÕES DE FILTRAGEM ---
    function populateFilters() {
        if (!window.dashboardState) return;
        const { categories } = window.dashboardState;
        
        let activeCategories = [];
        Object.keys(categories).forEach(catName => {
            const cat = categories[catName];
            const activeKeys = Object.keys(cat.ativos).filter(k => cat.ativos[k].quant > 0 || cat.ativos[k].totalVal > 0 || cat.ativos[k].investedVal > 0);
            if (activeKeys.length > 0 || cat.total > 0) {
                activeCategories.push(catName);
            }
        });

        const evolFilter = document.getElementById('evol_type_filter');
        const allocFilter = document.getElementById('alloc_type_filter');

        const updateSelectOptions = (selectEl, list) => {
            if (!selectEl) return;
            const currentVal = selectEl.value;
            selectEl.innerHTML = '<option value="Todos">Todos os tipos</option>';
            list.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                selectEl.appendChild(opt);
            });
            if (list.includes(currentVal) || currentVal === "Todos") {
                selectEl.value = currentVal;
            } else {
                selectEl.value = "Todos";
            }
        };

        updateSelectOptions(evolFilter, activeCategories);
        updateSelectOptions(allocFilter, activeCategories);

        // Filtros de Proventos
        const provTypeFilter = document.getElementById('prov-filter-tipo');
        if (provTypeFilter) {
            updateSelectOptions(provTypeFilter, activeCategories);
        }

        const provYearFilter = document.getElementById('prov-filter-ano');
        if (provYearFilter) {
            const { yieldTransactions } = window.dashboardState;
            const years = [...new Set(yieldTransactions.map(t => t.yearKey))].sort((a, b) => b.localeCompare(a));
            const currentYearVal = provYearFilter.value;
            provYearFilter.innerHTML = '<option value="Todos">Ano: Todos</option>';
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = `Ano: ${y}`;
                provYearFilter.appendChild(opt);
            });
            if (years.includes(currentYearVal) || currentYearVal === "Todos") {
                provYearFilter.value = currentYearVal;
            } else {
                provYearFilter.value = "Todos";
            }
        }
    }

    function updateFilteredCharts() {
        if (!window.dashboardState || !charts) return;
        const { categories, monthlyInvestments, monthlyYields } = window.dashboardState;

        // ---- Allocation Donut Chart ----
        const allocFilterVal = document.getElementById('alloc_type_filter')?.value || "Todos";
        let allocLabels = [];
        let allocData = [];
        let allocBgColors = [];

        if (allocFilterVal === "Todos") {
            Object.keys(categories).forEach(c => {
                if (categories[c].total > 0) {
                    allocLabels.push(c);
                    allocData.push(categories[c].total);
                }
            });
            allocBgColors = ['#3B82F6', '#6366F1', '#8B5CF6', '#10B981'].slice(0, allocData.length);
        } else {
            const cat = categories[allocFilterVal];
            if (cat) {
                Object.keys(cat.ativos).forEach(ticker => {
                    const ativo = cat.ativos[ticker];
                    if (ativo.totalVal > 0) {
                        allocLabels.push(ticker);
                        allocData.push(ativo.totalVal);
                    }
                });
            }
            allocBgColors = allocLabels.map((_, i) => `hsl(${(i * 137.5) % 360}, 70%, 50%)`);
        }

        if (charts.allocation) {
            if (allocData.length > 0) {
                charts.allocation.data.labels = allocLabels;
                charts.allocation.data.datasets[0].data = allocData;
                charts.allocation.data.datasets[0].backgroundColor = allocBgColors;
                charts.allocation.update();
            } else {
                charts.allocation.data.labels = [];
                charts.allocation.data.datasets[0].data = [];
                charts.allocation.update();
            }
        }

        // ---- Evolution Column Chart ----
        const evolFilterVal = document.getElementById('evol_type_filter')?.value || "Todos";
        
        if (charts.evolution) {
            const allMonthsSet = new Set([...Object.keys(monthlyInvestments), ...Object.keys(monthlyYields)]);
            const sortedKeys = Array.from(allMonthsSet).sort();
            const evolLabels = [];
            const evolInvestments = [];
            const evolYields = [];
            
            sortedKeys.forEach(k => {
                let monthLabel = monthlyInvestments[k] ? monthlyInvestments[k].label : (monthlyYields[k] ? monthlyYields[k].label : k);
                evolLabels.push(monthLabel);
                
                let invVal = 0;
                let yldVal = 0;
                
                if (evolFilterVal === "Todos") {
                    invVal = monthlyInvestments[k] ? monthlyInvestments[k].total : 0;
                    yldVal = monthlyYields[k] ? monthlyYields[k].total : 0;
                } else {
                    invVal = (monthlyInvestments[k] && monthlyInvestments[k][evolFilterVal]) ? monthlyInvestments[k][evolFilterVal] : 0;
                    yldVal = (monthlyYields[k] && monthlyYields[k][evolFilterVal]) ? monthlyYields[k][evolFilterVal] : 0;
                }

                evolInvestments.push(invVal);
                evolYields.push(yldVal);
            });
            
            if (evolLabels.length > 0) {
                charts.evolution.data.labels = evolLabels;
                charts.evolution.data.datasets = [
                    {
                        label: 'Aportes Mensais',
                        data: evolInvestments,
                        backgroundColor: '#10B981',
                        barThickness: 30
                    },
                    {
                        label: 'Rendimentos Mensais',
                        data: evolYields,
                        backgroundColor: '#3B82F6',
                        barThickness: 30
                    }
                ];
                charts.evolution.update();
            } else {
                charts.evolution.data.labels = [];
                charts.evolution.data.datasets = [];
                charts.evolution.update();
            }
        }
    }

    if (!window.filtersAttached) {
        document.getElementById('evol_type_filter')?.addEventListener('change', updateFilteredCharts);
        document.getElementById('alloc_type_filter')?.addEventListener('change', updateFilteredCharts);

        // Event Listeners para Proventos
        document.getElementById('prov-filter-tipo')?.addEventListener('change', (e) => {
            window.proventoFilters.selectedType = e.target.value;
            renderProventosScreen();
        });

        document.getElementById('prov-filter-ano')?.addEventListener('change', (e) => {
            window.proventoFilters.selectedYear = e.target.value;
            renderProventosScreen();
        });

        const btnMensal = document.getElementById('prov-btn-mensal');
        const btnAnual = document.getElementById('prov-btn-anual');

        if (btnMensal && btnAnual) {
            btnMensal.addEventListener('click', () => {
                window.proventoFilters.viewType = 'Mensal';
                btnMensal.classList.add('active');
                btnAnual.classList.remove('active');
                renderProventosScreen();
            });
            btnAnual.addEventListener('click', () => {
                window.proventoFilters.viewType = 'Anual';
                btnAnual.classList.add('active');
                btnMensal.classList.remove('active');
                renderProventosScreen();
            });
        }

        window.filtersAttached = true;
    }

    function renderAssetsAccordion(categories, globalTotal) {
        const container = document.getElementById('assets-list-container');
        container.innerHTML = '';

        let totalAssetsCount = 0;

        const classIcons = { "FIIs": "🏢", "Ações": "💲", "ETFs": "📈", "Tesouro Direto": "🏫" };

        Object.keys(categories).forEach(catName => {
            const cat = categories[catName];
            const activeKeys = Object.keys(cat.ativos).filter(k => cat.ativos[k].quant > 0 || cat.ativos[k].totalVal > 0);

            // Renderiza mesmo que não tenha ativos ativados para simular o layout (0 ativos)
            totalAssetsCount += activeKeys.length;

            const template = document.getElementById('template-asset-group');
            const clone = template.content.cloneNode(true);

            const groupDiv = clone.querySelector('.asset-group');
            clone.querySelector('.group-name').textContent = catName;
            clone.querySelector('.group-icon').textContent = classIcons[catName] || "💼";

            const header = clone.querySelector('.asset-group-header');

            clone.querySelector('.qtty').textContent = activeKeys.length;
            clone.querySelector('.total-val').textContent = cat.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const pctCarteira = globalTotal > 0 ? ((cat.total / globalTotal) * 100).toFixed(0) : 0;
            clone.querySelector('.part-pct').textContent = `⌚ ${pctCarteira}% / 25%`; // Mocking 25% ideal

            header.addEventListener('click', () => {
                groupDiv.classList.toggle('expanded');
            });

            // Populate Table
            const tbody = clone.querySelector('.table-body');
            if (activeKeys.length === 0) {
                tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color: var(--text-tertiary)">Nenhum ativo nesta categoria.</td></tr>`;
            } else {
                activeKeys.forEach(ticker => {
                    const ativo = cat.ativos[ticker];
                    const avgPrice = ativo.quant > 0 ? ((ativo.investedVal !== undefined ? ativo.investedVal : ativo.totalVal) / ativo.quant) : 0;
                    const currentPrice = ativo.currentPrice || avgPrice;

                    const isPos = currentPrice >= avgPrice;
                    const pctDiff = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div class="asset-table-ticker">
                                <div class="asset-table-icon">🏢</div>
                                <span style="font-weight: 600;">${ticker}</span>
                            </div>
                        </td>
                        <td>${ativo.quant.toLocaleString('pt-BR')}</td>
                        <td>${avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td>${currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <span style="font-size: 0.6rem; color: var(--text-tertiary)">✍️</span></td>
                        <td><span class="badge-trend ${isPos ? 'positive' : 'negative'}">${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(2)}% ${isPos ? '▴' : '▾'}</span></td>
                        <td><span style="color:var(--warning-color); font-weight:600;">0% →</span></td>
                        <td>${ativo.totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ${isPos ? '↗' : '↘'}</td>
                        <td><span style="background:var(--bg-app); padding:4px 8px; border-radius:4px;">10</span></td>
                        <td>${globalTotal > 0 ? ((ativo.totalVal / globalTotal) * 100).toFixed(2) : 0}%</td>
                        <td>6,25%</td>
                        <td><span class="buy-badge">⊗ Não</span></td>
                        <td style="text-align:center; color: var(--text-tertiary); cursor:pointer;">•••</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            container.appendChild(clone);
        });

        document.getElementById('total-assets-count').textContent = `(${totalAssetsCount})`;
    }

    function renderProventosScreen() {
        if (!window.dashboardState) return;
        const { yieldTransactions, proventosTotais } = window.dashboardState;
        const filters = window.proventoFilters || { viewType: 'Mensal', selectedYear: 'Todos', selectedType: 'Todos' };
        
        // 1. Filtragem Inicial
        let txs = [...yieldTransactions];
        if (filters.selectedType !== 'Todos') {
            txs = txs.filter(t => t.assetClass === filters.selectedType);
        }
        if (filters.selectedYear !== 'Todos') {
            txs = txs.filter(t => t.yearKey === filters.selectedYear);
        }

        // Ordena histórico em ordem decrescente (mais recente primeiro)
        txs.sort((a, b) => b.sortDate.localeCompare(a.sortDate));
        
        // ----- Popula Sidebar (Estes valores refletem o filtro de TIPO, mas geralmente mostram os últimos 12 meses globais se ano=Todos) -----
        let sidebarTxs = [...yieldTransactions]; // Sidebar costuma ser global ou seguir apenas o tipo
        if (filters.selectedType !== 'Todos') {
            sidebarTxs = sidebarTxs.filter(t => t.assetClass === filters.selectedType);
        }
        
        const sidebarTotal = sidebarTxs.reduce((acc, t) => acc + t.valTotal, 0);
        document.getElementById('prov-total-carteira').textContent = sidebarTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Identifica meses consolidados para extrair os últimos 12 meses
        const monthKeys = [...new Set(txs.map(t => t.monthKey))].sort((a,b) => b.localeCompare(a));
        const last12Keys = monthKeys.slice(0, 12);
        
        let total12m = 0;
        let yieldsByAsset = {};
        
        txs.forEach(t => {
            if (last12Keys.includes(t.monthKey)) {
                total12m += t.valTotal;
                if (!yieldsByAsset[t.ticker]) yieldsByAsset[t.ticker] = 0;
                yieldsByAsset[t.ticker] += t.valTotal;
            }
        });
        
        const media12m = last12Keys.length > 0 ? (total12m / last12Keys.length) : 0;
        document.getElementById('prov-total-12m').textContent = total12m.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('prov-media-12m').textContent = media12m.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        // Donut Chart - Distribuição em 12 meses
        const donutCtx = document.getElementById('proventosDonutChart');
        if (donutCtx) {
            const sortedAssets = Object.entries(yieldsByAsset).sort((a,b) => b[1] - a[1]);
            // Take top 5 and group rest in "Outros" se for grande
            let dLabels = sortedAssets.map(i => i[0]);
            let dData = sortedAssets.map(i => i[1]);
            
            if (dLabels.length > 5) {
                dLabels = sortedAssets.slice(0, 5).map(i => i[0]);
                dLabels.push('Outros');
                
                let mainData = sortedAssets.slice(0, 5).map(i => i[1]);
                let otherSum = sortedAssets.slice(5).reduce((acc, curr) => acc + curr[1], 0);
                mainData.push(otherSum);
                dData = mainData;
            }

            const dColors = dLabels.map((_, i) => `hsl(${(i * 55 + 200) % 360}, 75%, 55%)`);
            
            if (charts.proventosDonut) {
                charts.proventosDonut.data.labels = dLabels;
                charts.proventosDonut.data.datasets[0].data = dData;
                charts.proventosDonut.data.datasets[0].backgroundColor = dColors;
                charts.proventosDonut.update();
            } else {
                charts.proventosDonut = new Chart(donutCtx, {
                    type: 'doughnut',
                    data: {
                        labels: dLabels,
                        datasets: [{ data: dData, backgroundColor: dColors, borderWidth: 0, hoverOffset: 4 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { 
                        legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, color: '#E2E8F0', font: { size: 11 } } }, 
                        datalabels: { display:false } 
                    } }
                });
            }
        }
        
        // ----- Bar Chart de Evolução Dinâmico (Meses ou Anos) -----
        let grouping = {};
        txs.forEach(t => {
            let key, label;
            if (filters.viewType === 'Anual') {
                key = t.yearKey;
                label = t.yearKey;
            } else {
                key = t.monthKey;
                label = `${t.monthStr}/${t.yearKey}`;
            }
            
            if (!grouping[key]) grouping[key] = { val: 0, sortString: key, label: label };
            grouping[key].val += t.valTotal;
        });

        const barDataArr = Object.values(grouping).sort((a,b) => a.sortString.localeCompare(b.sortString));
        // Se mensal, mostra últimos 12. Se anual, mostra todos os anos.
        const limitedBarData = filters.viewType === 'Mensal' ? barDataArr.slice(-12) : barDataArr;

        const barLabels = limitedBarData.map(i => i.label);
        const barValues = limitedBarData.map(i => i.val);
        
        const barCtx = document.getElementById('proventosBarChart');
        if (barCtx) {
            if (charts.proventosBar) {
                charts.proventosBar.data.labels = barLabels;
                charts.proventosBar.data.datasets[0].data = barValues;
                charts.proventosBar.update();
            } else {
                charts.proventosBar = new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: barLabels,
                        datasets: [{ label: 'Proventos Recebidos', data: barValues, backgroundColor: '#4A7CDE', barThickness: 'flex', maxBarThickness: 50 }]
                    },
                    options: { 
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, datalabels: { display: true, anchor: 'end', align: 'top', color: '#E2E8F0', formatter: (val) => val > 0 ? val.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '' } },
                        scales: { x: { grid: { display: false } }, y: { grace: '15%', grid: { borderDash: [4,4], color: '#2D3748' }, ticks: { callback: v => v.toLocaleString('pt-BR') } } }
                    }
                });
            }
        }
        
        // ----- Histórico Mensal (Matriz Ano x Mês) -----
        const yearsSet = new Set(txs.map(t => t.yearKey));
        const sortedYears = [...yearsSet].sort((a,b) => b.localeCompare(a));
        const histTbody = document.getElementById('prov-hist-tbody');
        if (histTbody) {
            histTbody.innerHTML = '';
            let superTotal = 0;
            if (sortedYears.length > 0) {
                sortedYears.forEach(y => {
                    let yTxs = txs.filter(t => t.yearKey === y);
                    let mSums = Array(12).fill(0);
                    let yTotal = 0;
                    yTxs.forEach(t => {
                        let mIdx = parseInt(t.monthStr, 10) - 1;
                        mSums[mIdx] += t.valTotal;
                        yTotal += t.valTotal;
                    });
                    superTotal += yTotal;
                    let mStr = mSums.map(v => `<td>${v > 0 ? v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0,00'}</td>`).join('');
                    let yAvg = yTotal / 12; // média crua dividindo por 12 (mesmo com meses zerados)
                    histTbody.innerHTML += `<tr>
                        <td style="font-weight:bold; color:var(--text-primary);">${y}</td>
                        ${mStr}
                        <td style="color:var(--text-secondary)">${yAvg.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                        <td style="font-weight:bold; color:var(--text-primary);">${yTotal.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>`;
                });
            } else {
                histTbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding: 20px;">Nenhum histórico encontrado.</td></tr>`;
            }
            document.getElementById('prov-hist-total').textContent = superTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        
        // ----- Lista Detalhada "Meus Proventos" -----
        const listTbody = document.getElementById('prov-list-tbody');
        if (listTbody) {
            listTbody.innerHTML = '';
            let lTotal = 0;
            if (txs.length > 0) {
                // Monta tabela pegando todos (opcionalmente adicionar paginação depois se for gigante)
                txs.forEach(t => {
                    lTotal += t.valTotal;
                    let divValStr = t.quant > 0 ? (t.valTotal / t.quant).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-';
                    let qStr = t.quant > 0 ? t.quant.toLocaleString('pt-BR') : '-';
                    
                    listTbody.innerHTML += `<tr>
                        <td>
                            <div class="asset-table-ticker">
                                <div class="asset-table-icon" style="width:24px; height:24px; font-size:12px;">📊</div>
                                <span style="font-weight: 600;">${t.ticker}</span>
                            </div>
                        </td>
                        <td><span class="div-type-badge">${t.assetClass || '-'}</span></td>
                        <td><span class="status-badge pago">Pago</span></td>
                        <td style="color:var(--text-secondary)">${t.type}</td>
                        <td style="color:var(--text-tertiary);">-</td>
                        <td style="color:var(--text-primary);">${t.dateStr}</td>
                        <td>${qStr}</td>
                        <td>${divValStr}</td>
                        <td style="font-weight:600; color:var(--text-primary)">${t.valTotal.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</td>
                    </tr>`;
                });
            } else {
                listTbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">Nenhum provento recebido ainda.</td></tr>`;
            }
            document.getElementById('prov-list-total').textContent = lTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    }


    // ==== RENTABILIDADE SCREEN ====
    let rentabIndicesCache = null;
    let rentabMonthlyPricesCache = null;

    async function renderRentabilidadeScreen() {
        if (!window.dashboardState) return;
        const { investTransactions, categories } = window.dashboardState;
        if (!investTransactions || investTransactions.length === 0) return;

        // Get all tickers with positive holdings
        const allTickers = [];
        Object.keys(categories).forEach(cat => {
            Object.keys(categories[cat].ativos).forEach(t => {
                if (categories[cat].ativos[t].quant > 0) allTickers.push(t);
            });
        });
        if (allTickers.length === 0) return;

        // Fetch monthly prices for portfolio assets (cached)
        if (!rentabMonthlyPricesCache) {
            try {
                const res = await fetch('/api/monthly-prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tickers: allTickers, period: '2y' })
                });
                rentabMonthlyPricesCache = await res.json();
            } catch (e) {
                console.error("Error fetching monthly prices:", e);
                rentabMonthlyPricesCache = {};
            }
        }

        // Fetch indices data (cached)
        if (!rentabIndicesCache) {
            try {
                const res = await fetch('/api/indices');
                rentabIndicesCache = await res.json();
            } catch (e) {
                console.error("Error fetching indices:", e);
                rentabIndicesCache = {};
            }
        }

        // Calculate TWR
        const monthlyReturns = calculateTWR(investTransactions, rentabMonthlyPricesCache, categories);
        
        // Store for filters
        window.rentabState = {
            monthlyReturns: monthlyReturns,
            indices: rentabIndicesCache,
            monthlyPrices: rentabMonthlyPricesCache
        };

        renderRentabChart(monthlyReturns, rentabIndicesCache);
        renderRentabKPIs(monthlyReturns, rentabIndicesCache);
        renderRentabTable(monthlyReturns);
    }

    function generateMonthRange(startKey, endKey) {
        // startKey/endKey format: YYYYMM
        const months = [];
        let year = parseInt(startKey.substring(0, 4));
        let month = parseInt(startKey.substring(4, 6));
        const endYear = parseInt(endKey.substring(0, 4));
        const endMonth = parseInt(endKey.substring(4, 6));

        while (year < endYear || (year === endYear && month <= endMonth)) {
            months.push(`${year}${String(month).padStart(2, '0')}`);
            month++;
            if (month > 12) { month = 1; year++; }
        }
        return months;
    }

    function calculateTWR(investTxs, monthlyPrices, categories) {
        // Sort transactions by date
        const txs = [...investTxs].sort((a, b) => a.sortDate.localeCompare(b.sortDate));
        if (txs.length === 0) return {};

        const firstMonth = txs[0].monthKey;
        const now = new Date();
        const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const allMonths = generateMonthRange(firstMonth, currentMonth);

        // Build holdings timeline and calculate returns
        let holdings = {}; // ticker -> quantity
        let monthlyReturns = {}; // YYYY-MM -> return %

        // Helper to get price for a ticker at a given YYYY-MM
        function getPrice(ticker, yyyyMM) {
            if (monthlyPrices[ticker] && monthlyPrices[ticker][yyyyMM] !== undefined) {
                return monthlyPrices[ticker][yyyyMM];
            }
            // Try current price from categories
            for (const cat of Object.keys(categories)) {
                if (categories[cat].ativos[ticker] && categories[cat].ativos[ticker].currentPrice) {
                    return categories[cat].ativos[ticker].currentPrice;
                }
            }
            return null;
        }

        // Helper to value portfolio
        function valuePortfolio(h, yyyyMM) {
            let total = 0;
            Object.keys(h).forEach(ticker => {
                if (h[ticker] > 0) {
                    const price = getPrice(ticker, yyyyMM);
                    if (price !== null) total += h[ticker] * price;
                }
            });
            return total;
        }

        let prevMonthKey = null;

        allMonths.forEach((monthKey) => {
            const yyyyMM = `${monthKey.substring(0, 4)}-${monthKey.substring(4, 6)}`;

            // Start value = portfolio valued at start of month (end of previous month)
            let startValue = 0;
            if (prevMonthKey) {
                const prevYYYYMM = `${prevMonthKey.substring(0, 4)}-${prevMonthKey.substring(4, 6)}`;
                startValue = valuePortfolio(holdings, prevYYYYMM);
            }

            // Apply this month's transactions
            const monthTxs = txs.filter(t => t.monthKey === monthKey);
            let netFlow = 0;
            monthTxs.forEach(t => {
                if (!holdings[t.ticker]) holdings[t.ticker] = 0;
                holdings[t.ticker] += t.quant;
                netFlow += t.value; // positive for buys, negative for sells
            });

            // End value = portfolio valued at end of month
            const endValue = valuePortfolio(holdings, yyyyMM);

            // Modified Dietz return
            const denominator = startValue + netFlow;
            if (denominator > 0 && endValue > 0) {
                monthlyReturns[yyyyMM] = ((endValue / denominator) - 1) * 100;
            } else if (netFlow > 0 && endValue > 0) {
                // First investment month
                monthlyReturns[yyyyMM] = ((endValue / netFlow) - 1) * 100;
            } else {
                monthlyReturns[yyyyMM] = 0;
            }

            prevMonthKey = monthKey;
        });

        return monthlyReturns;
    }

    function renderRentabChart(monthlyReturns, indices) {
        const sortedMonths = Object.keys(monthlyReturns).sort();
        if (sortedMonths.length === 0) return;

        // Build cumulative returns for portfolio
        const labels = sortedMonths.map(m => {
            const parts = m.split('-');
            return `${parts[1]}/${parts[0].slice(-2)}`;
        });

        function buildCumulativeReturns(monthlyMap, months) {
            let cumulative = [];
            let product = 1;
            months.forEach(m => {
                const ret = monthlyMap[m] !== undefined ? monthlyMap[m] : 0;
                product *= (1 + ret / 100);
                cumulative.push(Math.round((product - 1) * 10000) / 100);
            });
            return cumulative;
        }

        const portfolioCum = buildCumulativeReturns(monthlyReturns, sortedMonths);

        const indexConfig = [
            { key: 'CDI', color: '#F59E0B', dash: [] },
            { key: 'IPCA', color: '#94A3B8', dash: [5, 5] },
            { key: 'IBOV', color: '#6366F1', dash: [5, 5] },
            { key: 'IFIX', color: '#8B5CF6', dash: [5, 5] },
            { key: 'SMLL', color: '#EC4899', dash: [5, 5] },
            { key: 'IDIV', color: '#14B8A6', dash: [5, 5] },
            { key: 'IVVB11', color: '#F97316', dash: [5, 5] }
        ];

        const datasets = [{
            label: 'Rentabilidade',
            data: portfolioCum,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: '#3B82F6'
        }];

        indexConfig.forEach(cfg => {
            if (indices[cfg.key] && Object.keys(indices[cfg.key]).length > 0) {
                const cumData = buildCumulativeReturns(indices[cfg.key], sortedMonths);
                datasets.push({
                    label: cfg.key,
                    data: cumData,
                    borderColor: cfg.color,
                    borderWidth: 1.5,
                    borderDash: cfg.dash,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: cfg.color
                });
            }
        });

        const ctx = document.getElementById('rentabilidadeLineChart');
        if (!ctx) return;

        if (charts.rentabLine) {
            charts.rentabLine.data.labels = labels;
            charts.rentabLine.data.datasets = datasets;
            charts.rentabLine.update();
        } else {
            charts.rentabLine = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        datalabels: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(31,36,42,0.95)',
                            titleColor: '#E2E8F0',
                            bodyColor: '#E2E8F0',
                            borderColor: '#2D3748',
                            borderWidth: 1,
                            padding: 12,
                            callbacks: {
                                label: function (context) {
                                    return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#64748B', font: { size: 11 } }
                        },
                        y: {
                            grid: { borderDash: [4, 4], color: '#2D3748' },
                            ticks: {
                                color: '#64748B',
                                callback: v => v.toFixed(2)
                            }
                        }
                    }
                }
            });
        }
    }

    function renderRentabKPIs(monthlyReturns, indices) {
        const sortedMonths = Object.keys(monthlyReturns).sort();
        if (sortedMonths.length === 0) return;

        // Total cumulative
        let totalProduct = 1;
        sortedMonths.forEach(m => {
            totalProduct *= (1 + (monthlyReturns[m] || 0) / 100);
        });
        const totalReturn = (totalProduct - 1) * 100;

        // Last 12 months
        const last12 = sortedMonths.slice(-12);
        let last12Product = 1;
        last12.forEach(m => {
            last12Product *= (1 + (monthlyReturns[m] || 0) / 100);
        });
        const last12Return = (last12Product - 1) * 100;

        // Last month
        const lastMonth = sortedMonths[sortedMonths.length - 1];
        const lastMonthReturn = monthlyReturns[lastMonth] || 0;

        // CDI comparison
        let cdiTotal = 1, cdi12 = 1, cdiLastMonth = 0;
        if (indices.CDI) {
            sortedMonths.forEach(m => {
                cdiTotal *= (1 + (indices.CDI[m] || 0) / 100);
            });
            last12.forEach(m => {
                cdi12 *= (1 + (indices.CDI[m] || 0) / 100);
            });
            cdiLastMonth = indices.CDI[lastMonth] || 0;
        }
        const cdiTotalPct = (cdiTotal - 1) * 100;
        const cdi12Pct = (cdi12 - 1) * 100;

        function updateKPI(elId, benchId, value, benchValue) {
            const el = document.getElementById(elId);
            if (el) {
                el.textContent = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
            }
            const trendIcon = el?.parentElement?.querySelector('.rentab-trend-icon');
            if (trendIcon) {
                trendIcon.textContent = value >= 0 ? '↗' : '↘';
                trendIcon.className = `rentab-trend-icon ${value >= 0 ? 'positive' : 'negative'}`;
            }
            const benchEl = document.getElementById(benchId);
            if (benchEl && benchValue > 0) {
                const pctOfCDI = benchValue > 0 ? ((value / benchValue) * 100) : 0;
                const diff = Math.abs(100 - pctOfCDI).toFixed(2);
                const above = pctOfCDI >= 100;
                benchEl.innerHTML = `<option value="CDI">${diff}% ${above ? 'acima' : 'abaixo'} do CDI</option>`;
            }
        }

        updateKPI('rentab-total-pct', 'rentab-total-bench', totalReturn, cdiTotalPct);
        updateKPI('rentab-12m-pct', 'rentab-12m-bench', last12Return, cdi12Pct);
        updateKPI('rentab-1m-pct', 'rentab-1m-bench', lastMonthReturn, cdiLastMonth);
    }

    function renderRentabTable(monthlyReturns) {
        const tbody = document.getElementById('rentab-monthly-tbody');
        if (!tbody) return;

        const sortedMonths = Object.keys(monthlyReturns).sort();
        if (sortedMonths.length === 0) {
            tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding: 20px;">Nenhum dado disponível.</td></tr>`;
            return;
        }

        // Group by year
        const byYear = {};
        sortedMonths.forEach(m => {
            const [year, month] = m.split('-');
            if (!byYear[year]) byYear[year] = {};
            byYear[year][parseInt(month)] = monthlyReturns[m];
        });

        const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
        let cumulativeProduct = 1;

        // Calculate cumulative in chronological order
        const cumByYear = {};
        const chronoYears = [...years].reverse();
        chronoYears.forEach(year => {
            let yearProduct = 1;
            for (let m = 1; m <= 12; m++) {
                if (byYear[year][m] !== undefined) {
                    const ret = byYear[year][m];
                    yearProduct *= (1 + ret / 100);
                    cumulativeProduct *= (1 + ret / 100);
                }
            }
            cumByYear[year] = {
                yearReturn: (yearProduct - 1) * 100,
                cumReturn: (cumulativeProduct - 1) * 100
            };
        });

        tbody.innerHTML = '';
        years.forEach(year => {
            let tr = `<td>${year}</td>`;
            for (let m = 1; m <= 12; m++) {
                const val = byYear[year][m];
                if (val !== undefined) {
                    const cls = val > 0.001 ? 'rentab-positive' : (val < -0.001 ? 'rentab-negative' : 'rentab-zero');
                    tr += `<td class="${cls}">${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>`;
                } else {
                    tr += `<td class="rentab-zero">-</td>`;
                }
            }
            const yearRet = cumByYear[year].yearReturn;
            const cumRet = cumByYear[year].cumReturn;
            const yrCls = yearRet > 0.001 ? 'rentab-positive' : (yearRet < -0.001 ? 'rentab-negative' : 'rentab-zero');
            tr += `<td class="rentab-acum-cell">${yearRet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>`;
            tr += `<td class="rentab-acum-cell">${cumRet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>`;
            tbody.innerHTML += `<tr>${tr}</tr>`;
        });
    }


    // Call initial empty render
    renderDashboards();

    // ==== GESTÃO DE METAS (REESCRITA COMPLETA) ====
    const metaModal = document.getElementById('meta-modal');
    const inputMetaId = document.getElementById('edit-meta-id');
    const inputMetaName = document.getElementById('edit-meta-name');
    const inputMetaTarget = document.getElementById('edit-meta-target');
    const btnCancelMeta = document.getElementById('btn-cancel-meta');
    const btnSaveMeta = document.getElementById('btn-save-meta');
    const modalTitle = document.getElementById('modal-title');

    let currentMetas = [];
    let isCreatingMeta = false;

    // Auto-calculates value_current for known meta types using B3 data
    function applyB3DataToMetas() {
        if (!window.dashboardState || currentMetas.length === 0) return;
        
        const { categories, yieldTransactions, investTransactions, proventosTotais } = window.dashboardState;
        
        // Calculate patrimônio atual
        let currentPatrimonio = 0;
        Object.keys(categories).forEach(cat => {
            currentPatrimonio += categories[cat].total || 0;
        });

        // Calculate média mensal de proventos
        const monthsSet = new Set(yieldTransactions?.map(t => t.monthKey) || []);
        const avgProv = monthsSet.size > 0 ? (proventosTotais / monthsSet.size) : 0;

        // Calculate aportes
        const now = new Date();
        const currentYear = String(now.getFullYear());
        const currentMonthKey = `${currentYear}${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        let aporteAnual = 0;
        let aportesMensais = {};
        (investTransactions || []).forEach(t => {
            if (t.type === 'buy' && t.monthKey.startsWith(currentYear)) {
                aporteAnual += Math.abs(t.value);
            }
            if (t.type === 'buy') {
                if (!aportesMensais[t.monthKey]) aportesMensais[t.monthKey] = 0;
                aportesMensais[t.monthKey] += Math.abs(t.value);
            }
        });
        const mesesComAporte = Object.keys(aportesMensais);
        const aporteMensalMedio = mesesComAporte.length > 0 ? 
            mesesComAporte.reduce((acc, k) => acc + aportesMensais[k], 0) / mesesComAporte.length : 0;

        currentMetas.forEach(meta => {
            switch(meta.id) {
                case 'renda_mensal':
                    meta.value_current = avgProv;
                    break;
                case 'patrimonio':
                    meta.value_current = currentPatrimonio;
                    break;
                case 'aporte_mensal':
                    meta.value_current = aporteMensalMedio;
                    break;
                case 'aporte_anual':
                    meta.value_current = aporteAnual;
                    break;
            }
        });
    }

    async function loadMetas() {
        try {
            const res = await fetch('/api/metas');
            currentMetas = await res.json();
            applyB3DataToMetas();
            renderMetas();
        } catch (e) {
            console.error("Erro ao carregar metas:", e);
        }
    }

    function renderMetas() {
        const containerAndamento = document.getElementById('metas-em-andamento');
        const containerConcluidas = document.getElementById('metas-concluidas');
        if (!containerAndamento || !containerConcluidas) return;

        containerAndamento.innerHTML = '';
        containerConcluidas.innerHTML = '';

        const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        let hasAndamento = false;
        let hasConcluidas = false;

        currentMetas.forEach(meta => {
            let perc = 0;
            if (meta.value_target > 0) {
                perc = (meta.value_current / meta.value_target) * 100;
            }
            const isCompleted = perc >= 100;
            if (perc > 100) perc = 100;

            const remaining = Math.max(0, meta.value_target - meta.value_current);
            const progressColor = isCompleted ? '#A7F3D0' : '#3B82F6';

            // Build stat labels based on meta type
            let statsHTML = '';
            const statItems = [
                { label: 'Atual', value: formatCurrency(meta.value_current) },
                { label: 'Faltam', value: formatCurrency(remaining) },
                { label: 'Objetivo', value: formatCurrency(meta.value_target) }
            ];

            statsHTML = statItems.map(s => `
                <div class="meta-stat-box">
                    <span class="meta-stat-label">${s.label}</span>
                    <span class="meta-stat-val">${s.value}</span>
                </div>
            `).join('');

            const cardHTML = `
                <div class="meta-card" data-meta-id="${meta.id}">
                    <div class="meta-card-header">
                        <div class="meta-title">
                            <span class="meta-icon" style="background: transparent; border: none; font-size: 1.2rem;">${meta.icon || '🎯'}</span>
                            <h3>${meta.title}</h3>
                        </div>
                        <div class="meta-actions-group">
                            <button class="meta-options" onclick="window.editMeta('${meta.id}')" title="Editar">✏️</button>
                            <button class="meta-options meta-delete-btn" onclick="window.deleteMeta('${meta.id}')" title="Excluir">🗑️</button>
                        </div>
                    </div>
                    <div class="meta-progress-wrapper">
                        <div class="meta-percentage ${isCompleted ? 'right' : ''}">${perc.toFixed(2)}%</div>
                        <div class="meta-progress-track">
                            <div class="meta-progress-fill" style="width: ${perc}%; background-color: ${progressColor};"></div>
                        </div>
                    </div>
                    <div class="meta-stats-grid grid-3">
                        ${statsHTML}
                    </div>
                </div>
            `;

            if (isCompleted) {
                containerConcluidas.innerHTML += cardHTML;
                hasConcluidas = true;
            } else {
                containerAndamento.innerHTML += cardHTML;
                hasAndamento = true;
            }
        });

        if (!hasAndamento) {
            containerAndamento.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 40px;">
                Nenhuma meta em andamento. Clique em "+ Criar nova meta" para começar!
            </div>`;
        }
        if (!hasConcluidas) {
            containerConcluidas.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                Nenhuma meta concluída ainda. Continue investindo! 💪
            </div>`;
        }
    }

    // Exposed globally for onclick handlers in dynamic HTML
    window.editMeta = function(metaId) {
        const meta = currentMetas.find(m => m.id === metaId);
        if (!meta) return;
        isCreatingMeta = false;
        modalTitle.textContent = 'Editar Meta';
        inputMetaId.value = meta.id;
        inputMetaName.value = meta.title;
        inputMetaTarget.value = meta.value_target;
        metaModal.classList.remove('hidden');
    };

    window.deleteMeta = async function(metaId) {
        if (!confirm('Tem certeza que deseja excluir esta meta?')) return;
        try {
            await fetch(`/api/metas/${metaId}`, { method: 'DELETE' });
            loadMetas();
        } catch (e) {
            console.error("Erro ao excluir meta:", e);
        }
    };

    // "Criar nova meta" button
    const btnCreateMeta = document.getElementById('btn-create-meta');
    if (btnCreateMeta) {
        btnCreateMeta.addEventListener('click', () => {
            isCreatingMeta = true;
            modalTitle.textContent = 'Criar Nova Meta';
            inputMetaId.value = '';
            inputMetaName.value = '';
            inputMetaTarget.value = '';
            metaModal.classList.remove('hidden');
        });
    }

    if (btnCancelMeta) {
        btnCancelMeta.onclick = () => metaModal.classList.add('hidden');
    }

    if (btnSaveMeta) {
        btnSaveMeta.onclick = async () => {
            const title = inputMetaName.value.trim();
            const target = parseFloat(inputMetaTarget.value);
            if (!title || isNaN(target) || target <= 0) {
                alert('Preencha o título e um valor objetivo válido.');
                return;
            }

            try {
                btnSaveMeta.textContent = "Salvando...";
                
                if (isCreatingMeta) {
                    // CREATE
                    await fetch('/api/metas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, value_target: target })
                    });
                } else {
                    // UPDATE
                    const id = inputMetaId.value;
                    await fetch(`/api/metas/${id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, value_target: target })
                    });
                }
                
                metaModal.classList.add('hidden');
                btnSaveMeta.textContent = "Salvar";
                loadMetas();
            } catch (e) {
                console.error(e);
                btnSaveMeta.textContent = "Salvar";
            }
        };
    }

    // Load metas on startup
    loadMetas();

    // ==========================================
    // INTEGRAÇÃO DE IA (ANALISE E CHAT)
    // ==========================================
    const btnRegenerate = document.getElementById('btn-regenerate-analysis');
    const aiAnalysisContent = document.getElementById('ai-analysis-content');
    
    // Gerar Análise Automática
    if (btnRegenerate && aiAnalysisContent) {
        btnRegenerate.addEventListener('click', async () => {
            const originalText = btnRegenerate.innerHTML;
            btnRegenerate.innerHTML = '<span class="icon">⌛</span> Analisando...';
            btnRegenerate.disabled = true;
            
            try {
                // Criar versão enxuta para não estourar o limite de tokens da API (erro 429)
                const state = window.dashboardState || {};
                const slimPortfolioData = {
                    categories: state.categories,
                    performance: { proventos: state.proventosTotais }
                };
                const res = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slimPortfolioData)
                });
                const data = await res.json();
                
                if (data.error) {
                    aiAnalysisContent.innerHTML = `<div style="color:var(--danger-color)">Erro: ${data.error}</div>`;
                } else if (data.analysis) {
                    // Usa o marked para formatar o markdown retornado pra HTML
                    const parsedHtml = typeof marked !== 'undefined' ? marked.parse(data.analysis) : data.analysis;
                    aiAnalysisContent.innerHTML = `<div class="formatted-ai-content">${parsedHtml}</div>`;
                }
            } catch(e) {
                aiAnalysisContent.innerHTML = `<div style="color:var(--danger-color)">Erro ao comunicar com a IA.</div>`;
                console.error(e);
            } finally {
                btnRegenerate.innerHTML = originalText;
                btnRegenerate.disabled = false;
            }
        });
    }

    // Chat com IA
    const chatInput = document.getElementById('ai-chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('ai-chat-messages');
    const btnClearChat = document.getElementById('btn-clear-chat');
    const aiTyping = document.getElementById('ai-typing');
    
    let chatSessionId = "session_" + Date.now();

    function addChatMessage(role, text) {
        if (!chatMessages) return;
        
        const isBot = role === 'bot';
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-msg ai-msg-${isBot ? 'bot' : 'user'}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'ai-msg-avatar';
        avatarDiv.textContent = isBot ? '🤖' : '👤';
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'ai-msg-bubble';
        
        // Se for o bot, formata o markdown
        if (isBot && typeof marked !== 'undefined') {
            bubbleDiv.innerHTML = marked.parse(text);
        } else {
            bubbleDiv.textContent = text;
        }
        
        msgDiv.appendChild(avatarDiv);
        msgDiv.appendChild(bubbleDiv);
        
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
    }

    async function sendChatMessage() {
        if (!chatInput || !chatInput.value.trim()) return;
        
        const userMsg = chatInput.value.trim();
        chatInput.value = '';
        chatInput.disabled = true;
        if(btnSendChat) btnSendChat.disabled = true;
        
        // Add user message to UI
        addChatMessage('user', userMsg);
        
        // Show typing indicator
        if (aiTyping) {
            aiTyping.classList.remove('hidden');
            chatMessages.appendChild(aiTyping); // move to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        try {
            const state = window.dashboardState || {};
            const slimPortfolioData = {
                categories: state.categories,
                performance: { proventos: state.proventosTotais }
            };
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: chatSessionId,
                    message: userMsg,
                    portfolio_data: slimPortfolioData
                })
            });
            const data = await res.json();
            
            if (aiTyping) aiTyping.classList.add('hidden');
            
            if (data.error) {
                addChatMessage('bot', `**Erro:** ${data.error}`);
            } else if (data.response) {
                addChatMessage('bot', data.response);
            }
        } catch(e) {
            if (aiTyping) aiTyping.classList.add('hidden');
            addChatMessage('bot', `**Erro de conexão:** Não foi possível comunicar com o servidor.`);
            console.error(e);
        } finally {
            chatInput.disabled = false;
            if(btnSendChat) btnSendChat.disabled = false;
            chatInput.focus();
        }
    }

    // Eventos do Chat
    if (btnSendChat) {
        btnSendChat.addEventListener('click', sendChatMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }

    if (btnClearChat) {
        btnClearChat.addEventListener('click', () => {
            if (!chatMessages) return;
            // Cria uma nova sessão para esquecer historico do back-end
            chatSessionId = "session_" + Date.now();
            
            // Mantém apenas a barra de digitação se ela estiver dentro, e reseta
            chatMessages.innerHTML = '';
            addChatMessage('bot', "Olá! Sou o **InvestAI**, seu consultor financeiro pessoal. 🚀\n\nImporte seus dados B3 e me pergunte qualquer coisa sobre seus investimentos, metas e estratégias!");
        });
    }

    // ==========================================
    // CONFIGURAÇÕES MODAL
    // ==========================================
    const configModal = document.getElementById('config-modal');
    const btnOpenConfig = document.getElementById('btn-open-config');
    const btnCancelConfig = document.getElementById('btn-cancel-config');
    const btnSaveConfig = document.getElementById('btn-save-config');
    const configProviderInput = document.getElementById('config-ai-provider');
    const configApiKeyLabel = document.getElementById('config-api-key-label');
    const configApiKeyHint = document.getElementById('config-api-key-hint');
    const configKeyStatus = document.getElementById('config-key-status');
    const configModalTitle = document.getElementById('config-modal-title');
    const configModalDesc = document.getElementById('config-modal-desc');

    let isFirstRun = false;

    const providerInfo = {
        gemini: {
            label: '🔑 API Key do Gemini',
            hint: 'Gere gratuitamente em <a href="https://aistudio.google.com/apikey" target="_blank" style="color: var(--primary-color);">aistudio.google.com/apikey</a>'
        },
        openai: {
            label: '🔑 API Key da OpenAI',
            hint: 'Crie em <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--primary-color);">platform.openai.com/api-keys</a>'
        },
        anthropic: {
            label: '🔑 API Key da Anthropic',
            hint: 'Crie em <a href="https://console.anthropic.com/settings/keys" target="_blank" style="color: var(--primary-color);">console.anthropic.com/settings/keys</a>'
        }
    };

    // Provider selector buttons
    document.querySelectorAll('.provider-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const provider = btn.getAttribute('data-provider');
            configProviderInput.value = provider;

            // Update label and hint
            const info = providerInfo[provider] || providerInfo.gemini;
            if (configApiKeyLabel) configApiKeyLabel.textContent = info.label;
            if (configApiKeyHint) configApiKeyHint.innerHTML = info.hint;
        });
    });

    function openConfigModal(firstRun = false) {
        isFirstRun = firstRun;
        if (firstRun) {
            configModalTitle.textContent = '👋 Bem-vindo ao InvestAI!';
            configModalDesc.textContent = 'Configure seu aplicativo para começar a usar.';
            btnCancelConfig.style.display = 'none';
        } else {
            configModalTitle.textContent = '⚙️ Configurações';
            configModalDesc.textContent = 'Altere suas preferências a qualquer momento.';
            btnCancelConfig.style.display = '';
        }
        configKeyStatus.textContent = '';
        configModal.classList.remove('hidden');
    }

    // Load config on startup
    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            const cfg = await res.json();
            
            if (!cfg.is_configured) {
                // First time — force modal open
                openConfigModal(true);
                return;
            }
            
            // Pre-fill form
            document.getElementById('config-user-name').value = cfg.user_name || '';
            document.getElementById('config-excel-path').value = cfg.excel_path || '';
            configProviderInput.value = cfg.ai_provider || 'gemini';
            
            // Select the right provider button
            document.querySelectorAll('.provider-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-provider') === cfg.ai_provider);
            });
            
            // Update key label/hint for selected provider
            const info = providerInfo[cfg.ai_provider] || providerInfo.gemini;
            if (configApiKeyLabel) configApiKeyLabel.textContent = info.label;
            if (configApiKeyHint) configApiKeyHint.innerHTML = info.hint;
            
            // Show masked key status
            if (cfg.ai_api_key_masked) {
                configKeyStatus.textContent = `✅ Chave configurada: ${cfg.ai_api_key_masked}`;
                configKeyStatus.className = 'config-key-status success';
            }
        } catch(e) {
            console.error('Error loading config:', e);
        }
    }

    loadConfig();

    // Open config via gear button
    if (btnOpenConfig) {
        btnOpenConfig.addEventListener('click', () => {
            loadConfig().then(() => {
                openConfigModal(false);
            });
        });
    }

    // Cancel config
    if (btnCancelConfig) {
        btnCancelConfig.addEventListener('click', () => {
            if (!isFirstRun) {
                configModal.classList.add('hidden');
            }
        });
    }

    // Save config
    if (btnSaveConfig) {
        btnSaveConfig.addEventListener('click', async () => {
            const userName = document.getElementById('config-user-name').value.trim();
            const excelPath = document.getElementById('config-excel-path').value.trim();
            const aiProvider = configProviderInput.value;
            const aiKey = document.getElementById('config-ai-key').value.trim();

            if (isFirstRun && !userName) {
                alert('Por favor, insira seu nome.');
                return;
            }

            btnSaveConfig.textContent = '⏳ Salvando...';
            btnSaveConfig.disabled = true;

            try {
                const res = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_name: userName,
                        excel_path: excelPath,
                        ai_provider: aiProvider,
                        ai_api_key: aiKey
                    })
                });
                const data = await res.json();

                if (data.status === 'success') {
                    configModal.classList.add('hidden');
                    
                    // Reload extrato if path was filled
                    if (excelPath) {
                        loadLocalExtrato();
                    }

                    // Re-check AI status
                    try {
                        const statusRes = await fetch('/api/ai/status');
                        const statusData = await statusRes.json();
                        const banner = document.getElementById('ai-setup-banner');
                        if (banner) {
                            banner.classList.toggle('hidden', statusData.configured);
                        }
                    } catch(e) {}
                } else {
                    configKeyStatus.textContent = '❌ Erro ao salvar configurações.';
                    configKeyStatus.className = 'config-key-status error';
                }
            } catch (e) {
                console.error('Error saving config:', e);
                configKeyStatus.textContent = '❌ Erro de conexão.';
                configKeyStatus.className = 'config-key-status error';
            } finally {
                btnSaveConfig.textContent = '💾 Salvar Configurações';
                btnSaveConfig.disabled = false;
            }
        });
    }

    // Prevent closing config modal by clicking outside on first run
    if (configModal) {
        configModal.addEventListener('click', (e) => {
            if (e.target === configModal && !isFirstRun) {
                configModal.classList.add('hidden');
            }
        });
    }
});

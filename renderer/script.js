document.addEventListener('DOMContentLoaded', () => {
    // ==== TEMA (DARK/LIGHT MODE) ====
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // Inicia com o tema guardado ou padrão escuro
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (themeIcon) themeIcon.textContent = '🌙';
    } else if (savedTheme === 'system') {
        // System theme — check OS preference via API
        if (window.api && window.api.getSystemTheme) {
            window.api.setThemeSource('system');
            window.api.getSystemTheme().then(sysTheme => {
                if (sysTheme === 'light') {
                    document.body.classList.add('light-mode');
                    if (themeIcon) themeIcon.textContent = '🌙';
                } else {
                    document.body.classList.remove('light-mode');
                    if (themeIcon) themeIcon.textContent = '☀️';
                }
            });
        } else {
            if (themeIcon) themeIcon.textContent = '☀️';
        }
    } else {
        if (themeIcon) themeIcon.textContent = '☀️';
    }

    // Header toggle button — simple dark/light cycle
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.contains('light-mode');
            const newTheme = isLight ? 'dark' : 'light';
            // Use applyTheme if available (defined later), otherwise inline
            if (typeof applyTheme === 'function') {
                applyTheme(newTheme);
            } else {
                document.body.classList.toggle('light-mode');
                localStorage.setItem('theme', newTheme);
                if (themeIcon) themeIcon.textContent = isLight ? '☀️' : '🌙';
            }
            
            // Re-renderizar gráficos para aplicar nova paleta de cor dinâmica (ex: datalabels)
            if (typeof charts !== 'undefined') {
                const newGridColor = getChartGridColor();
                Object.values(charts).forEach(chart => {
                    if (chart && typeof chart.update === 'function') {
                        if (chart.options && chart.options.scales && chart.options.scales.y) {
                            if (chart.options.scales.y.grid) {
                                chart.options.scales.y.grid.color = newGridColor;
                            }
                        }
                        chart.update();
                    }
                });
            }
        });
    }

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
                if (targetScreen) {
                    targetScreen.classList.add('active');
                    // Antigravity GSAP Animation
                    if (typeof gsap !== 'undefined') {
                        gsap.fromTo(targetScreen.querySelectorAll('.card, .chart-container, table, .btn-primary'), 
                            { y: 30, opacity: 0 }, 
                            { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out", clearProps: "all" }
                        );
                    }
                }
            }
        });
    });

    // Antigravity initial load animation
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.active .card, .active .chart-container, .active table', 
            { y: 30, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out", clearProps: "all", delay: 0.2 }
        );
    }

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


    // Helper: returns grid line color adjusted for current theme
    function getChartGridColor() {
        return document.body.classList.contains('light-mode')
            ? 'rgba(100, 116, 139, 0.15)'
            : 'rgba(100, 116, 139, 0.2)';
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
                            color: function() {
                                return document.body.classList.contains('light-mode') ? '#111827' : '#F9FAFB';
                            },
                            font: { size: 14, weight: 'bold' }
                        }
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            grace: '20%',
                            grid: { borderDash: [4, 4], color: getChartGridColor() },
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
            const buffer = await window.api.getExtratoFile();
            if (!buffer) return;
            const data = new Uint8Array(buffer);
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

    const globalYearFilter = document.getElementById('global-year-filter');
    if (globalYearFilter) {
        globalYearFilter.addEventListener('change', async (e) => {
            window.globalYear = e.target.value;
            await renderDashboards();
        });
    }

    async function renderDashboards(forceRefresh = false) {
        if (!window.globalYear) {
            window.globalYear = new Date().getFullYear().toString();
        }

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
        let allYearsSet = new Set(); // Para popular o filtro global de anos

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

            let dateParts = [];
            let rowDate = row[colData] ? String(row[colData]) : "";
            if (rowDate.includes('/')) dateParts = rowDate.split("/");
            let transYear = dateParts.length === 3 ? dateParts[2] : null;

            if (transYear) {
                allYearsSet.add(transYear);
            }

            const mUpper = movimentacao.toUpperCase();
            const isCompra = mUpper.includes("COMPRA") || mUpper.includes("APLICAÇÃO") || mUpper.includes("SUBSCRIÇÃO") || mUpper.includes("TRANSFERÊNCIA - LIQUIDAÇÃO");
            const isVenda = mUpper.includes("VENDA") || mUpper.includes("RESGATE");
            const isRend = mUpper.includes("DIVIDENDO") || mUpper.includes("JUROS") || mUpper.includes("RENDIMENTO") || mUpper.includes("AMORTIZAÇÃO");


            if (isCompra || isVenda) {
                // Filtro Global de Ano para Patrimônio
                if (window.globalYear !== 'Todos' && transYear && transYear > window.globalYear) {
                    continue; // Ignora compras/vendas que ocorreram DEPOIS do ano selecionado
                }

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

                // Track individual transactions for TWR
                if (dateParts.length === 3) {
                    const monthYear = `${dateParts[1]}/${dateParts[2].slice(-2)}`; // MM/YY
                    const sortKey = `${dateParts[2]}${dateParts[1]}`; // YYYYMM

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

                    // Evolution Chart (Só mostra meses do ano selecionado, a menos que seja "Todos")
                    if (window.globalYear === 'Todos' || transYear === window.globalYear) {
                        if (!monthlyInvestments[sortKey]) {
                            monthlyInvestments[sortKey] = { label: monthYear, total: 0 };
                        }
                        if (!monthlyInvestments[sortKey][classe]) monthlyInvestments[sortKey][classe] = 0;
                        
                        monthlyInvestments[sortKey].total += netValue;
                        monthlyInvestments[sortKey][classe] += netValue;
                    }
                }

            } else if (isRend) {
                // Filtro Global de Ano para Proventos
                if (window.globalYear !== 'Todos' && transYear && transYear !== window.globalYear) {
                    continue; // Ignora proventos que não sejam DO ANO selecionado
                }

                proventosTotais += valorNum;
                
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
                        dateStr: rowDate,             // ex: 15/03/2026
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

        // Popula seletor global de ano
        const globalYearFilter = document.getElementById('global-year-filter');
        if (globalYearFilter && allYearsSet.size > 0) {
            // Apenas repopula se as opções estiverem vazias ou diferentes, para evitar flicker
            const sortedYears = Array.from(allYearsSet).sort((a, b) => b.localeCompare(a));
            const shouldRepopulate = globalYearFilter.options.length <= 1; // tem vazio ou só todos
            
            if (shouldRepopulate) {
                globalYearFilter.innerHTML = '<option value="Todos">Todos os Anos</option>';
                sortedYears.forEach(y => {
                    const opt = document.createElement('option');
                    opt.value = y;
                    opt.textContent = `Ano: ${y}`;
                    globalYearFilter.appendChild(opt);
                });
                
                // Set default to window.globalYear if exists in options
                if (sortedYears.includes(window.globalYear)) {
                    globalYearFilter.value = window.globalYear;
                } else {
                    globalYearFilter.value = "Todos";
                    window.globalYear = "Todos";
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
                const quotes = await window.api.getQuotes(allTickers, forceRefresh);

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
                const isExpanded = groupDiv.classList.contains('expanded');
                const content = groupDiv.querySelector('.asset-group-content');
                const tbodyRows = groupDiv.querySelectorAll('.table-body tr');

                if (!isExpanded) {
                    // Abrir
                    groupDiv.classList.add('expanded');
                    if (typeof gsap !== 'undefined') {
                        gsap.fromTo(content, 
                            { height: 0, opacity: 0 }, 
                            { height: "auto", opacity: 1, duration: 0.5, ease: "power3.out" }
                        );
                        // Efeito dominó nas linhas da tabela
                        if (tbodyRows && tbodyRows.length > 0) {
                            gsap.fromTo(tbodyRows, 
                                { y: 15, opacity: 0 }, 
                                { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: "power2.out", delay: 0.1 }
                            );
                        }
                    }
                } else {
                    // Fechar
                    if (typeof gsap !== 'undefined') {
                        gsap.to(content, { 
                            height: 0, opacity: 0, duration: 0.4, ease: "power3.in", 
                            onComplete: () => {
                                groupDiv.classList.remove('expanded');
                                gsap.set(content, { clearProps: "all" });
                                gsap.set(tbodyRows, { clearProps: "all" });
                            }
                        });
                    } else {
                        groupDiv.classList.remove('expanded');
                    }
                }
            });

            // Populate Table
            const tbody = clone.querySelector('.table-body');
            if (activeKeys.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--text-tertiary)">Nenhum ativo nesta categoria.</td></tr>`;
            } else {
                activeKeys.forEach(ticker => {
                    const ativo = cat.ativos[ticker];
                    const avgPrice = ativo.quant > 0 ? ((ativo.investedVal !== undefined ? ativo.investedVal : ativo.totalVal) / ativo.quant) : 0;
                    const currentPrice = ativo.currentPrice || avgPrice;

                    const isPos = currentPrice >= avgPrice;
                    const pctDiff = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;

                    // Cálculo do Número Mágico (Preço Atual / Rendimento Mensal Médio por cota, ultimos 12 meses)
                    let magicNumberText = "-";
                    if (window.dashboardState && window.dashboardState.yieldTransactions) {
                        const yieldsForAsset = window.dashboardState.yieldTransactions.filter(t => t.ticker === ticker);
                        if (yieldsForAsset.length > 0 && currentPrice > 0) {
                            let monthlyMap = {};
                            yieldsForAsset.forEach(t => {
                                if (t.quant > 0) {
                                    if (!monthlyMap[t.monthKey]) monthlyMap[t.monthKey] = [];
                                    monthlyMap[t.monthKey].push(t.valTotal / t.quant);
                                }
                            });
                            let months = Object.keys(monthlyMap).sort().slice(-12); // Pega os últimos 12 meses registrados
                            if (months.length > 0) {
                                let sumAvg = 0;
                                months.forEach(m => {
                                    // Média de pagamentos no mesmo mês (caso haja > 1)
                                    sumAvg += monthlyMap[m].reduce((a, b) => a + b, 0) / monthlyMap[m].length;
                                });
                                let avgMonthYield = sumAvg / months.length;
                                if (avgMonthYield > 0) {
                                    let mgNum = Math.ceil(currentPrice / avgMonthYield);
                                    magicNumberText = mgNum.toString();
                                }
                            }
                        }
                    }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div class="asset-table-ticker">
                                <div class="asset-table-icon">🏢</div>
                                <span class="raiox-ticker-link" onclick="event.stopPropagation(); window.openRaioXModal('${ticker}')">${ticker}</span>
                            </div>
                        </td>
                        <td>${ativo.quant.toLocaleString('pt-BR')}</td>
                        <td><span style="font-weight:600; color:var(--text-primary);">${magicNumberText}</span></td>
                        <td>${avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td>${currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <span style="font-size: 0.6rem; color: var(--text-tertiary)">✍️</span></td>
                        <td><span class="badge-trend ${isPos ? 'positive' : 'negative'}">${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(2)}% ${isPos ? '▴' : '▾'}</span></td>
                        <td>${ativo.totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ${isPos ? '↗' : '↘'}</td>
                        <td>${globalTotal > 0 ? ((ativo.totalVal / globalTotal) * 100).toFixed(2) : 0}%</td>
                        <td>6,25%</td>
                        <td><span class="buy-badge">⊗ Não</span></td>
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
        const filters = window.proventoFilters || { viewType: 'Mensal', selectedType: 'Todos' };
        
        // 1. Filtragem Inicial
        let txs = [...yieldTransactions];
        if (filters.selectedType !== 'Todos') {
            txs = txs.filter(t => t.assetClass === filters.selectedType);
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
                        scales: { x: { grid: { display: false } }, y: { grace: '15%', grid: { borderDash: [4,4], color: getChartGridColor() }, ticks: { callback: v => v.toLocaleString('pt-BR') } } }
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
                // Collect unique FII tickers for next-dividend lookup
                const fiiiTickers = [...new Set(
                    txs
                        .filter(t => t.assetClass === 'FIIs' || (t.ticker && /^[A-Z]{4}11$/i.test(t.ticker)))
                        .map(t => t.ticker.replace(/\.SA$/i, '').toUpperCase())
                )];

                // Monta tabela inicialmente com "..." na coluna Próx. Pagto para FIIs
                txs.forEach(t => {
                    lTotal += t.valTotal;
                    let divValStr = t.quant > 0 ? (t.valTotal / t.quant).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-';
                    let qStr = t.quant > 0 ? t.quant.toLocaleString('pt-BR') : '-';
                    const cleanTicker = t.ticker.replace(/\.SA$/i, '').toUpperCase();
                    const isFii = t.assetClass === 'FIIs' || /^[A-Z]{4}11$/i.test(t.ticker);

                    listTbody.innerHTML += `<tr>
                        <td>
                            <div class="asset-table-ticker">
                                <div class="asset-table-icon" style="width:24px; height:24px; font-size:12px;">📊</div>
                                <span class="raiox-ticker-link" onclick="window.openRaioXModal('${t.ticker}')">${t.ticker}</span>
                            </div>
                        </td>
                        <td><span class="div-type-badge">${t.assetClass || '-'}</span></td>
                        <td><span class="status-badge pago">Pago</span></td>
                        <td style="color:var(--text-secondary)">${t.type}</td>
                        <td style="color:var(--text-tertiary);">-</td>
                        <td style="color:var(--text-primary);">${t.dateStr}</td>
                        <td class="next-pagto-cell" data-ticker="${cleanTicker}" style="color:var(--text-tertiary); font-size:0.85rem;">${isFii ? '<span class="next-pagto-loading">...</span>' : '—'}</td>
                        <td>${qStr}</td>
                        <td>${divValStr}</td>
                        <td style="font-weight:600; color:var(--text-primary)">${t.valTotal.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</td>
                    </tr>`;
                });

                document.getElementById('prov-list-total').textContent = lTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                // Busca assíncrona das datas — não bloqueia a UI
                if (fiiiTickers.length > 0 && window.api && window.api.getNextDividends) {
                    window.api.getNextDividends(fiiiTickers)
                        .then(nextDates => {
                            // Preenche as células de Próx. Pagto com os dados recebidos
                            const cells = listTbody.querySelectorAll('.next-pagto-cell');
                            cells.forEach(cell => {
                                const ticker = cell.dataset.ticker;
                                if (!ticker) return;
                                const dateVal = nextDates[ticker];
                                if (dateVal) {
                                    cell.innerHTML = `<span
                                        style="font-weight:500; color:var(--text-primary);"
                                        title="Data prevista com base em informações públicas do fundo"
                                    >${dateVal}</span>`;
                                } else {
                                    cell.innerHTML = '<span style="color:var(--text-tertiary);">—</span>';
                                }
                            });
                        })
                        .catch(() => {
                            // Em falha total, substitui "..." por "—"
                            const cells = listTbody.querySelectorAll('.next-pagto-loading');
                            cells.forEach(el => { el.textContent = '—'; });
                        });
                }

            } else {
                listTbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px;">Nenhum provento recebido ainda.</td></tr>`;
                document.getElementById('prov-list-total').textContent = lTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
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
                rentabMonthlyPricesCache = await window.api.getMonthlyPrices(allTickers, '2y');
            } catch (e) {
                console.error("Error fetching monthly prices:", e);
                rentabMonthlyPricesCache = {};
            }
        }

        // Fetch indices data (cached)
        if (!rentabIndicesCache) {
            try {
                rentabIndicesCache = await window.api.getIndices();
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
        renderRentabIndividual(investTransactions, rentabMonthlyPricesCache, categories);
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
                            grid: { borderDash: [4, 4], color: getChartGridColor() },
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

    function renderRentabIndividual(investTxs, monthlyPrices, categories) {
        const container = document.getElementById('rentab-indiv-list-container');
        if (!container) return;

        // Get all unique tickers from transactions
        const txTickers = new Set(investTxs.map(t => t.ticker));
        
        // Find class and icon for each ticker
        const classIcons = { "FIIs": "🏢", "Ações": "💲", "ETFs": "📈", "Tesouro Direto": "🏫" };
        const tickerInfo = {};
        for (const [className, cat] of Object.entries(categories)) {
            for (const ticker of Object.keys(cat.ativos)) {
                if (txTickers.has(ticker)) {
                    tickerInfo[ticker] = {
                        className: className,
                        icon: classIcons[className] || '📊',
                        currentValue: cat.ativos[ticker].totalVal || 0,
                        investedVal: cat.ativos[ticker].investedVal || 0
                    };
                }
            }
        }

        // Calculate TWR per ticker
        const individualReturns = {};
        txTickers.forEach(ticker => {
            const singleTickerTxs = investTxs.filter(t => t.ticker === ticker);
            // Create dummy categories object to pass to calculateTWR so it can get currentPrice if monthlyPrices fails
            const singleCat = {};
            if (tickerInfo[ticker]) {
                const cName = tickerInfo[ticker].className;
                singleCat[cName] = { ativos: {} };
                singleCat[cName].ativos[ticker] = categories[cName].ativos[ticker];
            }
            const returns = calculateTWR(singleTickerTxs, monthlyPrices, singleCat);
            
            // Calc total cumulative return for this ticker
            let product = 1;
            Object.values(returns).forEach(r => product *= (1 + r/100));
            const totalRet = (product - 1) * 100;

            individualReturns[ticker] = {
                monthly: returns,
                totalReturn: totalRet,
                info: tickerInfo[ticker] || { className: 'Outros', icon: '📊', currentValue: 0, investedVal: 0 }
            };
        });

        // Store for filtering
        if (!window.rentabState) window.rentabState = {};
        window.rentabState.individual = individualReturns;

        function updateAssetFilterOptions() {
            const classFilterVal = document.getElementById('rentab-indiv-class-filter')?.value || 'Todos';
            const assetFilter = document.getElementById('rentab-indiv-asset-filter');
            if (!assetFilter) return;

            let tickersArr = Object.keys(individualReturns);
            if (classFilterVal !== 'Todos') {
                tickersArr = tickersArr.filter(t => individualReturns[t].info.className === classFilterVal);
            }
            tickersArr.sort();

            const currentSelected = assetFilter.value;
            assetFilter.innerHTML = '<option value="Todos">Todos os ativos</option>';
            tickersArr.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                assetFilter.appendChild(opt);
            });
            if (tickersArr.includes(currentSelected)) {
                assetFilter.value = currentSelected;
            } else {
                assetFilter.value = 'Todos';
            }
        }

        // Render list function (can be called by filter)
        function updateIndividualList() {
            const classFilterVal = document.getElementById('rentab-indiv-class-filter')?.value || 'Todos';
            const assetFilterVal = document.getElementById('rentab-indiv-asset-filter')?.value || 'Todos';
            
            let tickersArr = Object.keys(individualReturns);
            if (classFilterVal !== 'Todos') {
                tickersArr = tickersArr.filter(t => individualReturns[t].info.className === classFilterVal);
            }
            if (assetFilterVal !== 'Todos') {
                tickersArr = tickersArr.filter(t => t === assetFilterVal);
            }

            // Sort by total return DESC
            tickersArr.sort((a, b) => individualReturns[b].totalReturn - individualReturns[a].totalReturn);

            container.innerHTML = '';
            
            if (tickersArr.length === 0) {
                container.innerHTML = '<div style="text-align:center; color:var(--text-tertiary); padding: 20px;">Nenhum ativo encontrado para este filtro.</div>';
                return;
            }

            const template = document.getElementById('template-rentab-indiv');
            if (!template) return;
            
            tickersArr.forEach(ticker => {
                const data = individualReturns[ticker];
                const clone = template.content.cloneNode(true);
                
                const groupDiv = clone.querySelector('.asset-group');
                const tickerEl = clone.querySelector('.rentab-indiv-ticker');
                tickerEl.textContent = ticker;
                tickerEl.classList.add('raiox-ticker-link');
                tickerEl.addEventListener('click', (e) => { e.stopPropagation(); window.openRaioXModal(ticker); });
                clone.querySelector('.rentab-indiv-class').textContent = data.info.className;
                clone.querySelector('.rentab-indiv-icon').textContent = data.info.icon;
                
                // Formatação
                clone.querySelector('.rentab-indiv-posicao').textContent = data.info.currentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                const retLabel = clone.querySelector('.rentab-indiv-total-pct');
                retLabel.textContent = data.totalReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
                retLabel.classList.add(data.totalReturn >= 0 ? 'positive' : 'negative');

                // Accordion behavior
                const header = clone.querySelector('.asset-group-header');
                header.addEventListener('click', () => {
                    const isExpanded = groupDiv.classList.contains('expanded');
                    const content = groupDiv.querySelector('.asset-group-content');
                    if (!isExpanded) {
                        groupDiv.classList.add('expanded');
                        if (typeof gsap !== 'undefined') {
                            gsap.fromTo(content, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.4, ease: "power3.out" });
                        }
                    } else {
                        if (typeof gsap !== 'undefined') {
                            gsap.to(content, { height: 0, opacity: 0, duration: 0.3, ease: "power3.in", onComplete: () => {
                                groupDiv.classList.remove('expanded');
                                gsap.set(content, { clearProps: "all" });
                            }});
                        } else {
                            groupDiv.classList.remove('expanded');
                        }
                    }
                });

                // Populate monthly table for this ticker
                const tbody = clone.querySelector('.rentab-indiv-tbody');
                const returns = data.monthly;
                const sortedMonths = Object.keys(returns).sort();
                
                if (sortedMonths.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;">Nenhum dado</td></tr>`;
                } else {
                    const byYear = {};
                    sortedMonths.forEach(m => {
                        const [year, month] = m.split('-');
                        if (!byYear[year]) byYear[year] = {};
                        byYear[year][parseInt(month)] = returns[m];
                    });
                    
                    const years = Object.keys(byYear).sort((a,b)=>b.localeCompare(a));
                    let cumulativeProduct = 1;
                    const cumByYear = {};
                    
                    const chronoYears = [...years].reverse();
                    chronoYears.forEach(year => {
                        let yearProduct = 1;
                        for (let m=1; m<=12; m++) {
                            if (byYear[year][m] !== undefined) {
                                yearProduct *= (1 + byYear[year][m]/100);
                                cumulativeProduct *= (1 + byYear[year][m]/100);
                            }
                        }
                        cumByYear[year] = { yearRet: (yearProduct-1)*100, cumRet: (cumulativeProduct-1)*100 };
                    });

                    years.forEach(year => {
                        let tr = `<td>${year}</td>`;
                        for(let m=1; m<=12; m++){
                            const val = byYear[year][m];
                            if(val !== undefined) {
                                const cls = val > 0.001 ? 'rentab-positive' : (val < -0.001 ? 'rentab-negative' : 'rentab-zero');
                                tr += `<td class="${cls}">${val.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}%</td>`;
                            } else {
                                tr += `<td class="rentab-zero">-</td>`;
                            }
                        }
                        const yRet = cumByYear[year].yearRet;
                        const cRet = cumByYear[year].cumRet;
                        const yrCls = yRet > 0.001 ? 'rentab-positive' : (yRet < -0.001 ? 'rentab-negative' : 'rentab-zero');
                        tr += `<td class="rentab-acum-cell ${yrCls}">${yRet.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}%</td>`;
                        const crCls = cRet > 0.001 ? 'rentab-positive' : (cRet < -0.001 ? 'rentab-negative' : 'rentab-zero');
                        tr += `<td class="rentab-acum-cell ${crCls}">${cRet.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}%</td>`;
                        tbody.innerHTML += `<tr>${tr}</tr>`;
                    });
                }

                container.appendChild(clone);
            });
        }

        // Init list and bind filter
        updateAssetFilterOptions();
        updateIndividualList();
        
        const classFilterSelect = document.getElementById('rentab-indiv-class-filter');
        if (classFilterSelect && !classFilterSelect.dataset.listenerAttached) {
            classFilterSelect.addEventListener('change', () => {
                updateAssetFilterOptions();
                updateIndividualList();
            });
            classFilterSelect.dataset.listenerAttached = 'true';
        }

        const assetFilterSelect = document.getElementById('rentab-indiv-asset-filter');
        if (assetFilterSelect && !assetFilterSelect.dataset.listenerAttached) {
            assetFilterSelect.addEventListener('change', updateIndividualList);
            assetFilterSelect.dataset.listenerAttached = 'true';
        }
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
        
        const metasYearSel = document.getElementById('metas-year-selector');
        let selectedYear = String(new Date().getFullYear());
        if (metasYearSel && investTransactions) {
            if (metasYearSel.options.length <= 1) { 
                const years = new Set([new Date().getFullYear()]);
                investTransactions.forEach(t => {
                    if (t.monthKey && t.monthKey.length >= 4) {
                        years.add(parseInt(t.monthKey.substring(0, 4)));
                    }
                });
                const sortedYears = Array.from(years).sort((a,b) => b - a);
                metasYearSel.innerHTML = '';
                sortedYears.forEach(y => {
                    const opt = document.createElement('option');
                    opt.value = y;
                    opt.textContent = y;
                    if (y === new Date().getFullYear()) opt.selected = true;
                    metasYearSel.appendChild(opt);
                });
                if (!metasYearSel.dataset.listenerAttached) {
                    metasYearSel.addEventListener('change', () => {
                        applyB3DataToMetas();
                        renderMetas();
                    });
                    metasYearSel.dataset.listenerAttached = 'true';
                }
            }
            selectedYear = metasYearSel.value;
        }

        const currentYear = selectedYear;

        // Calculate patrimônio atual
        let currentPatrimonio = 0;
        Object.keys(categories).forEach(cat => {
            currentPatrimonio += categories[cat].total || 0;
        });

        // Calculate média mensal de proventos
        let proventosAno = 0;
        const monthsSet = new Set();
        (yieldTransactions || []).forEach(t => {
            if (t.monthKey && t.monthKey.startsWith(currentYear)) {
                proventosAno += t.valTotal;
                monthsSet.add(t.monthKey);
            }
        });
        const avgProv = monthsSet.size > 0 ? (proventosAno / monthsSet.size) : 0;

        // Calculate aportes based on selected year
        let aporteAnual = 0;
        let aportesMensaisAno = {};
        let aportesMensaisAll = {};
        (investTransactions || []).forEach(t => {
            if (t.type === 'buy' && t.monthKey.startsWith(currentYear)) {
                aporteAnual += Math.abs(t.value);
                if (!aportesMensaisAno[t.monthKey]) aportesMensaisAno[t.monthKey] = 0;
                aportesMensaisAno[t.monthKey] += Math.abs(t.value);
            }
            if (t.type === 'buy') {
                if (!aportesMensaisAll[t.monthKey]) aportesMensaisAll[t.monthKey] = 0;
                aportesMensaisAll[t.monthKey] += Math.abs(t.value);
            }
        });
        const mesesComAporte = Object.keys(aportesMensaisAno);
        const aporteMensalMedio = mesesComAporte.length > 0 ? 
            mesesComAporte.reduce((acc, k) => acc + aportesMensaisAno[k], 0) / mesesComAporte.length : 0;

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
                    meta.history = aportesMensaisAll;
                    break;
                case 'aporte_anual':
                    meta.value_current = aporteAnual;
                    break;
            }
        });
    }

    async function loadMetas() {
        try {
            currentMetas = await window.api.getMetas();
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

            let progressWrapperHTML = `
                <div class="meta-progress-wrapper">
                    <div class="meta-percentage ${isCompleted ? 'right' : ''}">${perc.toFixed(2)}%</div>
                    <div class="meta-progress-track">
                        <div class="meta-progress-fill" style="width: ${perc}%; background-color: ${progressColor};"></div>
                    </div>
                </div>
            `;

            if (meta.id === 'aporte_mensal' && meta.history) {
                let barsHTML = '';
                const months = [];
                const metasYearSel = document.getElementById('metas-year-selector');
                const selectedYear = metasYearSel ? parseInt(metasYearSel.value) : new Date().getFullYear();
                
                for(let i=0; i<12; i++) {
                    const d = new Date(selectedYear, i, 1);
                    months.push({
                        key: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`,
                        label: d.toLocaleString('pt-BR', {month: 'short'}).toUpperCase().replace('.', '')
                    });
                }
                
                let maxVal = meta.value_target;
                months.forEach(m => {
                    const val = meta.history[m.key] || 0;
                    if (val > maxVal) maxVal = val;
                });
                maxVal = maxVal * 1.1;

                months.forEach(m => {
                    const val = meta.history[m.key] || 0;
                    const target = meta.value_target;
                    
                    let barColor = 'var(--danger-color, #EF4444)';
                    let iconHtml = '';
                    
                    if (val >= target) {
                        barColor = '#10B981';
                        if (val > target) {
                            iconHtml = '<div style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); text-shadow: 0 0 5px rgba(0,0,0,0.5); font-size:16px; z-index:2;">⭐</div>';
                        }
                    }
                    
                    const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    const formattedVal = val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
                    
                    barsHTML += `
                        <div class="meta-bar-col" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:6px; position:relative; height:120px;" title="${m.label}: ${formattedVal}">
                            <div style="position:relative; width:80%; max-width:25px; height:100%; display:flex; align-items:flex-end; justify-content:center; background: var(--border-color); border-radius: 4px;">
                                ${iconHtml}
                                <div style="width: 100%; background-color: ${barColor}; height: ${heightPct}%; border-radius: 4px 4px 0 0; transition: height 0.3s; position:relative; z-index: 1;"></div>
                            </div>
                            <span style="font-size: 0.65rem; color: var(--text-secondary); text-align: center;">${m.label}</span>
                        </div>
                    `;
                });

                const targetLinePct = maxVal > 0 ? (meta.value_target / maxVal) * 100 : 0;
                progressWrapperHTML = `
                    <div class="meta-bar-chart" style="display:flex; justify-content:space-between; align-items:flex-end; height:150px; margin-top:20px; position: relative;">
                        <div style="position: absolute; left: 0; right: 0; bottom: 20px; height: 120px; pointer-events: none;">
                            <div style="position: absolute; bottom: ${targetLinePct}%; left: 0; right: 0; border-top: 1px dashed var(--text-tertiary); z-index: 0;"></div>
                            <span style="position: absolute; bottom: ${targetLinePct}%; left: 0; font-size: 0.6rem; color: var(--text-tertiary); transform: translateY(-100%);">${formatCurrency(meta.value_target)}</span>
                        </div>
                        ${barsHTML}
                    </div>
                `;

                statsHTML = `
                    <div class="meta-stat-box">
                        <span class="meta-stat-label">Média Mensal</span>
                        <span class="meta-stat-val">${formatCurrency(meta.value_current)}</span>
                    </div>
                    <div class="meta-stat-box" style="grid-column: span 2;">
                        <span class="meta-stat-label">Objetivo</span>
                        <span class="meta-stat-val">${formatCurrency(meta.value_target)}</span>
                    </div>
                `;
            }

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
                    ${progressWrapperHTML}
                    <div class="meta-stats-grid grid-3" style="margin-top: 15px;">
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
                    await window.api.createMeta({ title, value_target: target });
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
                    performance: { proventos: state.proventosTotais },
                    metas: typeof currentMetas !== 'undefined' ? currentMetas : [],
                    analysisType: 'ativos_vs_metas'
                };
                const data = await window.api.aiAnalyze(slimPortfolioData);
                
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
            const data = await window.api.aiChat({ session_id: chatSessionId, message: userMsg, portfolio_data: slimPortfolioData });
            
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
    // CHAT DRAWER - MENU LATERAL PERSISTENTE
    // ==========================================
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    const chatDrawer = document.getElementById('chat-drawer');
    const chatOverlay = document.getElementById('chat-overlay');
    const btnCloseChat = document.getElementById('btn-close-chat');

    function openChatDrawer() {
        if (!chatDrawer) return;
        chatDrawer.classList.add('open');
        if (chatOverlay) chatOverlay.classList.remove('hidden');
        if (btnToggleChat) btnToggleChat.classList.add('open');
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        if (chatInput) setTimeout(() => chatInput.focus(), 380);
    }

    function closeChatDrawer() {
        if (!chatDrawer) return;
        chatDrawer.classList.remove('open');
        if (chatOverlay) chatOverlay.classList.add('hidden');
        if (btnToggleChat) btnToggleChat.classList.remove('open');
    }

    if (btnToggleChat) {
        btnToggleChat.addEventListener('click', () => {
            chatDrawer && chatDrawer.classList.contains('open')
                ? closeChatDrawer()
                : openChatDrawer();
        });
    }

    if (btnCloseChat) {
        btnCloseChat.addEventListener('click', closeChatDrawer);
    }

    if (chatOverlay) {
        chatOverlay.addEventListener('click', closeChatDrawer);
    }

    // ==========================================
    // CONFIGURAÇÕES MODAL (Tabbed Redesign)
    // ==========================================
    const configModal = document.getElementById('config-modal');
    const btnOpenConfig = document.getElementById('btn-open-config');
    const btnCancelConfig = document.getElementById('btn-cancel-config');
    const btnSaveConfig = document.getElementById('btn-save-config');
    const configProviderInput = document.getElementById('config-ai-provider');
    const configApiKeyLabel = document.getElementById('config-api-key-label');
    const configApiKeyHint = document.getElementById('config-api-key-hint');
    const configKeyStatus = document.getElementById('config-key-status');

    let isFirstRun = false;

    // --- Toast utility ---
    function showConfigToast(message) {
        let toast = document.querySelector('.config-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'config-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        // Force reflow for re-trigger
        toast.classList.remove('visible');
        void toast.offsetWidth;
        toast.classList.add('visible');
        setTimeout(() => { toast.classList.remove('visible'); }, 2500);
    }

    // --- Tab Navigation ---
    const configTabBtns = document.querySelectorAll('.config-tab-btn');
    const configTabPanels = document.querySelectorAll('.config-tab-panel');

    configTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-config-tab');
            configTabBtns.forEach(b => b.classList.remove('active'));
            configTabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const panel = document.getElementById('config-panel-' + tabId);
            if (panel) panel.classList.add('active');
        });
    });

    // --- Provider Info ---
    const providerInfo = {
        gemini: {
            label: 'API KEY DO GEMINI',
            hint: 'Gere gratuitamente em <a href="https://aistudio.google.com/apikey" target="_blank" style="color: var(--primary-color);">aistudio.google.com/apikey</a>'
        },
        openai: {
            label: 'API KEY DA OPENAI',
            hint: 'Crie em <a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--primary-color);">platform.openai.com/api-keys</a>'
        },
        anthropic: {
            label: 'API KEY DA ANTHROPIC',
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

    // --- API Key Toggle (show/hide) ---
    const apiKeyToggle = document.getElementById('config-apikey-toggle');
    const apiKeyInput = document.getElementById('config-ai-key');
    if (apiKeyToggle && apiKeyInput) {
        apiKeyToggle.addEventListener('click', () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            apiKeyToggle.textContent = isPassword ? '🔒' : '👁️';
        });
    }

    // --- Theme Cards (immediate apply) ---
    function applyTheme(theme) {
        const themeIcon = document.getElementById('theme-icon');
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            if (themeIcon) themeIcon.textContent = '🌙';
            if (window.api && window.api.setThemeSource) window.api.setThemeSource('light');
        } else if (theme === 'dark') {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            if (themeIcon) themeIcon.textContent = '☀️';
            if (window.api && window.api.setThemeSource) window.api.setThemeSource('dark');
        } else if (theme === 'system') {
            localStorage.setItem('theme', 'system');
            if (window.api && window.api.setThemeSource) {
                window.api.setThemeSource('system');
                // Apply based on current system preference
                window.api.getSystemTheme().then(sysTheme => {
                    if (sysTheme === 'light') {
                        document.body.classList.add('light-mode');
                        if (themeIcon) themeIcon.textContent = '🌙';
                    } else {
                        document.body.classList.remove('light-mode');
                        if (themeIcon) themeIcon.textContent = '☀️';
                    }
                });
            }
        }

        // Update theme card selection
        document.querySelectorAll('.config-theme-card').forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-theme') === theme);
        });

        // Re-render charts for new theme palette
        if (typeof charts !== 'undefined') {
            const newGridColor = getChartGridColor();
            Object.values(charts).forEach(chart => {
                if (chart && typeof chart.update === 'function') {
                    if (chart.options && chart.options.scales && chart.options.scales.y) {
                        if (chart.options.scales.y.grid) {
                            chart.options.scales.y.grid.color = newGridColor;
                        }
                    }
                    chart.update();
                }
            });
        }
    }

    document.querySelectorAll('.config-theme-card').forEach(card => {
        card.addEventListener('click', () => {
            const theme = card.getAttribute('data-theme');
            applyTheme(theme);
        });
    });

    // Initialize theme card state on load
    function syncThemeCards() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.querySelectorAll('.config-theme-card').forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-theme') === savedTheme);
        });
    }

    // --- Sync Card ---
    function updateSyncStatus() {
        const syncDate = document.getElementById('config-sync-date');
        const syncStatus = document.getElementById('config-sync-status');
        const lastSync = localStorage.getItem('lastSync');

        if (lastSync) {
            const date = new Date(lastSync);
            syncDate.textContent = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                syncStatus.textContent = '✅ Sincronizado';
                syncStatus.className = 'config-sync-status synced';
            } else {
                syncStatus.textContent = '⚠️ Desatualizado';
                syncStatus.className = 'config-sync-status outdated';
            }
        } else {
            syncDate.textContent = 'Nunca sincronizado';
            syncStatus.textContent = '—';
            syncStatus.className = 'config-sync-status';
        }
    }

    const btnConfigSync = document.getElementById('btn-config-sync');
    if (btnConfigSync) {
        btnConfigSync.addEventListener('click', async () => {
            if (!window.b3Data || window.b3Data.length < 2) {
                showConfigToast('Nenhum extrato importado para sincronizar.');
                return;
            }
            const originalText = btnConfigSync.textContent;
            btnConfigSync.textContent = '⏳ Sincronizando...';
            btnConfigSync.disabled = true;
            try {
                await renderDashboards(true);
                localStorage.setItem('lastSync', new Date().toISOString());
                updateSyncStatus();
                showConfigToast('Cotações atualizadas com sucesso!');
            } catch(e) {
                showConfigToast('Erro ao sincronizar.');
            } finally {
                btnConfigSync.textContent = originalText;
                btnConfigSync.disabled = false;
            }
        });
    }

    // --- About Tab: Tech Info ---
    function populateAboutTech() {
        const techDiv = document.getElementById('config-about-tech');
        if (!techDiv) return;
        const electronVersion = (typeof process !== 'undefined' && process.versions) ? process.versions.electron || '—' : '—';
        const nodeVersion = (typeof process !== 'undefined' && process.versions) ? process.versions.node || '—' : '—';
        const platform = navigator.platform || '—';
        techDiv.innerHTML = `
            <span>Electron: v${electronVersion}</span>
            <span>Node.js: v${nodeVersion}</span>
            <span>Sistema: ${platform}</span>
        `;
    }

    // --- Open Config Modal ---
    function openConfigModal(firstRun = false) {
        isFirstRun = firstRun;
        if (firstRun) {
            btnCancelConfig.style.display = 'none';
        } else {
            btnCancelConfig.style.display = '';
        }
        configKeyStatus.textContent = '';

        // Always reset to Perfil tab
        configTabBtns.forEach(b => b.classList.remove('active'));
        configTabPanels.forEach(p => p.classList.remove('active'));
        const firstTab = document.querySelector('[data-config-tab="perfil"]');
        const firstPanel = document.getElementById('config-panel-perfil');
        if (firstTab) firstTab.classList.add('active');
        if (firstPanel) firstPanel.classList.add('active');

        // Sync UI state
        syncThemeCards();
        updateSyncStatus();
        populateAboutTech();

        // Reset API key toggle state
        if (apiKeyInput) apiKeyInput.type = 'password';
        if (apiKeyToggle) apiKeyToggle.textContent = '👁️';

        configModal.classList.remove('hidden');
    }

    // --- Load config on startup ---
    async function loadConfig() {
        try {
            const cfg = await window.api.getConfig();

            if (!cfg.is_configured) {
                openConfigModal(true);
                return;
            }

            // Pre-fill form fields
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
                configKeyStatus.textContent = '✅ Válida';
                configKeyStatus.className = 'config-key-status success';
            } else {
                configKeyStatus.textContent = 'Não configurada';
                configKeyStatus.className = 'config-key-status unconfigured';
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

            btnSaveConfig.innerHTML = '⏳ Salvando...';
            btnSaveConfig.disabled = true;

            try {
                const data = await window.api.saveConfig({ user_name: userName, excel_path: excelPath, ai_provider: aiProvider, ai_api_key: aiKey });

                if (data.status === 'success') {
                    configModal.classList.add('hidden');
                    showConfigToast('Configurações salvas!');

                    // Reload extrato if path was filled
                    if (excelPath) {
                        loadLocalExtrato();
                    }

                    // Re-check AI status
                    try {
                        const statusData = await window.api.aiStatus();
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
                btnSaveConfig.innerHTML = '💾 Salvar Configurações';
                btnSaveConfig.disabled = false;
            }
        });
    }

    // Note: Modal closing is now handled globally via the Design System handlers

    // ==========================================
    // VERSÃO DO APP (dinâmica via IPC)
    // ==========================================
    async function loadAppVersion() {
        try {
            const version = await window.api.getAppVersion();
            if (version) {
                // Atualiza o rodapé global
                const footerEl = document.getElementById('footer-version-text');
                if (footerEl) footerEl.textContent = `VS&A v${version}`;

                // Atualiza a seção "Sobre" nas configurações
                const configVersionEl = document.getElementById('config-app-version');
                if (configVersionEl) configVersionEl.textContent = `v${version}`;
            }
        } catch (e) {
            console.error('Erro ao obter versão do app:', e);
        }
    }

    loadAppVersion();

    // Changelog toggle
    const btnToggleChangelog = document.getElementById('btn-toggle-changelog');
    const changelogContentDiv = document.getElementById('changelog-content');
    const changelogBodyDiv = document.getElementById('changelog-body');
    let changelogLoaded = false;

    if (btnToggleChangelog && changelogContentDiv) {
        btnToggleChangelog.addEventListener('click', async () => {
            const isHidden = changelogContentDiv.classList.contains('hidden');

            if (isHidden) {
                changelogContentDiv.classList.remove('hidden');
                btnToggleChangelog.textContent = '📋 Ocultar changelog';

                // Carrega o changelog apenas na primeira vez
                if (!changelogLoaded) {
                    try {
                        const md = await window.api.readChangelog();
                        if (typeof marked !== 'undefined' && marked.parse) {
                            changelogBodyDiv.innerHTML = marked.parse(md);
                        } else {
                            // Fallback: renderiza como texto pré-formatado
                            changelogBodyDiv.innerHTML = `<pre style="white-space: pre-wrap;">${md}</pre>`;
                        }
                        changelogLoaded = true;
                    } catch (e) {
                        changelogBodyDiv.textContent = 'Erro ao carregar changelog.';
                    }
                }
            } else {
                changelogContentDiv.classList.add('hidden');
                btnToggleChangelog.textContent = '📋 Ver novidades desta versão';
            }
        });
    }

    // ==========================================
    // SIMULADOR DE APORTES
    // ==========================================
    let simuladorChartInstance = null;

    function initSimulador() {
        const ctx = document.getElementById('simuladorChart');
        if (!ctx) return;

        simuladorChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            }
                        }
                    },
                    datalabels: { display: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        stacked: true,
                        grid: { borderDash: [4, 4], color: getChartGridColor() },
                        ticks: { callback: function(value) { return value.toLocaleString('pt-BR', { minimumFractionDigits: 0 }); } }
                    }
                }
            }
        });

        // Listeners for inputs
        const inputs = ['sim-patrimonio', 'sim-aporte', 'sim-rentabilidade', 'sim-dy', 'sim-anos'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calculateSimulation);
        });

        const btnUseCurrent = document.getElementById('btn-sim-use-current');
        if (btnUseCurrent) {
            btnUseCurrent.addEventListener('click', () => {
                const valText = document.getElementById('val-patrimonio').textContent;
                const match = valText.replace(/[^\d,-]/g, '').replace(',', '.');
                let curPat = parseFloat(match) || 0;
                document.getElementById('sim-patrimonio').value = curPat.toFixed(2);
                calculateSimulation();
            });
        }

        setTimeout(calculateSimulation, 500);
    }

    function calculateSimulation() {
        const patrimonioInicial = parseFloat(document.getElementById('sim-patrimonio')?.value) || 0;
        const aporteMensal = parseFloat(document.getElementById('sim-aporte')?.value) || 0;
        const rentAnualPct = parseFloat(document.getElementById('sim-rentabilidade')?.value) || 0;
        const dyAnualPct = parseFloat(document.getElementById('sim-dy')?.value) || 0;
        const anos = parseInt(document.getElementById('sim-anos')?.value) || 10;

        const rentMensal = Math.pow(1 + (rentAnualPct / 100), 1 / 12) - 1;
        
        let labels = [];
        let dataAportado = [];
        let dataJuros = [];
        
        let curPatrimonio = patrimonioInicial;
        let curAportado = patrimonioInicial;
        let curJuros = 0;

        const tbody = document.getElementById('sim-table-body');
        if (tbody) tbody.innerHTML = '';

        for (let ano = 1; ano <= anos; ano++) {
            let jurosDoAno = 0;
            let aporteDoAno = aporteMensal * 12;

            for (let mes = 1; mes <= 12; mes++) {
                let rendimentoMes = curPatrimonio * rentMensal;
                jurosDoAno += rendimentoMes;
                curJuros += rendimentoMes;
                
                curPatrimonio += rendimentoMes + aporteMensal;
                curAportado += aporteMensal;
            }

            labels.push(`Ano ${ano}`);
            dataAportado.push(curAportado);
            dataJuros.push(curJuros);

            if (tbody) {
                const dyMensal = Math.pow(1 + (dyAnualPct / 100), 1 / 12) - 1;
                const rendaMensalProj = curPatrimonio * dyMensal;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${ano}</td>
                    <td class="money">${aporteDoAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>${curAportado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="money">${jurosDoAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>${curJuros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 600;">${curPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="renda">${rendaMensalProj.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                `;
                tbody.appendChild(tr);
            }
        }

        const btnSimPat = document.getElementById('sim-res-patrimonio');
        if(btnSimPat) btnSimPat.textContent = curPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const btnSimApo = document.getElementById('sim-res-aportado');
        if(btnSimApo) btnSimApo.textContent = curAportado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const dyMensal = Math.pow(1 + (dyAnualPct / 100), 1 / 12) - 1;
        const rendaFinal = curPatrimonio * dyMensal;
        
        const btnSimRen = document.getElementById('sim-res-renda');
        if(btnSimRen) btnSimRen.textContent = rendaFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (simuladorChartInstance) {
            simuladorChartInstance.data.labels = labels;
            simuladorChartInstance.data.datasets = [
                {
                    label: 'Total Aportado',
                    data: dataAportado,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3B82F6',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Juros Acumulados',
                    data: dataJuros,
                    backgroundColor: 'rgba(16, 185, 129, 0.5)',
                    borderColor: '#10B981',
                    fill: true,
                    tension: 0.4
                }
            ];
            simuladorChartInstance.update();
        }
    }

    initSimulador();

    // ==========================================
    // CONTROLE DE IMPOSTO DE RENDA
    // ==========================================

    const IR_STORAGE_KEY = 'vsa_ir_operacoes';
    let irOperacoes = [];
    let irActiveClass = 'acoes';
    let irActiveYear = new Date().getFullYear();

    const IR_CLASS_LABELS = {
        acoes: 'Ações',
        acoes_day: 'Ações Day Trade',
        fiis: 'FIIs',
        etfs: 'ETFs',
        tesouro: 'Tesouro Direto',
        todos: 'Todos'
    };

    function irCalcAliq(classe, tempoPosse) {
        if (classe === 'acoes_day') return 0.20;
        if (classe === 'fiis') return 0.20;
        if (classe === 'etfs') return 0.15;
        if (classe === 'tesouro') {
            const map = { curto: 0.225, medio: 0.20, longo_1: 0.175, longo_2: 0.15 };
            return map[tempoPosse] || 0.15;
        }
        return 0.15; // acoes swing
    }

    function irCalcIsencao(classe, vendas) {
        // Apenas ações swing trade têm isenção até R$20.000/mês
        if (classe === 'acoes' && vendas <= 20000) return vendas; // isento total
        return 0;
    }

    function irCalcOperacao(op) {
        const vendas = op.vendas || 0;
        const custo = op.custo || 0;
        const pago = op.irPago || 0;
        const ganho = vendas - custo;

        // Isenção aplicável
        const isencaoDisponivelValor = (op.classe === 'acoes' && vendas <= 20000) ? ganho : 0;
        const isencao = ganho > 0 ? isencaoDisponivelValor : 0;

        const aliq = irCalcAliq(op.classe, op.tempo);
        const ganhoTributavel = Math.max(0, ganho - isencao);

        return {
            ganho,
            isencao,
            ganhoTributavel,
            aliquota: aliq,
            irBruto: ganhoTributavel > 0 ? ganhoTributavel * aliq : 0,
            irDevido: Math.max(0, (ganhoTributavel > 0 ? ganhoTributavel * aliq : 0) - pago)
        };
    }

    function irSaveStorage() {
        localStorage.setItem(IR_STORAGE_KEY, JSON.stringify(irOperacoes));
    }

    function irLoadStorage() {
        try {
            const raw = localStorage.getItem(IR_STORAGE_KEY);
            irOperacoes = raw ? JSON.parse(raw) : [];
        } catch (e) {
            irOperacoes = [];
        }
    }

    function irGetFilteredOps() {
        return irOperacoes.filter(op => {
            const opYear = parseInt((op.mes || '').split('-')[0]);
            const classMatch = irActiveClass === 'todos'
                ? true
                : (irActiveClass === 'acoes' ? (op.classe === 'acoes' || op.classe === 'acoes_day') : op.classe === irActiveClass);
            return opYear === irActiveYear && classMatch;
        });
    }

    function irRenderTable() {
        const tbody = document.getElementById('ir-table-body');
        if (!tbody) return;

        const ops = irGetFilteredOps();

        // Sort by month
        ops.sort((a, b) => (a.mes || '').localeCompare(b.mes || ''));

        if (ops.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:var(--text-tertiary); padding:40px;">
                Nenhuma operação para esta classe/ano. Clique em <strong>+ Registrar Venda</strong>.
            </td></tr>`;
            irUpdateKPIs([]);
            return;
        }

        // Group by month for loss carry-forward
        const byMonth = {};
        ops.forEach(op => {
            if (!byMonth[op.mes]) byMonth[op.mes] = [];
            byMonth[op.mes].push(op);
        });

        let prejuizoAcum = 0;
        let html = '';
        const months = Object.keys(byMonth).sort();

        months.forEach(mes => {
            const monthOps = byMonth[mes];
            let mesVendas = 0, mesCusto = 0, mesGanho = 0, mesIsencao = 0;
            let mesTributavel = 0, mesIRDevido = 0;
            let mesAliq = 0;

            monthOps.forEach(op => {
                const c = irCalcOperacao(op);
                mesVendas += op.vendas || 0;
                mesCusto += op.custo || 0;
                mesGanho += c.ganho;
                mesIsencao += c.isencao;
                mesTributavel += c.ganhoTributavel;
                mesAliq = c.aliquota; // last one wins
                mesIRDevido += c.irDevido;
            });

            // Apply previous month losses
            let prejCompens = 0;
            if (mesGanho > 0 && prejuizoAcum < 0) {
                prejCompens = Math.max(mesGanho + prejuizoAcum, 0) < mesGanho
                    ? Math.abs(prejuizoAcum)
                    : mesGanho;
                prejCompens = Math.min(prejCompens, Math.abs(prejuizoAcum));
            }

            const baseCalc = Math.max(0, mesTributavel - prejCompens);
            const irFinal = baseCalc > 0 ? baseCalc * mesAliq : 0;
            prejuizoAcum = mesGanho < 0 ? prejuizoAcum + mesGanho : prejuizoAcum + prejCompens * -1;
            if (mesGanho >= 0 && prejCompens > 0) prejuizoAcum += prejCompens;
            // Track remaining prejudice
            if (mesGanho < 0) {
                // already accumulated
            } else {
                // offset what was used
                if (prejCompens > 0) {
                    prejuizoAcum = Math.min(0, prejuizoAcum + prejCompens);
                }
            }

            const isIsento = mesGanho <= 0 || mesIsencao > 0;
            const irStatus = irFinal <= 0
                ? `<span class="ir-status isento">✓ Isento</span>`
                : `<span class="ir-status pendente">⚠ DARF Pendente</span>`;

            const [year, month] = mes.split('-');
            const mesLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

            html += `<tr>
                <td style="font-weight:600;">${mesLabel}</td>
                <td>${mesVendas.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td>${mesCusto.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td class="${mesGanho >= 0 ? 'positive' : 'negative'}" style="font-weight:600;">${mesGanho.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td style="color:var(--positive-color);">${mesIsencao > 0 ? mesIsencao.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '—'}</td>
                <td>${mesTributavel.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td style="color:var(--warning-color);">${prejCompens > 0 ? '(-) ' + prejCompens.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '—'}</td>
                <td style="font-weight:600;">${baseCalc.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td>${(mesAliq * 100).toFixed(1)}%</td>
                <td style="font-weight:700; color:${irFinal > 0 ? 'var(--warning-color)' : 'var(--text-tertiary)'};">${irFinal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td>${irStatus}</td>
                <td><button class="ir-action-btn" onclick="irDeleteMonth('${mes}')">🗑</button></td>
            </tr>`;
        });

        tbody.innerHTML = html;
        irUpdateKPIs(ops);
    }

    function irUpdateKPIs(ops) {
        let ganhoAno = 0, irAno = 0, prejAcum = 0;
        const now = new Date();
        const curMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let darfMes = 0;

        // Calculate yearly totals considering loss carry-forward
        const allYearOps = irOperacoes.filter(op => parseInt((op.mes || '').split('-')[0]) === irActiveYear);
        allYearOps.sort((a, b) => (a.mes || '').localeCompare(b.mes || ''));

        const byMonth = {};
        allYearOps.forEach(op => {
            if (!byMonth[op.mes]) byMonth[op.mes] = [];
            byMonth[op.mes].push(op);
        });

        let runningPrej = 0;
        Object.keys(byMonth).sort().forEach(mes => {
            let mesGanho = 0, mesTributavel = 0, mesAliq = 0.15;
            byMonth[mes].forEach(op => {
                const c = irCalcOperacao(op);
                mesGanho += c.ganho;
                mesTributavel += c.ganhoTributavel;
                mesAliq = c.aliquota;
            });

            ganhoAno += mesGanho;
            let prejComp = 0;
            if (mesGanho > 0 && runningPrej < 0) {
                prejComp = Math.min(mesTributavel, Math.abs(runningPrej));
                runningPrej += prejComp;
            }
            const base = Math.max(0, mesTributavel - prejComp);
            const ir = base * mesAliq;
            irAno += ir;
            if (mesGanho < 0) runningPrej += mesGanho;
            if (mes === curMes) darfMes = ir;
        });
        prejAcum = runningPrej;

        const elGanho = document.getElementById('ir-kpi-ganho-ano');
        const elIr = document.getElementById('ir-kpi-ir-ano');
        const elDarf = document.getElementById('ir-kpi-darf-mes');
        const elPrej = document.getElementById('ir-kpi-prejuizo');

        if (elGanho) {
            elGanho.textContent = ganhoAno.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
            elGanho.className = `ir-kpi-value ${ganhoAno >= 0 ? 'positive' : 'negative'}`;
        }
        if (elIr) elIr.textContent = irAno.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        if (elDarf) {
            elDarf.textContent = darfMes.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
            const card = document.getElementById('ir-kpi-darf-card');
            if (card && darfMes > 0) {
                card.style.borderColor = 'var(--warning-color)';
                card.style.boxShadow = '0 0 0 1px rgba(245, 158, 11, 0.3)';
            } else if (card) {
                card.style.borderColor = '';
                card.style.boxShadow = '';
            }
        }
        if (elPrej) elPrej.textContent = (prejAcum < 0 ? Math.abs(prejAcum) : 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    }

    window.irDeleteMonth = function(mes) {
        if (!confirm(`Apagar todas as operações de ${mes}?`)) return;
        irOperacoes = irOperacoes.filter(op => op.mes !== mes);
        irSaveStorage();
        irRenderTable();
    };

    function irUpdateModalPreview() {
        const classe = document.getElementById('ir-form-class')?.value || 'acoes';
        const vendas = parseFloat(document.getElementById('ir-form-vendas')?.value) || 0;
        const custo = parseFloat(document.getElementById('ir-form-custo')?.value) || 0;
        const tempo = document.getElementById('ir-form-tempo')?.value || 'longo_2';
        const pago = parseFloat(document.getElementById('ir-form-pago')?.value) || 0;
        const op = { classe, vendas, custo, tempo, irPago: pago };
        const c = irCalcOperacao(op);
        const fmt = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        const elG = document.getElementById('irp-ganho');
        const elI = document.getElementById('irp-isencao');
        const elB = document.getElementById('irp-base');
        const elD = document.getElementById('irp-devido');
        if (elG) elG.textContent = fmt(c.ganho);
        if (elI) elI.textContent = fmt(c.isencao);
        if (elB) elB.textContent = fmt(c.ganhoTributavel);
        if (elD) elD.textContent = fmt(c.irDevido);

        // Show tempo only for Tesouro
        const tempoWrap = document.getElementById('ir-form-tempo-wrap');
        if (tempoWrap) tempoWrap.style.display = classe === 'tesouro' ? '' : 'none';
    }

    function initIR() {
        irLoadStorage();

        // Populate year selector
        const yearSel = document.getElementById('ir-year-filter');
        if (yearSel) {
            const curYear = new Date().getFullYear();
            for (let y = curYear; y >= curYear - 4; y--) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                if (y === irActiveYear) opt.selected = true;
                yearSel.appendChild(opt);
            }
            yearSel.addEventListener('change', () => {
                irActiveYear = parseInt(yearSel.value);
                irRenderTable();
            });
        }

        // Default month in modal
        const formMes = document.getElementById('ir-form-mes');
        if (formMes) {
            const now = new Date();
            formMes.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Filter buttons
        const filterBtns = document.querySelectorAll('.ir-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                irActiveClass = btn.getAttribute('data-class');
                const badge = document.getElementById('ir-active-class-badge');
                if (badge) badge.textContent = IR_CLASS_LABELS[irActiveClass] || irActiveClass;
                irRenderTable();
            });
        });

        // Open modal
        const btnAdd = document.getElementById('btn-ir-add');
        const irModal = document.getElementById('ir-modal');
        if (btnAdd && irModal) {
            btnAdd.addEventListener('click', () => {
                irUpdateModalPreview();
                irModal.classList.remove('hidden');
            });
        }

        // Cancel modal
        const btnCancel = document.getElementById('btn-ir-cancel');
        if (btnCancel && irModal) {
            btnCancel.addEventListener('click', () => irModal.classList.add('hidden'));
        }
        if (irModal) {
            irModal.addEventListener('click', e => {
                if (e.target === irModal) irModal.classList.add('hidden');
            });
        }

        // Live preview in modal
        ['ir-form-class', 'ir-form-vendas', 'ir-form-custo', 'ir-form-tempo', 'ir-form-pago'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', irUpdateModalPreview);
        });

        // Save operation
        const btnSave = document.getElementById('btn-ir-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const classe = document.getElementById('ir-form-class')?.value;
                const mes = document.getElementById('ir-form-mes')?.value;
                const vendas = parseFloat(document.getElementById('ir-form-vendas')?.value) || 0;
                const custo = parseFloat(document.getElementById('ir-form-custo')?.value) || 0;
                const tempo = document.getElementById('ir-form-tempo')?.value || 'longo_2';
                const pago = parseFloat(document.getElementById('ir-form-pago')?.value) || 0;
                const obs = document.getElementById('ir-form-obs')?.value || '';

                if (!mes || vendas <= 0) {
                    alert('Preencha o mês e o valor total de vendas.');
                    return;
                }

                irOperacoes.push({
                    id: Date.now(),
                    classe,
                    mes,
                    vendas,
                    custo,
                    tempo,
                    irPago: pago,
                    obs
                });
                irSaveStorage();

                // Reset form
                if (document.getElementById('ir-form-vendas')) document.getElementById('ir-form-vendas').value = '';
                if (document.getElementById('ir-form-custo')) document.getElementById('ir-form-custo').value = '';
                if (document.getElementById('ir-form-pago')) document.getElementById('ir-form-pago').value = '';
                if (document.getElementById('ir-form-obs')) document.getElementById('ir-form-obs').value = '';

                if (irModal) irModal.classList.add('hidden');

                // Update year if needed
                const opYear = parseInt(mes.split('-')[0]);
                if (opYear !== irActiveYear) {
                    irActiveYear = opYear;
                    if (yearSel) yearSel.value = opYear;
                }

                irRenderTable();
            });
        }

        irRenderTable();
    }

    initIR();

    // ==== RAIO-X DO ATIVO MODAL ====
    let raioxChartInstance = null;

    function openRaioXModal(ticker) {
        if (!window.dashboardState) return;
        const { categories, yieldTransactions, investTransactions } = window.dashboardState;

        // Find asset across categories
        let assetData = null, assetClass = '', className = '';
        for (const [catName, cat] of Object.entries(categories)) {
            if (cat.ativos[ticker]) {
                assetData = cat.ativos[ticker];
                className = catName;
                break;
            }
        }
        if (!assetData) return;

        // Determine asset class label and type
        const classLabels = { 'FIIs': 'FII', 'Ações': 'Ação', 'ETFs': 'ETF', 'Tesouro Direto': 'TD' };
        assetClass = classLabels[className] || className;

        let typeLabel = className;
        const tUp = ticker.toUpperCase();
        if (className === 'FIIs') {
            if (tUp.includes('KNCR') || tUp.includes('KNIP') || tUp.includes('IRDM') || tUp.includes('MXRF') || tUp.includes('BCFF') || tUp.includes('RECR') || tUp.includes('VGIR')) typeLabel = 'FII Papel';
            else if (tUp.includes('HGLG') || tUp.includes('XPLG') || tUp.includes('BTLG') || tUp.includes('VILG') || tUp.includes('LVBI')) typeLabel = 'FII Logística';
            else if (tUp.includes('MALL') || tUp.includes('XPML') || tUp.includes('VISC') || tUp.includes('HSML')) typeLabel = 'FII Shopping';
            else typeLabel = 'FII';
        }

        // Compute KPIs
        const quant = assetData.quant || 0;
        const investedVal = assetData.investedVal !== undefined ? assetData.investedVal : assetData.totalVal;
        const currentVal = assetData.totalVal || 0;
        const avgPrice = quant > 0 ? investedVal / quant : 0;
        const currentPrice = assetData.currentPrice || avgPrice;
        const varPct = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;
        const varAbs = currentPrice - avgPrice;

        // Total proventos for this ticker (all time, not year-filtered)
        const allYieldTxs = yieldTransactions || [];
        // We need ALL yield transactions, but yieldTransactions in dashboardState may be year-filtered.
        // Re-parse from b3Data if needed, or use what we have
        const tickerYields = allYieldTxs.filter(t => t.ticker === ticker);
        const totalProventos = tickerYields.reduce((acc, t) => acc + t.valTotal, 0);

        // Rentabilidade from rentabState
        let totalReturn = 0;
        let monthlyReturns = {};
        if (window.rentabState && window.rentabState.individual && window.rentabState.individual[ticker]) {
            totalReturn = window.rentabState.individual[ticker].totalReturn || 0;
            monthlyReturns = window.rentabState.individual[ticker].monthly || {};
        }

        // Populate header
        document.getElementById('raiox-title').textContent = `${ticker} — Raio-X`;
        document.getElementById('raiox-class-badge').textContent = assetClass;
        document.getElementById('raiox-ticker-name').textContent = ticker;
        document.getElementById('raiox-full-name').textContent = className;
        document.getElementById('raiox-type-badge').textContent = typeLabel;

        // Badge colors by class
        const badge = document.getElementById('raiox-class-badge');
        const typeBadge = document.getElementById('raiox-type-badge');
        if (className === 'FIIs') {
            badge.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))';
            badge.style.color = '#93C5FD';
            typeBadge.style.background = 'rgba(59,130,246,0.12)';
            typeBadge.style.color = '#93C5FD';
        } else if (className === 'Ações') {
            badge.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.2))';
            badge.style.color = '#C4B5FD';
            typeBadge.style.background = 'rgba(139,92,246,0.12)';
            typeBadge.style.color = '#C4B5FD';
        } else if (className === 'ETFs') {
            badge.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.2))';
            badge.style.color = '#6EE7B7';
            typeBadge.style.background = 'rgba(16,185,129,0.12)';
            typeBadge.style.color = '#6EE7B7';
        } else {
            badge.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,191,36,0.2))';
            badge.style.color = '#FCD34D';
            typeBadge.style.background = 'rgba(245,158,11,0.12)';
            typeBadge.style.color = '#FCD34D';
        }

        // KPIs
        document.getElementById('raiox-kpi-proventos').textContent = totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const rentabEl = document.getElementById('raiox-kpi-rentab');
        rentabEl.textContent = totalReturn.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        rentabEl.className = 'raiox-kpi-value ' + (totalReturn >= 0 ? 'positive' : 'negative');

        document.getElementById('raiox-kpi-posicao').textContent = currentVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('raiox-kpi-quant').textContent = quant.toLocaleString('pt-BR');
        document.getElementById('raiox-kpi-pm').textContent = avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const varEl = document.getElementById('raiox-kpi-var');
        varEl.textContent = (varPct > 0 ? '+' : '') + varPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        varEl.className = 'raiox-kpi-value ' + (varPct >= 0 ? 'positive' : 'negative');
        document.getElementById('raiox-kpi-var-abs').textContent = (varAbs >= 0 ? '+' : '') + varAbs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // ---- [NOVO] Seções: Rendimento por cota + Número Mágico ----
        const yieldCardEl = document.getElementById('raiox-yield-card');
        const magicCardEl = document.getElementById('raiox-magic-card');
        const noYieldDataEl = document.getElementById('raiox-no-yield-data');
        const sectionsHr = document.getElementById('raiox-sections-hr');

        if (tickerYields.length === 0 || quant <= 0) {
            // Ocultar ambas as seções, exibir mensagem
            yieldCardEl.classList.add('hidden');
            magicCardEl.classList.add('hidden');
            noYieldDataEl.classList.remove('hidden');
            sectionsHr.style.display = 'none';
        } else {
            noYieldDataEl.classList.add('hidden');

            // Agrupar proventos por mês (contar apenas meses COM provento)
            const yieldByMonth = {};
            tickerYields.forEach(t => {
                const key = t.monthKey; // YYYYMM
                if (!yieldByMonth[key]) yieldByMonth[key] = 0;
                yieldByMonth[key] += t.valTotal;
            });

            const monthsWithYield = Object.keys(yieldByMonth);
            const numMonths = monthsWithYield.length;
            const totalYieldSum = monthsWithYield.reduce((acc, k) => acc + yieldByMonth[k], 0);

            // Rendimento médio por cota/mês = totalProventos ÷ meses com provento ÷ cotas atuais
            const avgMonthlyYieldPerQuota = totalYieldSum / numMonths / quant;
            const annualYieldPerQuota = avgMonthlyYieldPerQuota * 12;
            const dyEstimado = currentPrice > 0 ? (annualYieldPerQuota / currentPrice) * 100 : 0;

            // Populate Rendimento por cota card
            document.getElementById('raiox-yield-value').textContent =
                `R$ ${avgMonthlyYieldPerQuota.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / cota`;
            document.getElementById('raiox-yield-subtitle').textContent =
                `Baseado nos últimos ${numMonths} meses · R$ ${totalYieldSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ÷ ${numMonths} meses ÷ ${quant.toLocaleString('pt-BR')} cotas`;
            document.getElementById('raiox-yield-annual').textContent =
                `R$ ${annualYieldPerQuota.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/cota`;
            document.getElementById('raiox-yield-dy').textContent =
                `DY ~${dyEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% a.a.`;

            yieldCardEl.classList.remove('hidden');
            sectionsHr.style.display = '';

            // ---- Número Mágico: usar o valor já calculado na tabela do Resumo ----
            // Recalcular o Número Mágico usando a mesma lógica do accordion (preço / rendimento mensal médio por cota)
            let magicNumber = 0;
            const yieldsForMagic = tickerYields.filter(t => t.quant > 0);
            if (yieldsForMagic.length > 0 && currentPrice > 0) {
                let magicMonthlyMap = {};
                yieldsForMagic.forEach(t => {
                    if (!magicMonthlyMap[t.monthKey]) magicMonthlyMap[t.monthKey] = [];
                    magicMonthlyMap[t.monthKey].push(t.valTotal / t.quant);
                });
                let magicMonths = Object.keys(magicMonthlyMap).sort().slice(-12);
                if (magicMonths.length > 0) {
                    let sumAvgMagic = 0;
                    magicMonths.forEach(m => {
                        sumAvgMagic += magicMonthlyMap[m].reduce((a, b) => a + b, 0) / magicMonthlyMap[m].length;
                    });
                    let avgMonthYieldMagic = sumAvgMagic / magicMonths.length;
                    if (avgMonthYieldMagic > 0) {
                        magicNumber = Math.ceil(currentPrice / avgMonthYieldMagic);
                    }
                }
            }

            if (magicNumber > 0) {
                const progressPct = Math.min((quant / magicNumber) * 100, 100);
                const cotasFaltam = Math.max(magicNumber - quant, 0);
                const valorFaltam = cotasFaltam * currentPrice;
                const rendaAtualMes = avgMonthlyYieldPerQuota * quant;
                const rendaMagicMes = avgMonthlyYieldPerQuota * magicNumber;
                const pagaCota = rendaMagicMes >= currentPrice;

                document.getElementById('raiox-magic-cotas').textContent = quant.toLocaleString('pt-BR');
                document.getElementById('raiox-magic-number').textContent = magicNumber.toLocaleString('pt-BR');
                document.getElementById('raiox-magic-renda').textContent = rendaAtualMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                document.getElementById('raiox-magic-pct-label').textContent = `${progressPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% do número mágico`;
                document.getElementById('raiox-magic-faltam-label').textContent =
                    cotasFaltam > 0
                        ? `Faltam ${cotasFaltam.toLocaleString('pt-BR')} cotas → ${valorFaltam.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        : '✅ Número mágico atingido!';
                document.getElementById('raiox-magic-progress-fill').style.width = `${Math.min(progressPct, 100)}%`;

                const footerLeftText = `Com ${magicNumber.toLocaleString('pt-BR')} cotas, receberia/mês: ${rendaMagicMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} → ${pagaCota ? '✅ paga 1 cota' : '❌ não paga 1 cota'} (${currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
                document.getElementById('raiox-magic-footer-left').textContent = footerLeftText;
                document.getElementById('raiox-magic-footer-right').textContent = `Preço atual: ${currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;

                magicCardEl.classList.remove('hidden');
            } else {
                magicCardEl.classList.add('hidden');
            }
        }

        // ---- Proventos Chart ----
        const chartWrap = document.getElementById('raiox-chart-wrap');
        const noProvMsg = document.getElementById('raiox-no-proventos');
        const canvas = document.getElementById('raiox-proventos-chart');

        if (raioxChartInstance) { raioxChartInstance.destroy(); raioxChartInstance = null; }

        if (tickerYields.length === 0) {
            chartWrap.classList.add('hidden');
            noProvMsg.classList.remove('hidden');
        } else {
            chartWrap.classList.remove('hidden');
            noProvMsg.classList.add('hidden');

            // Group by month
            const byMonth = {};
            tickerYields.forEach(t => {
                const key = t.monthKey; // YYYYMM
                const label = `${t.monthStr}/${t.yearKey.slice(-2)}`;
                if (!byMonth[key]) byMonth[key] = { label, total: 0 };
                byMonth[key].total += t.valTotal;
            });
            const sortedKeys = Object.keys(byMonth).sort();
            const labels = sortedKeys.map(k => byMonth[k].label);
            const values = sortedKeys.map(k => byMonth[k].total);
            const lastIdx = values.length - 1;
            const bgColors = values.map((_, i) => i === lastIdx ? '#34d399' : '#3b82f6');

            raioxChartInstance = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Proventos', data: values, backgroundColor: bgColors, barThickness: 'flex', maxBarThickness: 40 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: { display: true, anchor: 'end', align: 'top', font: { size: 10, weight: 'bold' },
                            color: function() { return document.body.classList.contains('light-mode') ? '#111827' : '#E2E8F0'; },
                            formatter: v => v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748B', font: { size: 10 } } },
                        y: { grace: '15%', grid: { borderDash: [4, 4], color: 'rgba(100,116,139,0.15)' }, ticks: { color: '#64748B', callback: v => v.toLocaleString('pt-BR') } }
                    }
                }
            });
        }

        // ---- Purchase History ----
        const purchasesTbody = document.getElementById('raiox-purchases-tbody');
        const buyTxs = (investTransactions || []).filter(t => t.ticker === ticker && t.type === 'buy')
            .sort((a, b) => a.sortDate.localeCompare(b.sortDate));

        if (buyTxs.length === 0) {
            purchasesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748B;">Nenhuma compra registrada.</td></tr>';
        } else {
            let html = '';
            buyTxs.forEach(t => {
                const unitPrice = t.quant > 0 ? Math.abs(t.value / t.quant) : 0;
                html += `<tr>
                    <td>${t.dateStr}</td>
                    <td style="text-align:right;">${t.quant.toLocaleString('pt-BR')}</td>
                    <td style="text-align:right;">${unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="text-align:right;">${Math.abs(t.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>`;
            });
            // Average row
            html += `<tr class="raiox-avg-row">
                <td>Preço Médio</td>
                <td style="text-align:right;">${quant.toLocaleString('pt-BR')}</td>
                <td style="text-align:right;">${avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style="text-align:right;">${investedVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>`;
            purchasesTbody.innerHTML = html;
        }

        // ---- Rentabilidade Mensal Table ----
        const rentabTbody = document.getElementById('raiox-rentab-tbody');
        const sortedMonths = Object.keys(monthlyReturns).sort();

        if (sortedMonths.length === 0) {
            rentabTbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:20px; color:#64748B;">Sem dados de rentabilidade.</td></tr>';
        } else {
            const byYear = {};
            sortedMonths.forEach(m => {
                const [year, month] = m.split('-');
                if (!byYear[year]) byYear[year] = {};
                byYear[year][parseInt(month)] = monthlyReturns[m];
            });

            const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
            let cumulativeProduct = 1;
            const cumByYear = {};
            const chronoYears = [...years].reverse();
            chronoYears.forEach(year => {
                let yearProduct = 1;
                for (let m = 1; m <= 12; m++) {
                    if (byYear[year][m] !== undefined) {
                        yearProduct *= (1 + byYear[year][m] / 100);
                        cumulativeProduct *= (1 + byYear[year][m] / 100);
                    }
                }
                cumByYear[year] = { yearRet: (yearProduct - 1) * 100, cumRet: (cumulativeProduct - 1) * 100 };
            });

            let html = '';
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
                const yRet = cumByYear[year].yearRet;
                const cRet = cumByYear[year].cumRet;
                tr += `<td class="rentab-acum-cell">${yRet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>`;
                tr += `<td class="rentab-acum-cell">${cRet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>`;
                html += `<tr>${tr}</tr>`;
            });
            rentabTbody.innerHTML = html;
        }

        // Show modal
        const overlay = document.getElementById('raiox-overlay');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeRaioXModal() {
        const overlay = document.getElementById('raiox-overlay');
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
        if (raioxChartInstance) { raioxChartInstance.destroy(); raioxChartInstance = null; }
    }

    // Expose globally for inline onclick
    window.openRaioXModal = openRaioXModal;

    // Close handlers
    document.getElementById('raiox-close')?.addEventListener('click', closeRaioXModal);
    document.getElementById('raiox-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'raiox-overlay') closeRaioXModal();
    });

    // ==========================================
    // DESIGN SYSTEM: Global modal close handlers
    // ==========================================
    // Traffic light red dots — close via data-modal-close attribute
    document.querySelectorAll('[data-modal-close]').forEach(dot => {
        dot.addEventListener('click', () => {
            const modalId = dot.getAttribute('data-modal-close');
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.add('hidden');
        });
    });

    // Click outside modal-content to close (for all .modal-overlay)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // Don't close config modal on first run
                if (overlay.id === 'config-modal' && isFirstRun) return;
                overlay.classList.add('hidden');
            }
        });
    });

    // Escape key — close any visible modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close Raio-X first
            const raiox = document.getElementById('raiox-overlay');
            if (raiox && !raiox.classList.contains('hidden')) {
                closeRaioXModal();
                return;
            }
            // Close any standard modal
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
                if (m.id === 'config-modal' && isFirstRun) return;
                m.classList.add('hidden');
            });
        }
    });

});


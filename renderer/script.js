document.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('click', event => {
        const el = event.target.closest('[data-action]');
        if (!el) return;
        const allowed = new Set(['openRaioXModal', 'editMeta', 'deleteMeta', 'editManualAsset', 'deleteManualAsset', 'editRendaFixa', 'deleteRendaFixa', 'editCripto', 'deleteCripto', 'irDeleteMonth']);
        if (allowed.has(el.dataset.action) && typeof window[el.dataset.action] === 'function') {
            event.stopPropagation();
            Promise.resolve(window[el.dataset.action](el.dataset.arg, el.dataset.second)).catch(error => showConfigToast(error.message));
        } else if (el.dataset.action === 'show-assets') document.getElementById('assets-list-container')?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    const safeMarkdown = value => DOMPurify.sanitize(marked.parse(String(value ?? '')), {USE_PROFILES: {html: true}, FORBID_TAGS: ['img', 'style', 'form', 'input', 'button'], FORBID_ATTR: ['style']});
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    const formatReturn = value => Number.isFinite(value) ? value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '—';
    function showDataWarnings(messages) {
        let box = document.getElementById('data-quality-warning');
        if (!box) {
            box = document.createElement('details'); box.id = 'data-quality-warning';
            box.style.cssText = 'margin:12px;padding:12px;border:1px solid #F59E0B;border-radius:8px';
            document.querySelector('main').prepend(box);
        }
        box.replaceChildren(); box.hidden = messages.length === 0;
        const title = document.createElement('summary'); title.textContent = messages.length + ' aviso(s) sobre os dados da carteira'; box.append(title);
        messages.forEach(message => { const p = document.createElement('p'); p.textContent = message; box.append(p); });
    }
    function readExtract(buffer) {
        const workbook = XLSX.read(buffer, {type: 'array'});
        const name = workbook.SheetNames.find(n => n.trim() === 'Movimentação') || workbook.SheetNames[0];
        if (!name) throw new Error('Planilha vazia.');
        return PortfolioCore.sheetRows(XLSX.utils.sheet_to_json(workbook.Sheets[name], {header: 1}));
    }

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

    // ==== NAVEGAÇÃO ENTRE TELAS E SIDEBAR EXECUTIVA ====
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');
    const pageTitle = document.getElementById('page-current-title');
    const pageSubtitle = document.getElementById('page-current-subtitle');

    const PAGE_TITLES = {
        'visao-executiva': { title: 'Visão Executiva', subtitle: 'Cockpit Patrimonial Consolidado' },
        'saude-carteira': { title: 'Saúde da Carteira', subtitle: 'Concentração, renda e qualidade dos dados' },
        'visao-geral': { title: 'Fundos Imobiliários', subtitle: 'Construção de Renda Passiva e Proventos (FIIs)' },
        'screen-acoes': { title: 'Ações', subtitle: 'Carteira de Ações e Empresas Brasileiras' },
        'screen-etfs': { title: 'ETFs', subtitle: 'Fundos de Índice Nacionais e Globais' },
        'screen-renda-fixa': { title: 'Renda Fixa', subtitle: 'Tesouro Direto, CDBs e Títulos Públicos' },
        'screen-cripto': { title: 'Criptomoedas', subtitle: 'Ativos Digitais e Criptoeconomia' },
        'proventos': { title: 'Proventos de FIIs', subtitle: 'Histórico de Dividendos e Rendimentos Mensais' },
        'patrimonio': { title: 'Evolução Patrimonial', subtitle: 'Histórico de Aportes e Valor Aplicado' },
        'rentabilidade': { title: 'Rentabilidade de FIIs', subtitle: 'Performance e Ganho de Capital' },
        'metas': { title: 'Metas Financeiras', subtitle: 'Planejamento e Independência Financeira' },
        'analise': { title: 'Análise da Carteira', subtitle: 'Resultados e metas com a Kaguya' },
        'simulador': { title: 'Simulador de Aportes', subtitle: 'Explore cenários com suas próprias premissas' },
        'ir-control': { title: 'Imposto de Renda', subtitle: 'Apuração Mensal de Ganhos de Capital e DARF' }
    };

    const FII_SCREENS = ['visao-geral', 'proventos', 'patrimonio', 'rentabilidade'];

    function switchScreen(targetId) {
        if (!targetId) return;

        const isFiiScreen = FII_SCREENS.includes(targetId);

        // Atualiza estado ativo dos botões nav-item
        navItems.forEach(nav => {
            const navTarget = nav.getAttribute('data-target');
            if (isFiiScreen) {
                if (navTarget === 'visao-geral') {
                    nav.classList.add('active');
                } else {
                    nav.classList.remove('active');
                }
            } else {
                if (navTarget === targetId) {
                    nav.classList.add('active');
                } else {
                    nav.classList.remove('active');
                }
            }
        });

        // Se estiver em telas de FIIs, mantém o acordeão Meus Investimentos aberto
        const groupInvestElem = document.getElementById('group-meus-investimentos');
        if (isFiiScreen && groupInvestElem) {
            groupInvestElem.classList.add('open');
        }

        // Alterna tela
        screens.forEach(screen => screen.classList.remove('active'));
        const targetScreen = document.getElementById(targetId);
        if (targetScreen) {
            targetScreen.classList.add('active');

            // Atualiza cabeçalho dinâmico da página
            if (isFiiScreen) {
                if (pageTitle) pageTitle.textContent = 'Fundos Imobiliários';
                if (pageSubtitle) {
                    const subtitles = {
                        'visao-geral': 'Resumo da Carteira, Posições e Foco na Construção',
                        'proventos': 'Proventos Recebidos, Calendário e Histórico de Rendimentos',
                        'patrimonio': 'Evolução Patrimonial e Histórico de Aportes',
                        'rentabilidade': 'Rentabilidade Individual e Ganho de Capital por Ativo'
                    };
                    pageSubtitle.textContent = subtitles[targetId] || 'Construção de Renda Passiva e Proventos (FIIs)';
                }

                // Sincroniza todas as sub-barras de FIIs para destacar a aba certa
                document.querySelectorAll('.fii-tab-btn').forEach(btn => {
                    if (btn.getAttribute('data-fii-tab') === targetId) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });

                // Atualiza visualizações específicas de FIIs caso necessário
                if (targetId === 'proventos' && typeof renderProventosScreen === 'function') {
                    renderProventosScreen();
                } else if (targetId === 'patrimonio' && typeof renderPatrimonioScreen === 'function') {
                    renderPatrimonioScreen();
                } else if (targetId === 'rentabilidade' && typeof renderRentabilidadeScreen === 'function') {
                    renderRentabilidadeScreen();
                }
            } else if (PAGE_TITLES[targetId]) {
                if (pageTitle) pageTitle.textContent = PAGE_TITLES[targetId].title;
                if (pageSubtitle) pageSubtitle.textContent = PAGE_TITLES[targetId].subtitle;
            }

            // Se for visão executiva, re-renderiza para atualizar métricas
            if (targetId === 'visao-executiva' && typeof renderExecutiveDashboard === 'function') {
                renderExecutiveDashboard();
            } else if (targetId === 'screen-acoes' && typeof renderAcoesScreen === 'function') {
                renderAcoesScreen();
            } else if (targetId === 'screen-etfs' && typeof renderEtfsScreen === 'function') {
                renderEtfsScreen();
            } else if (targetId === 'screen-renda-fixa' && typeof renderRendaFixaScreen === 'function') {
                renderRendaFixaScreen();
            } else if (targetId === 'screen-cripto' && typeof renderCriptoScreen === 'function') {
                renderCriptoScreen();
            }

            if (targetId === 'analise') window.AnalysisUI?.refresh();
            if (targetId === 'saude-carteira') window.HealthUI?.render();

            // Antigravity GSAP Animation
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(targetScreen.querySelectorAll('.card, .exec-kpi-card, .exec-chart-card, .chart-container, table, .btn-primary'), 
                    { y: 25, opacity: 0 }, 
                    { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "power3.out", clearProps: "all" }
                );
            }
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = item.getAttribute('data-target');
            if (targetId) {
                switchScreen(targetId);
            }
        });
    });

    // Toggle Acordeão "Meus Investimentos"
    const btnToggleInvest = document.getElementById('btn-toggle-investimentos');
    const groupInvest = document.getElementById('group-meus-investimentos');
    if (btnToggleInvest && groupInvest) {
        btnToggleInvest.addEventListener('click', (e) => {
            e.stopPropagation();
            groupInvest.classList.toggle('open');
        });
    }

    // Avatar do usuário na sidebar abre Configurações de perfil
    const btnSidebarProfile = document.getElementById('btn-sidebar-profile');
    const btnProfileConfigTarget = document.getElementById('btn-open-config');
    if (btnSidebarProfile && btnProfileConfigTarget) {
        btnSidebarProfile.addEventListener('click', () => {
            btnProfileConfigTarget.click();
            // Clica na primeira aba de Perfil
            const tabPerfil = document.querySelector('[data-config-tab="perfil"]');
            if (tabPerfil) tabPerfil.click();
        });
    }

    // Sincroniza abas internas de FIIs (.fii-tab-btn)
    const fiiTabBtns = document.querySelectorAll('.fii-tab-btn');
    fiiTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = btn.getAttribute('data-fii-tab');
            if (target) {
                switchScreen(target);
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

    // ==== ALTERNÂNCIA DE VISÃO: CATEGORIAS VS CONSTRUÇÃO ====
    const btnViewCategories = document.getElementById('btn-view-categories');
    const btnViewConstruction = document.getElementById('btn-view-construction');
    const assetsListContainer = document.getElementById('assets-list-container');
    const constructionViewContainer = document.getElementById('construction-view-container');

    if (btnViewCategories && btnViewConstruction) {
        btnViewCategories.addEventListener('click', () => {
            btnViewCategories.classList.add('active');
            btnViewConstruction.classList.remove('active');
            assetsListContainer.classList.remove('hidden');
            constructionViewContainer.classList.add('hidden');
            localStorage.setItem('assetsView', 'categories');
        });

        btnViewConstruction.addEventListener('click', () => {
            btnViewConstruction.classList.add('active');
            btnViewCategories.classList.remove('active');
            assetsListContainer.classList.add('hidden');
            constructionViewContainer.classList.remove('hidden');
            localStorage.setItem('assetsView', 'construction');
            renderConstructionView();
        });
    }

    // Abas internas da visualização Foco na Construção
    window.currentConstructionTab = 'prioridade';
    
    function attachConstructionTabListeners() {
        document.querySelectorAll('.construction-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clickedBtn = e.currentTarget;
                document.querySelectorAll('.construction-tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                clickedBtn.classList.add('active');
                clickedBtn.style.borderBottomColor = 'var(--primary-color)';
                clickedBtn.style.color = 'var(--text-primary)';
                
                const selectedTab = clickedBtn.getAttribute('data-tab');
                window.currentConstructionTab = selectedTab;
                
                // Re-render list
                renderConstructionList();
            });
        });
    }
    attachConstructionTabListeners();

    function restoreSavedAssetsView() {
        const savedView = localStorage.getItem('assetsView') || 'categories';
        if (savedView === 'construction' && btnViewConstruction && btnViewCategories && assetsListContainer && constructionViewContainer) {
            btnViewConstruction.classList.add('active');
            btnViewCategories.classList.remove('active');
            assetsListContainer.classList.add('hidden');
            constructionViewContainer.classList.remove('hidden');
        } else if (btnViewConstruction && btnViewCategories && assetsListContainer && constructionViewContainer) {
            btnViewCategories.classList.add('active');
            btnViewConstruction.classList.remove('active');
            assetsListContainer.classList.remove('hidden');
            constructionViewContainer.classList.add('hidden');
        }
    }

    // ==== CLASSIFICAÇÃO DE TICKERS ====
    function classifyTicker(ticker) {
        if (!ticker || typeof ticker !== 'string') return { type: 'normal', label: 'Normal' };
        const t = ticker.toUpperCase().trim();
        if (t.endsWith('12')) return { type: 'subscricao', label: 'Direito de Subscrição' };
        if (t.endsWith('13')) return { type: 'recibo', label: 'Recibo de Subscrição' };
        if (t.endsWith('F')) return { type: 'fracao', label: 'Fração' };
        return { type: 'normal', label: 'Normal' };
    }

    // ==== CLASSIFICAÇÃO DE ATIVOS (FIIs, ETFs, Tesouro Direto, Ações) ====
    function classifyAsset(produtoStr, ticker, overrides = {}) {
        const cleanTicker = ticker ? String(ticker).toUpperCase().trim() : '';

        // 1. Rede de segurança: Override manual configurado pelo usuário
        if (cleanTicker && overrides && overrides[cleanTicker]) {
            return overrides[cleanTicker];
        }

        const pUpper = produtoStr ? String(produtoStr).toUpperCase().trim() : '';

        // 2. Tesouro Direto / Renda Fixa
        if (pUpper.includes("TESOURO") || pUpper.includes("CDB") || pUpper.match(/\bCRA\b/) || pUpper.match(/\bCRI\b/) || pUpper.match(/\bLCI\b/)) {
            return "Tesouro Direto";
        }

        // 3. ETFs: prioridade pelo nome do produto oficial na B3 ("FUNDO DE ÍNDICE", "FDO DE INDICE", etc.) ou "ETF"
        const hasEtfName = pUpper.includes("FUNDO DE ÍNDICE") ||
                           pUpper.includes("FUNDO DE INDICE") ||
                           pUpper.includes("FDO DE INDICE") ||
                           pUpper.includes("FDO. DE INDICE") ||
                           pUpper.includes("FDO DE ÍNDICE") ||
                           pUpper.includes("FDO. DE ÍNDICE") ||
                           /\bETF\b/.test(pUpper);

        const isKnownEtfTicker = cleanTicker.startsWith("BOVA") ||
                                cleanTicker.startsWith("IVVB") ||
                                cleanTicker.startsWith("HASH") ||
                                cleanTicker.startsWith("SMAL") ||
                                cleanTicker.startsWith("XINA") ||
                                cleanTicker.startsWith("SPXI") ||
                                cleanTicker.startsWith("BRAX");

        if (hasEtfName || isKnownEtfTicker) {
            return "ETFs";
        }

        // 4. FIIs: regras robustas por nome
        if (pUpper.includes("FUNDO DE INV IMOB") ||
            pUpper.includes("FDO INV IMOB") ||
            pUpper.includes("FDO. INV. IMOB") ||
            pUpper.includes("IMOBILIARIO") ||
            pUpper.includes("IMOBILIÁRIO") ||
            pUpper.includes("FII ") ||
            pUpper.endsWith(" FII")) {
            return "FIIs";
        }

        // 5. Fallback final: ticker de 4 letras + "11" -> FIIs, senão Ações
        if (/^[A-Z]{4}11$/.test(cleanTicker) || /^[A-Z]{4}11[A-Z]?$/.test(cleanTicker)) {
            return "FIIs";
        }

        return "Ações";
    }

    // ==== CORES POR CLASSE (compartilhado entre donut + patrimônio) ====
    const CLASS_COLORS = {
        'FIIs': '#3B82F6',
        'Ações': '#6366F1',
        'ETFs': '#8B5CF6',
        'Tesouro Direto': '#10B981'
    };
    const CLASS_COLORS_ARRAY = Object.values(CLASS_COLORS);

    // ==== ESTADO DOS GRÁFICOS ====
    let charts = {
        evolution: null,
        allocation: null,
        patEvolution: null,
        patAportes: null,
        execRentabilidade: null,
        execAlocacao: null
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

    // =========================================================================
    // VSA EXECUTIVE DASHBOARD — COCKPIT MULTI-ATIVOS
    // =========================================================================
    let currentExecPeriod = 'YTD';

    function initExecutiveDashboard() {
        const periodBtns = document.querySelectorAll('#exec-period-filters .exec-period-btn');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                periodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentExecPeriod = btn.getAttribute('data-period') || 'YTD';
                renderExecutiveDashboard();
            });
        });

        const btnViewAll = document.getElementById('btn-view-all-positions');
        if (btnViewAll) {
            btnViewAll.addEventListener('click', () => {
                const fiiNav = document.querySelector('.nav-item[data-target="visao-geral"]');
                if (fiiNav) fiiNav.click();
            });
        }
    }

    function renderExecutiveDashboard() {
        const state = window.dashboardState || {};
        const categories = state.categories || {};
        
        // 1. Apuração consolidada de Fundos Imobiliários
        let fiiPatrimonio = 0;
        let fiiInvestido = 0;
        let fiiProventos = 0;
        
        if (categories && categories["FIIs"]) {
            fiiPatrimonio = categories["FIIs"].total || 0;
            fiiInvestido = categories["FIIs"].investedTotal || 0;
        }

        // Proventos de FIIs
        if (state.yieldTransactions && Array.isArray(state.yieldTransactions)) {
            fiiProventos = state.yieldTransactions
                .filter(y => y.assetClass === 'FIIs')
                .reduce((acc, y) => acc + (y.valTotal || 0), 0);
        } else {
            fiiProventos = state.proventosTotais || 0;
        }

        const fiiLucro = (fiiPatrimonio - fiiInvestido) + fiiProventos;

        // 2. Classes adicionais (Multi-ativos: Ações, ETFs, Renda Fixa, Cripto)
        const multiAssets = typeof loadMultiAssets === 'function' ? loadMultiAssets() : { rendaFixa: [], cripto: [], manualAssets: [] };

        // Ações: B3 + Manual
        let acoesPatrimonio = 0;
        let acoesInvestido = 0;
        let acoesProventos = 0;
        if (categories && categories["Ações"]) {
            acoesPatrimonio += categories["Ações"].total || 0;
            acoesInvestido += categories["Ações"].investedTotal || 0;
        }
        if (state.yieldTransactions && Array.isArray(state.yieldTransactions)) {
            acoesProventos = state.yieldTransactions
                .filter(y => y.assetClass === 'Ações')
                .reduce((acc, y) => acc + (y.valTotal || 0), 0);
        }
        (multiAssets.manualAssets || []).filter(a => a.classe === 'Ações').forEach(m => {
            const q = parseFloat(m.quant) || 0;
            const pm = parseFloat(m.pm) || 0;
            const t = (m.ticker || '').toUpperCase();
            const quote = (window.cachedQuotes && window.cachedQuotes[t]) || pm;
            acoesPatrimonio += q * quote;
            acoesInvestido += q * pm;
        });
        const acoesLucro = (acoesPatrimonio - acoesInvestido) + acoesProventos;

        // ETFs: B3 + Manual
        let etfsPatrimonio = 0;
        let etfsInvestido = 0;
        if (categories && categories["ETFs"]) {
            etfsPatrimonio += categories["ETFs"].total || 0;
            etfsInvestido += categories["ETFs"].investedTotal || 0;
        }
        (multiAssets.manualAssets || []).filter(a => a.classe === 'ETFs').forEach(m => {
            const q = parseFloat(m.quant) || 0;
            const pm = parseFloat(m.pm) || 0;
            const t = (m.ticker || '').toUpperCase();
            const quote = (window.cachedQuotes && window.cachedQuotes[t]) || pm;
            etfsPatrimonio += q * quote;
            etfsInvestido += q * pm;
        });
        const etfsLucro = etfsPatrimonio - etfsInvestido;

        // Renda Fixa: B3 + Manual
        let rfPatrimonio = 0;
        let rfInvestido = 0;
        if (categories && categories["Tesouro Direto"]) {
            rfPatrimonio += categories["Tesouro Direto"].total || 0;
            rfInvestido += categories["Tesouro Direto"].investedTotal || 0;
        }
        (multiAssets.rendaFixa || []).forEach(r => {
            const inv = parseFloat(r.valorInvestido) || 0;
            const cur = r.valorAtual !== undefined ? parseFloat(r.valorAtual) : inv;
            rfPatrimonio += cur;
            rfInvestido += inv;
        });
        const rfLucro = rfPatrimonio - rfInvestido;

        // Cripto: Manual
        let criptoPatrimonio = 0;
        let criptoInvestido = 0;
        (multiAssets.cripto || []).forEach(c => {
            const q = parseFloat(c.quant) || 0;
            const pm = parseFloat(c.pm) || 0;
            const sym = (c.simbolo || '').toUpperCase().trim();
            const quote = (window.cachedQuotes && window.cachedQuotes[sym]) || pm;
            criptoPatrimonio += q * quote;
            criptoInvestido += q * pm;
        });
        const criptoLucro = criptoPatrimonio - criptoInvestido;

        // Totais Consolidados da Carteira Global
        const totalConsolidado = fiiPatrimonio + acoesPatrimonio + etfsPatrimonio + rfPatrimonio + criptoPatrimonio;
        const investidoConsolidado = fiiInvestido + acoesInvestido + etfsInvestido + rfInvestido + criptoInvestido;
        const extraIncome = (state.yieldTransactions || []).filter(t => !['FIIs', 'Ações'].includes(t.assetClass)).reduce((sum,t) => sum+t.valTotal,0);
        const lucroConsolidado = fiiLucro + acoesLucro + etfsLucro + rfLucro + criptoLucro + extraIncome + (state.realizedGain || 0);

        const varPercentual = investidoConsolidado > 0 
            ? ((totalConsolidado - investidoConsolidado) / investidoConsolidado) * 100 
            : 0;

        const benchmark = executiveReturnData();
        const retornoGlobalPct = benchmark.portfolio.at(-1) ?? NaN;
        const money = value => Number.isFinite(value) ? value.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '—';
        const incomeRows = state.yieldTransactions || [];
        const lastIncomeMonth = incomeRows.map(t => t.monthKey).sort().at(-1);
        const lastTrade = (state.investTransactions || []).map(t => t.sortDate).sort().at(-1);
        for (const [id, value] of [
            ['exec-investido-total', investidoConsolidado],
            ['exec-valorizacao-total', totalConsolidado - investidoConsolidado],
            ['exec-proventos-total', incomeRows.reduce((sum,t) => sum + t.valTotal, 0)],
            ['exec-proventos-mes', incomeRows.filter(t => t.monthKey === lastIncomeMonth).reduce((sum,t) => sum + t.valTotal, 0)]
        ]) {
            const element = document.getElementById(id);
            if (element) element.textContent = money(value);
        }
        const importStatus = document.getElementById('exec-importacao-status');
        if (importStatus) importStatus.textContent = (lastIncomeMonth ? `Proventos: ${lastIncomeMonth.slice(4)}/${lastIncomeMonth.slice(0,4)}. ` : 'Sem proventos importados. ') +
            (lastTrade ? `Última compra/venda: ${lastTrade.slice(6)}/${lastTrade.slice(4,6)}/${lastTrade.slice(0,4)}. Novas operações dependem de um extrato atualizado.` : 'Sem compras/vendas importadas.');

        // Atualização dos Cards KPIs Executivos
        const elExecPatrimonio = document.getElementById('exec-patrimonio-total');
        if (elExecPatrimonio) {
            elExecPatrimonio.textContent = totalConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        const elExecVar = document.getElementById('exec-patrimonio-var');
        if (elExecVar) {
            const isPos = varPercentual >= 0;
            elExecVar.className = `exec-badge-pill ${isPos ? 'positive' : 'negative'}`;
            elExecVar.textContent = `${isPos ? '+' : ''}${varPercentual.toFixed(2)}%`;
        }

        const elExecRetorno = document.getElementById('exec-retorno-pct');
        if (elExecRetorno) {
            elExecRetorno.textContent = formatReturn(retornoGlobalPct);
            elExecRetorno.style.color = retornoGlobalPct >= 0 ? '#10B981' : '#EF4444';
        }

        const cdiRef = benchmark.cdi.at(-1) ?? NaN;
        const elExecCdi = document.getElementById('exec-cdi-comparativo');
        if (elExecCdi) {
            const diff = retornoGlobalPct - cdiRef;
            elExecCdi.textContent = Number.isFinite(diff) ? diff.toFixed(2) + ' p.p. vs CDI (' + formatReturn(cdiRef) + ')' : 'Comparação indisponível';
        }

        const elExecLucro = document.getElementById('exec-lucro-total');
        if (elExecLucro) {
            elExecLucro.textContent = lucroConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            elExecLucro.style.color = lucroConsolidado >= 0 ? '#10B981' : '#EF4444';
        }

        const elHealthNum = document.getElementById('exec-health-num');
        const elHealthStatus = document.getElementById('exec-health-status');
        if (elHealthNum && elHealthStatus) {
            let numAtivos = 0;
            if (categories) {
                Object.values(categories).forEach(c => {
                    if (c.ativos) numAtivos += Object.values(c.ativos).filter(a => a.quant > 0).length;
                });
            }
            numAtivos += (multiAssets.manualAssets || []).length;
            numAtivos += (multiAssets.rendaFixa || []).length;
            numAtivos += (multiAssets.cripto || []).length;

            elHealthNum.textContent = numAtivos;
            elHealthStatus.textContent = 'Ativos cadastrados';
        }

        // Gráficos e seções
        renderExecutiveBenchmarksChart(retornoGlobalPct, cdiRef);
        renderExecutiveAllocationChart(fiiPatrimonio, acoesPatrimonio, etfsPatrimonio, rfPatrimonio, criptoPatrimonio, totalConsolidado);
        renderExecutiveTopAssets(categories, totalConsolidado);
        window.AnalysisUI?.refresh();
        renderExecutiveRebalancing(fiiPatrimonio, acoesPatrimonio, etfsPatrimonio, rfPatrimonio, criptoPatrimonio, totalConsolidado);
    }

    function executiveReturnData() {
        const state = window.rentabState || {};
        let months = Object.keys(state.monthlyReturns || {}).sort();
        const count = {'1M':1, '6M':6, '1A':12}[currentExecPeriod];
        if (count) months = months.slice(-count);
        if (currentExecPeriod === 'YTD') {
            const selectedYear = window.globalYear === 'Todos' ? String(new Date().getFullYear()) : window.globalYear;
            months = months.filter(m => m.startsWith(selectedYear));
        }
        const compound = data => { let product=1; return months.map(m=> {product*=1+(data?.[m] ?? NaN)/100; return Number.isFinite(product) ? (product-1)*100 : null;}); };
        return {months,portfolio:compound(state.monthlyReturns),cdi:compound(state.indices?.CDI),ibov:compound(state.indices?.IBOV),ipca:compound(state.indices?.IPCA)};
    }

    function renderExecutiveBenchmarksChart(retornoGlobalPct, cdiRef) {
        const ctx = document.getElementById('execRentabilidadeChart');
        if (!ctx) return;

        const series = executiveReturnData();
        const labels = series.months.map(m => m.slice(5) + '/' + m.slice(2,4));
        const dataCarteira = series.portfolio;
        const dataCDI = series.cdi;
        const dataIbov = series.ibov;
        const dataIPCA = series.ipca;
        const status = document.getElementById('exec-benchmark-status');
        if (status) {
            const notes = [];
            if (series.months.length && !series.portfolio.some(Number.isFinite)) notes.push('Rentabilidade da carteira indisponível: confira os avisos de histórico e cotações.');
            for (const [key, label] of [['CDI', 'CDI'], ['IBOV', 'Ibovespa'], ['IPCA', 'IPCA']]) {
                const available = Object.keys(window.rentabState?.indices?.[key] || {}).sort();
                const last = available.at(-1);
                notes.push(last ? label + ' disponível até ' + last.slice(5) + '/' + last.slice(0, 4) + '.' : label + ': dados ainda indisponíveis.');
            }
            const comparable = series.months.map((month,i)=>({month,i})).filter(({i})=>Number.isFinite(series.portfolio[i]) && Number.isFinite(series.ipca[i])).at(-1);
            if (comparable) {
                const {month,i} = comparable;
                const difference = series.portfolio[i] - series.ipca[i];
                notes.push(`Até ${month.slice(5)}/${month.slice(0,4)}: carteira ${formatReturn(series.portfolio[i])}, IPCA ${formatReturn(series.ipca[i])} (${Math.abs(difference).toFixed(2)} p.p. ${difference >= 0 ? 'acima' : 'abaixo'}).`);
            }
            notes.push('Percentuais acumulados, incluindo proventos e descontando compras/vendas. O mês em andamento é parcial. Compare IPCA e carteira no mesmo mês publicado.');
            status.textContent = notes.join(' ');
        }

        if (charts.execRentabilidade) {
            charts.execRentabilidade.destroy();
        }

        const isLight = document.body.classList.contains('light-mode');
        const gridColor = getChartGridColor();

        charts.execRentabilidade = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Carteira VS&A (acumulado)',
                        data: dataCarteira,
                        borderColor: '#10B981',
                        backgroundColor: isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.15)',
                        borderWidth: 3,
                        pointBackgroundColor: '#10B981',
                        pointBorderColor: isLight ? '#FFFFFF' : '#111827',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.35
                    },
                    {
                        label: 'CDI 100%',
                        data: dataCDI,
                        borderColor: '#06B6D4',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 3,
                        tension: 0.2
                    },
                    {
                        label: 'Ibovespa',
                        data: dataIbov,
                        borderColor: '#8B5CF6',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.35
                    },
                    {
                        label: 'IPCA',
                        data: dataIPCA,
                        borderColor: '#F59E0B',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [3, 3],
                        pointRadius: 3,
                        spanGaps: false,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            color: isLight ? '#475569' : '#CBD5E1',
                            font: { size: 12, weight: '500' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const cumulative = ` ${context.dataset.label}: ${formatReturn(context.parsed.y)}`;
                                return context.datasetIndex === 0 ? [cumulative, ` No mês: ${formatReturn(window.rentabState?.monthlyReturns?.[series.months[context.dataIndex]])}`] : cumulative;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: isLight ? '#64748B' : '#94A3B8' }
                    },
                    y: {
                        grid: { color: gridColor, borderDash: [4, 4] },
                        ticks: {
                            color: isLight ? '#64748B' : '#94A3B8',
                            callback: function(val) { return val.toFixed(1) + '%'; }
                        }
                    }
                }
            }
        });
        const auditBody = document.getElementById('exec-performance-audit');
        if (auditBody) {
            const money = n => Number.isFinite(n) ? n.toLocaleString('pt-BR', {style:'currency',currency:'BRL'}) : '—';
            auditBody.innerHTML = series.months.map((month, i) => {
                const a = window.rentabState?.audit?.[month];
                if (!a) return '';
                return `<tr><td>${month.slice(5)}/${month.slice(0,4)}</td>${[a.openingValue,a.purchases,a.sales,a.income,a.closingValue,a.result].map(n=>`<td>${money(n)}</td>`).join('')}<td>${formatReturn(a.monthlyReturn)}</td><td>${formatReturn(series.portfolio[i] ?? NaN)}</td></tr>`;
            }).join('');
        }
    }

    function renderExecutiveAllocationChart(fiiPat, acoesPat, etfsPat, rfPat, criptoPat, total) {
        const ctx = document.getElementById('execAlocacaoChart');
        if (!ctx) return;

        const isDemo = total === 0;
        const dataValues = isDemo 
            ? [50, 25, 15, 10, 0] 
            : [fiiPat, acoesPat, etfsPat, rfPat, criptoPat];

        const labels = ['Fundos Imobiliários (FIIs)', 'Ações', 'ETFs', 'Renda Fixa', 'Cripto'];
        const colors = ['#10B981', '#3B82F6', '#06B6D4', '#8B5CF6', '#F59E0B'];

        if (charts.execAlocacao) {
            charts.execAlocacao.destroy();
        }

        charts.execAlocacao = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed || 0;
                                const tot = isDemo ? 100 : (total || 1);
                                const pct = (val / tot) * 100;
                                return isDemo 
                                    ? ` ${context.label}: ${pct.toFixed(1)}% (Ref.)`
                                    : ` ${context.label}: ${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${pct.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });

        const legendContainer = document.getElementById('exec-donut-legend');
        if (legendContainer) {
            const tot = isDemo ? 100 : (total || 1);
            let html = '';
            labels.forEach((label, idx) => {
                const val = dataValues[idx];
                const pct = (val / tot) * 100;
                if (pct > 0 || isDemo) {
                    html += `
                        <div class="exec-donut-item">
                            <div class="exec-donut-label-group">
                                <span class="exec-donut-dot" style="background: ${colors[idx]};"></span>
                                <span style="color: var(--text-secondary);">${label}</span>
                            </div>
                            <span class="exec-donut-val">${pct.toFixed(1)}%</span>
                        </div>
                    `;
                }
            });
            legendContainer.innerHTML = html;
        }
    }

    function renderExecutiveTopAssets(categories, totalConsolidado) {
        const tbody = document.getElementById('exec-top-assets-tbody');
        if (!tbody) return;

        let allItems = [];

        // FIIs da B3
        if (categories && categories["FIIs"] && categories["FIIs"].ativos) {
            Object.keys(categories["FIIs"].ativos).forEach(t => {
                const at = categories["FIIs"].ativos[t];
                if (at.quant > 0 || at.totalVal > 0) {
                    const pos = at.totalVal || 0;
                    const inv = at.investedVal || pos;
                    const ret = inv > 0 ? ((pos - inv) / inv) * 100 : 0;
                    allItems.push({ ticker: t, classe: 'FII', posicao: pos, retorno: ret });
                }
            });
        }

        // Ações da B3
        if (categories && categories["Ações"] && categories["Ações"].ativos) {
            Object.keys(categories["Ações"].ativos).forEach(t => {
                const at = categories["Ações"].ativos[t];
                if (at.quant > 0 || at.totalVal > 0) {
                    const pos = at.totalVal || 0;
                    const inv = at.investedVal || pos;
                    const ret = inv > 0 ? ((pos - inv) / inv) * 100 : 0;
                    allItems.push({ ticker: t, classe: 'Ação', posicao: pos, retorno: ret });
                }
            });
        }

        // ETFs da B3
        if (categories && categories["ETFs"] && categories["ETFs"].ativos) {
            Object.keys(categories["ETFs"].ativos).forEach(t => {
                const at = categories["ETFs"].ativos[t];
                if (at.quant > 0 || at.totalVal > 0) {
                    const pos = at.totalVal || 0;
                    const inv = at.investedVal || pos;
                    const ret = inv > 0 ? ((pos - inv) / inv) * 100 : 0;
                    allItems.push({ ticker: t, classe: 'ETF', posicao: pos, retorno: ret });
                }
            });
        }

        const multiAssets = typeof loadMultiAssets === 'function' ? loadMultiAssets() : { rendaFixa: [], cripto: [], manualAssets: [] };

        // Ativos manuais (Ações e ETFs)
        (multiAssets.manualAssets || []).forEach(m => {
            const t = (m.ticker || '').toUpperCase();
            const q = parseFloat(m.quant) || 0;
            const pm = parseFloat(m.pm) || 0;
            const quote = (window.cachedQuotes && window.cachedQuotes[t]) || pm;
            const pos = q * quote;
            const inv = q * pm;
            const ret = inv > 0 ? ((pos - inv) / inv) * 100 : 0;

            const existing = allItems.find(x => x.ticker === t);
            if (existing) {
                existing.posicao += pos;
            } else {
                allItems.push({
                    ticker: t,
                    classe: m.classe === 'ETFs' ? 'ETF' : 'Ação',
                    posicao: pos,
                    retorno: ret
                });
            }
        });

        // Renda Fixa Manual
        (multiAssets.rendaFixa || []).forEach(r => {
            const inv = parseFloat(r.valorInvestido) || 0;
            const cur = r.valorAtual !== undefined ? parseFloat(r.valorAtual) : inv;
            const ret = inv > 0 ? ((cur - inv) / inv) * 100 : 0;
            allItems.push({
                ticker: r.nome || 'Renda Fixa',
                classe: 'Renda Fixa',
                posicao: cur,
                retorno: ret
            });
        });

        // Criptoativos
        (multiAssets.cripto || []).forEach(c => {
            const sym = (c.simbolo || '').toUpperCase();
            const q = parseFloat(c.quant) || 0;
            const pm = parseFloat(c.pm) || 0;
            const quote = (window.cachedQuotes && window.cachedQuotes[sym]) || pm;
            const pos = q * quote;
            const inv = q * pm;
            const ret = inv > 0 ? ((pos - inv) / inv) * 100 : 0;
            allItems.push({
                ticker: sym,
                classe: 'Cripto',
                posicao: pos,
                retorno: ret
            });
        });

        allItems.sort((a, b) => b.posicao - a.posicao);
        const top5 = allItems.slice(0, 5);

        if (top5.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 18px; color: var(--text-tertiary);">Nenhum ativo importado ainda. Importe seu extrato B3 ou adicione ativos manualmente para consolidar.</td></tr>`;
            return;
        }

        const tot = totalConsolidado > 0 ? totalConsolidado : 1;
        let html = '';
        top5.forEach(asset => {
            const peso = (asset.posicao / tot) * 100;
            const isPos = asset.retorno >= 0;
            const imported = Object.values(categories || {}).map(c => c.ativos?.[asset.ticker]).find(Boolean);
            const income = (window.dashboardState?.yieldTransactions || []).filter(t => t.ticker === asset.ticker).reduce((sum,t) => sum + t.valTotal, 0);
            const detail = imported ? `<small style="display:block; color:var(--text-secondary); font-weight:400;">Custo importado: ${imported.investedVal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}<br>Proventos no período: ${income.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</small>` : '';
            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(asset.ticker)}</td>
                    <td><span class="sidebar-badge-pro" style="background: rgba(16, 185, 129, 0.15); color: #34D399;">${asset.classe}</span></td>
                    <td style="font-weight: 600;">${asset.posicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${detail}</td>
                    <td style="color: var(--text-secondary);">${peso.toFixed(1)}%</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${asset.retorno.toFixed(2)}%</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    function renderExecutiveRebalancing(fiiPat, acoesPat, etfsPat, rfPat, criptoPat, total) {
        const container = document.getElementById('exec-rebalance-container');
        if (!container) return;

        const tot = total > 0 ? total : 1;
        const classes = [
            { name: 'Fundos Imobiliários', atual: (fiiPat / tot) * 100, ideal: 40, color: '#10B981' },
            { name: 'Ações Brasileiras', atual: (acoesPat / tot) * 100, ideal: 25, color: '#3B82F6' },
            { name: 'ETFs Globais', atual: (etfsPat / tot) * 100, ideal: 15, color: '#06B6D4' },
            { name: 'Renda Fixa & Reserva', atual: (rfPat / tot) * 100, ideal: 15, color: '#8B5CF6' },
            { name: 'Criptomoedas', atual: (criptoPat / tot) * 100, ideal: 5, color: '#F59E0B' }
        ];

        let html = '';
        classes.forEach(c => {
            const diff = c.ideal - c.atual;
            const statusText = Math.abs(diff) <= 3 
                ? '✅ Equilibrado' 
                : (diff > 0 ? `Aportar +${diff.toFixed(0)}%` : `Aguardar`);
            const statusColor = Math.abs(diff) <= 3 ? '#34D399' : (diff > 0 ? '#60A5FA' : 'var(--text-tertiary)');

            html += `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                        <span style="font-weight: 500; color: var(--text-primary);">${c.name}</span>
                        <span style="color: ${statusColor}; font-weight: 600; font-size: 0.76rem;">${statusText}</span>
                    </div>
                    <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; position: relative;">
                        <div style="width: ${Math.min(c.atual, 100)}%; height: 100%; background: ${c.color}; border-radius: 3px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-tertiary);">
                        <span>Atual: ${c.atual.toFixed(1)}%</span>
                        <span>Meta: ${c.ideal}%</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // ==== AUTO-LOAD EXTRATO LOCAL ====
    async function loadLocalExtrato() {
        try {
            const files = await window.api.getExtratoFiles();
            if (!files || files.length === 0) {
                if (window.b3Data?.length > 1) throw new Error('Nenhum extrato encontrado para atualizar os dados existentes.');
                return;
            }

            const extracts = [], errors = [];
            for (const file of files) {
                try { extracts.push(readExtract(new Uint8Array(file.buffer))); }
                catch (error) { errors.push(file.fileName + ': ' + error.message); }
            }
            window.importWarnings = errors;
            if (!extracts.length) { showDataWarnings(errors); return; }
            const loadedCount = extracts.length;
            const b3Data = PortfolioCore.mergeExtracts(extracts);
            window.b3Data = b3Data;
            localStorage.removeItem('dismissed_rights_alert'); // Reset alert dismissal on new import/sync

            const uploadLabel = document.getElementById('btn-upload-label');
            if (uploadLabel) {
                uploadLabel.innerHTML = `<span class="icon" style="color:#10B981">✔</span> Sincronizado (${loadedCount} arquivo${loadedCount > 1 ? 's' : ''})`;
            }
            await renderDashboards();
        } catch(err) {
            console.log("Erro ao carregar extratos locais.", err);
            window.importWarnings = ['Não foi possível ler os extratos locais. Os dados exibidos não foram atualizados.'];
            showDataWarnings(window.importWarnings);
            const label = document.getElementById('btn-upload-label');
            if (label) label.textContent = 'Falha ao ler extratos';
        }
    }

    // Chama o carregamento logo após iniciar os gráficos
    // Import starts after configuration is loaded.

    // ==== IMPORTAÇÃO EXTRATO B3 via SheetJS ====
    const excelUpload = document.getElementById('excel-upload');
    const uploadLabel = document.getElementById('btn-upload-label');

    if (excelUpload) {
        excelUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            uploadLabel.innerHTML = `<span class="icon">⌛</span> Processando...`;

            const reader = new FileReader();
            reader.onload = async function (evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    window.b3Data = PortfolioCore.mergeExtracts([readExtract(data)]);
                    window.importWarnings = [];
                    localStorage.removeItem('dismissed_rights_alert'); // Reset alert dismissal on new import
                    await renderDashboards();

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
        const originalText = btnRefreshQuotes.innerHTML;
        let refreshLabelTimer;
        btnRefreshQuotes.addEventListener('click', async () => {
            if (!window.b3Data || window.b3Data.length < 2) return;
            clearTimeout(refreshLabelTimer);
            btnRefreshQuotes.disabled = true;
            btnRefreshQuotes.innerHTML = `<span class="icon">⌛</span> Atualizando...`;
            try {
                const result = await renderDashboards(true);
                btnRefreshQuotes.textContent = result?.quotesIncomplete ? '⚠ Atualização parcial' : '✔ Atualizado';
            } catch (error) {
                btnRefreshQuotes.textContent = '⚠ Falha ao atualizar';
                showConfigToast(error.message);
            } finally {
                btnRefreshQuotes.disabled = false;
                refreshLabelTimer = setTimeout(() => { btnRefreshQuotes.innerHTML = originalText; }, 3000);
            }
        });
    }

    const globalYearFilter = document.getElementById('global-year-filter');
    if (globalYearFilter) {
        globalYearFilter.addEventListener('change', async (e) => {
            window.globalYear = e.target.value;
            await renderDashboards();
            irActiveYear = window.globalYear === 'Todos' ? new Date().getFullYear() : Number(window.globalYear);
            irRenderTable();
        });
    }

    let dashboardRenderId = 0;
    async function renderDashboards(forceRefresh = false) {
        const renderId = ++dashboardRenderId;
        if (!window.globalYear) {
            window.globalYear = 'Todos';
        }

        const rows = window.b3Data;
        if (!rows || rows.length < 2) return;

        const ledger = PortfolioCore.account(rows,
            (product, ticker) => classifyAsset(product, ticker, window.appConfig?.asset_class_overrides || {}),
            classifyTicker, window.globalYear);
        const {categories, monthlyInvestments, monthlyYields, yieldTransactions, investTransactions} = ledger;
        const allYearsSet = new Set(ledger.years);
        const totalPatrimonio = ledger.totalCost;
        const proventosTotais = ledger.income;
        rentabMonthlyPricesCache = null;
        window.rentabState = null;
        const warnings = [...(window.importWarnings || []), ...ledger.warnings];
        if (ledger.invalidHistory) warnings.push('Histórico incompleto ou evento não reconhecido: confira posições e custos. A rentabilidade ficará indisponível até a conciliação.');

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

        // Inclui ativos manuais e criptomoedas na consulta de cotações em tempo real
        const multiSt = typeof loadMultiAssets === 'function' ? loadMultiAssets() : { manualAssets: [], cripto: [] };
        (multiSt.manualAssets || []).forEach(m => {
            const t = (m.ticker || '').toUpperCase().trim();
            if (t && !allTickers.includes(t)) allTickers.push(t);
        });
        (multiSt.cripto || []).forEach(c => {
            const sym = (c.simbolo || '').toUpperCase().trim();
            if (sym && !allTickers.includes(sym)) allTickers.push(sym);
        });

        let currentPatrimonioReal = 0;
        let quoteStatuses = {};
        let quotesIncomplete = false;
        Object.values(categories).forEach(cat => Object.values(cat.ativos).forEach(a => { a.currentPrice = a.avgPrice; a.quoteUnavailable = true; }));

        if (allTickers.length > 0) {
            try {
                let quotes = await window.api.getQuotes(allTickers, forceRefresh);
                const statuses = await window.api.getQuoteStatus(allTickers);
                quoteStatuses = statuses || {};
                quotesIncomplete = allTickers.some(t => statuses[t]?.refreshFailed || statuses[t]?.stale || quotes[t] === undefined);
                if (window.globalYear === 'Todos' || +window.globalYear >= new Date().getFullYear()) {
                    allTickers.filter(t => statuses[t]?.refreshFailed || (statuses[t]?.stale && quotes[t] !== undefined)).forEach(t => {
                        const info = statuses[t];
                        const when = info.timestamp ? new Date(info.timestamp * 1000).toLocaleString('pt-BR') : null;
                        warnings.push(t + ': ' + (info.error || 'Não foi possível obter uma cotação recente.') + (when ? ' Última consulta válida: ' + when + '.' : ''));
                    });
                }
                if (window.globalYear !== 'Todos' && +window.globalYear < new Date().getFullYear()) {
                    const history = await window.api.getMonthlyPrices(allTickers, (new Date().getFullYear() - +window.globalYear + 1) + 'y');
                    quotes = Object.fromEntries(allTickers.filter(t => Number.isFinite(history[t]?.[window.globalYear + '-12'])).map(t => [t, history[t][window.globalYear + '-12']]));
                }
                if (renderId !== dashboardRenderId) return;
                window.cachedQuotes = Object.assign(window.cachedQuotes || {}, quotes);

                Object.keys(categories).forEach(cat => {
                    let catRealTotal = 0;
                    Object.keys(categories[cat].ativos).forEach(t => {
                        const ativo = categories[cat].ativos[t];
                        ativo.investedVal = ativo.totalVal; // Original cost basis

                        if (quotes[t] !== undefined) {
                            ativo.quoteUnavailable = false;
                            ativo.currentPrice = quotes[t];
                            ativo.totalVal = ativo.quant * quotes[t]; // New market value
                        } else {
                            if (ativo.quant > 0) warnings.push(t + ': cotação indisponível; posição exibida pelo custo de aquisição.');
                            ativo.quoteUnavailable = true;
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
                quotesIncomplete = true;
                warnings.push('Não foi possível atualizar as cotações. As posições são exibidas pelo custo de aquisição.');
                currentPatrimonioReal = totalPatrimonio;
            }
        } else {
            currentPatrimonioReal = totalPatrimonio;
        }

        if (renderId !== dashboardRenderId) return;
        const ganhoCapital = currentPatrimonioReal - totalPatrimonio;
        const lucroTotal = proventosTotais + ganhoCapital + ledger.realizedGain;
        showDataWarnings(warnings);

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
            allYields: ledger.allYields,
            invalidHistory: ledger.invalidHistory || !!window.importWarnings?.length,
            realizedGain: ledger.realizedGain,
            monthlyInvestments: monthlyInvestments,
            monthlyYields: monthlyYields,
            yieldTransactions: yieldTransactions,
            investTransactions: investTransactions,
            proventosTotais: proventosTotais,
            quoteStatuses: quoteStatuses
        };

        window.proventoFilters = window.proventoFilters || {
            viewType: 'Mensal',
            selectedYear: 'Todos',
            selectedType: 'Todos'
        };

        populateFilters();
        updateFilteredCharts();
        renderProventosScreen();
        const historyReady = renderRentabilidadeScreen(forceRefresh);
        renderPatrimonioScreen();

        renderAssetsAccordion(categories, currentPatrimonioReal);
        renderConstructionView();
        restoreSavedAssetsView();

        // ---- INTEGRAÇÃO DIRETA COM AS METAS ----
        // Reload metas after B3 data is available so applyB3DataToMetas() calculates values
        loadMetas();

        // Renderiza telas multi-ativos
        if (typeof renderAcoesScreen === 'function') renderAcoesScreen();
        if (typeof renderEtfsScreen === 'function') renderEtfsScreen();
        if (typeof renderRendaFixaScreen === 'function') renderRendaFixaScreen();
        if (typeof renderCriptoScreen === 'function') renderCriptoScreen();

        // Atualiza o Cockpit Executivo Consolidado
        renderExecutiveDashboard();
        window.HealthUI?.render();
        await historyReady;
        return {quotesIncomplete};
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
            allocBgColors = Object.keys(categories).filter(c => categories[c].total > 0).map(c => CLASS_COLORS[c] || '#6B7280');
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

        const grouped = FiiSegments.group(categories.FIIs || {}, window.appConfig?.fii_segment_overrides || {});
        categories = grouped.categories;
        globalTotal = grouped.total;

        let totalAssetsCount = 0;
        let totalRightsTickers = 0;

        const classIcons = FiiSegments.icons;

        Object.keys(categories).forEach(catName => {
            const cat = categories[catName];
            const activeKeys = Object.keys(cat.ativos).filter(k => cat.ativos[k].quant > 0 || cat.ativos[k].totalVal > 0);

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
            clone.querySelector('.part-pct').textContent = `${pctCarteira}% dos FIIs`;

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
                                <span class="raiox-ticker-link" data-action="openRaioXModal" data-arg="${escapeHtml(ticker)}">${ticker}</span>
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

            // ============ SPECIAL ASSETS ============
            const specialKeys = cat.specialAtivos ? Object.keys(cat.specialAtivos).filter(k => cat.specialAtivos[k].quant > 0) : [];
            if (specialKeys.length > 0) {
                const specialSection = document.createElement('div');
                specialSection.className = 'special-assets-section';
                
                let sHtml = `
                    <div class="special-assets-header">
                        <span class="icon">⏱️</span> Direitos e Subscrições
                    </div>
                    <table class="assets-table special-table">
                        <thead>
                            <tr>
                                <th>Ativo</th>
                                <th>Tipo</th>
                                <th>Quant.</th>
                                <th>Vencimento</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                specialKeys.forEach(ticker => {
                    const ativo = cat.specialAtivos[ticker];
                    if (ativo.type === 'subscricao') totalRightsTickers++;
                    
                    let badgeClass = 'badge-special-default';
                    let tooltip = 'Fração de cota — resultado de grupamentos ou desdobramentos. Verifique como sua corretora irá tratar.';
                    if (ativo.type === 'subscricao') {
                        badgeClass = 'badge-special-warning';
                        tooltip = 'Direito de subscrição — você tem um prazo para exercer ou vender este direito na sua corretora. Verifique a data de vencimento.';
                    } else if (ativo.type === 'recibo') {
                        badgeClass = 'badge-special-info';
                        tooltip = 'Recibo de subscrição — será convertido em cotas normais após a conclusão do processo de subscrição.';
                    }

                    sHtml += `
                        <tr>
                            <td>
                                <div class="asset-table-ticker" style="cursor: pointer" data-action="openRaioXModal" data-arg="${escapeHtml(ticker)}" data-second="${escapeHtml(ativo.type)}">
                                    <span style="font-weight: 600; color: var(--text-primary); text-decoration: underline dotted;">${ticker}</span>
                                </div>
                            </td>
                            <td><span class="${badgeClass}" title="${tooltip}">${ativo.typeLabel}</span></td>
                            <td>${ativo.quant.toLocaleString('pt-BR')}</td>
                            <td>${ativo.expiration || '-'}</td>
                        </tr>
                    `;
                });
                sHtml += `</tbody></table>`;
                specialSection.innerHTML = sHtml;
                clone.querySelector('.asset-group-content').appendChild(specialSection);
            }

            container.appendChild(clone);
        });

        let assetsCountText = `(${totalAssetsCount})`;
        if (totalRightsTickers > 0) {
            assetsCountText += ` · ${totalRightsTickers} direito(s) pendente(s)`;
            if (typeof showProactiveAlert === 'function') {
                showProactiveAlert(totalRightsTickers);
            }
        } else {
            if (typeof hideProactiveAlert === 'function') {
                hideProactiveAlert();
            }
        }
        document.getElementById('total-assets-count').textContent = assetsCountText;
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
                                <span class="raiox-ticker-link" data-action="openRaioXModal" data-arg="${escapeHtml(t.ticker)}">${t.ticker}</span>
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
    let rentabRequestId = 0;

    async function renderRentabilidadeScreen(forceRefresh = false) {
        if (!window.dashboardState) return;
        const requestId = ++rentabRequestId;
        const snapshot = window.dashboardState;
        const { investTransactions, categories } = snapshot;
        if (!investTransactions || investTransactions.length === 0) return;

        const allTickers = [...new Set(investTransactions.map(t => t.ticker))];
        if (!allTickers.length) return;
        const historyYears = Math.max(2, new Date().getFullYear() - Number(investTransactions[0].sortDate.slice(0, 4)) + 1);
        const [priceResult, indexResult] = await Promise.allSettled([
            window.api.getMonthlyPrices(allTickers, historyYears + 'y', forceRefresh),
            window.api.getIndices(historyYears + 'y', forceRefresh)
        ]);
        if (requestId !== rentabRequestId || snapshot !== window.dashboardState) return;
        rentabMonthlyPricesCache = priceResult.status === 'fulfilled' ? priceResult.value : {};
        rentabIndicesCache = indexResult.status === 'fulfilled' ? indexResult.value : {};

        // Use the very same quote snapshot as the position cards for the open month.
        // Historical month-end prices remain unchanged; never replace missing quotes with cost.
        if (window.globalYear === 'Todos' || +window.globalYear === new Date().getFullYear()) {
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            rentabMonthlyPricesCache = Object.fromEntries(Object.entries(rentabMonthlyPricesCache).map(([ticker, prices]) => [ticker, {...prices}]));
            Object.values(categories).forEach(cat => Object.entries(cat.ativos).forEach(([ticker, asset]) => {
                if (asset.quant > 0 && !asset.quoteUnavailable && Number.isFinite(asset.currentPrice)) {
                    (rentabMonthlyPricesCache[ticker] ||= {})[month] = asset.currentPrice;
                }
            }));
        }

        const audit = {};
        const monthlyReturns = calculateTWR(investTransactions, rentabMonthlyPricesCache, categories, audit);
        
        // Store for filters
        window.rentabState = {
            monthlyReturns: monthlyReturns,
            audit,
            indices: rentabIndicesCache,
            monthlyPrices: rentabMonthlyPricesCache
        };

        renderRentabChart(monthlyReturns, rentabIndicesCache);
        renderRentabKPIs(monthlyReturns, rentabIndicesCache);
        renderRentabTable(monthlyReturns);
        renderRentabIndividual(investTransactions, rentabMonthlyPricesCache, categories);
        renderExecutiveDashboard();
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

    function calculateTWR(investTxs, monthlyPrices, categories, audit = null) {
        const end = window.globalYear && window.globalYear !== 'Todos' && +window.globalYear < new Date().getFullYear()
            ? new Date(+window.globalYear, 11, 31) : new Date();
        const returns = PortfolioCore.monthlyReturns(investTxs, monthlyPrices, window.dashboardState?.allYields || [], end, audit);
        if (window.dashboardState?.invalidHistory) Object.keys(returns).forEach(m => { returns[m] = NaN; if (audit?.[m]) audit[m].monthlyReturn = NaN; });
        return returns;
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
                const ret = monthlyMap[m] !== undefined ? monthlyMap[m] : NaN;
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
            totalProduct *= (1 + (monthlyReturns[m] ?? NaN) / 100);
        });
        const totalReturn = (totalProduct - 1) * 100;

        // Last 12 months
        const last12 = sortedMonths.slice(-12);
        let last12Product = 1;
        last12.forEach(m => {
            last12Product *= (1 + (monthlyReturns[m] ?? NaN) / 100);
        });
        const last12Return = (last12Product - 1) * 100;

        // Last month
        const lastMonth = sortedMonths[sortedMonths.length - 1];
        const lastMonthReturn = monthlyReturns[lastMonth] ?? NaN;

        // CDI comparison
        let cdiTotal = NaN, cdi12 = NaN, cdiLastMonth = NaN;
        if (indices.CDI) {
            cdiTotal = 1; cdi12 = 1;
            sortedMonths.forEach(m => {
                cdiTotal *= (1 + (indices.CDI[m] ?? NaN) / 100);
            });
            last12.forEach(m => {
                cdi12 *= (1 + (indices.CDI[m] ?? NaN) / 100);
            });
            cdiLastMonth = indices.CDI[lastMonth] ?? NaN;
        }
        const cdiTotalPct = (cdiTotal - 1) * 100;
        const cdi12Pct = (cdi12 - 1) * 100;

        function updateKPI(elId, benchId, value, benchValue) {
            const el = document.getElementById(elId);
            if (el) {
                el.textContent = formatReturn(value);
            }
            const trendIcon = el?.parentElement?.querySelector('.rentab-trend-icon');
            if (trendIcon) {
                trendIcon.textContent = value >= 0 ? '↗' : '↘';
                trendIcon.className = `rentab-trend-icon ${value >= 0 ? 'positive' : 'negative'}`;
            }
            const benchEl = document.getElementById(benchId);
            if (benchEl) benchEl.innerHTML = '<option>Comparação indisponível</option>';
            if (benchEl && Number.isFinite(value) && Number.isFinite(benchValue) && benchValue > 0) {
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
                    tr += `<td class="${cls}">${formatReturn(val)}</td>`;
                } else {
                    tr += `<td class="rentab-zero">-</td>`;
                }
            }
            const yearRet = cumByYear[year].yearReturn;
            const cumRet = cumByYear[year].cumReturn;
            const yrCls = yearRet > 0.001 ? 'rentab-positive' : (yearRet < -0.001 ? 'rentab-negative' : 'rentab-zero');
            tr += `<td class="rentab-acum-cell">${formatReturn(yearRet)}</td>`;
            tr += `<td class="rentab-acum-cell">${formatReturn(cumRet)}</td>`;
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
                retLabel.textContent = formatReturn(data.totalReturn);
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
                                tr += `<td class="${cls}">${formatReturn(val)}</td>`;
                            } else {
                                tr += `<td class="rentab-zero">-</td>`;
                            }
                        }
                        const yRet = cumByYear[year].yearRet;
                        const cRet = cumByYear[year].cumRet;
                        const yrCls = yRet > 0.001 ? 'rentab-positive' : (yRet < -0.001 ? 'rentab-negative' : 'rentab-zero');
                        tr += `<td class="rentab-acum-cell ${yrCls}">${formatReturn(yRet)}</td>`;
                        const crCls = cRet > 0.001 ? 'rentab-positive' : (cRet < -0.001 ? 'rentab-negative' : 'rentab-zero');
                        tr += `<td class="rentab-acum-cell ${crCls}">${formatReturn(cRet)}</td>`;
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

    // Goals are evaluated independently from their persisted definitions.
    let currentMetas = [];
    function applyB3DataToMetas() { window.GoalsUI.refresh(); }
    function renderMetas() { window.GoalsUI.refresh(); }
    async function loadMetas() { return window.GoalsUI.load(); }
    window.GoalsUI.init(metas => { currentMetas = metas; });

    // ==========================================
    // INTEGRAÇÃO DE IA (ANALISE E CHAT)
    // ==========================================
    async function buildAnalysisSnapshot() {
        const metas = await window.api.getMetas();
        return AnalysisCore.build(window.dashboardState || {}, window.rentabState || {}, metas, window.globalYear || 'Todos');
    }
    window.AnalysisUI.init(buildAnalysisSnapshot, () => openChatDrawer());

    // Chat com IA
    const chatInput = document.getElementById('ai-chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatMessages = document.getElementById('ai-chat-messages');
    const btnClearChat = document.getElementById('btn-clear-chat');
    const aiTyping = document.getElementById('ai-typing');
    
    let chatSessionId = "session_" + Date.now();
    let activeConversation = null;
    function displayConversation(conv) {
        activeConversation = conv; chatSessionId = conv.id;
        chatMessages.replaceChildren();
        conv.messages.forEach(m => addChatMessage(m.role, m.content));
    }
    async function renderConversations() {
        const list = document.getElementById('chat-conv-list');
        if (!list) return;
        const conversations = await window.api.getConversations();
        list.replaceChildren();
        for (const conv of conversations) {
            const item = document.createElement('div');
            item.className = 'chat-conv-item' + (conv.id === activeConversation?.id ? ' active' : '');
            const select = document.createElement('button');
            select.type = 'button'; select.className = 'chat-conv-item-title'; select.textContent = conv.title;
            select.style.cssText = 'background:none;border:0;color:inherit;text-align:left;cursor:pointer;width:100%';
            select.addEventListener('click', async () => {
                if (chatInput.disabled) return;
                await window.api.setActiveConversation(conv.id);
                displayConversation(await window.api.getActiveConversation());
                await renderConversations();
            });
            const remove = document.createElement('button');
            remove.type = 'button'; remove.textContent = '×'; remove.title = 'Excluir conversa'; remove.className = 'chat-conv-delete-btn';
            remove.addEventListener('click', async () => {
                if (chatInput.disabled || !confirm('Excluir esta conversa do histórico?')) return;
                await window.api.deleteConversation(conv.id);
                displayConversation(await window.api.getActiveConversation());
                await renderConversations();
            });
            item.append(select, remove); list.append(item);
        }
    }
    const chatReady = window.api.getActiveConversation().then(async conv => {
        displayConversation(conv);
        await renderConversations();
    }).catch(error => { console.error('Erro ao restaurar conversa:', error); });
    document.getElementById('btn-new-conversation')?.addEventListener('click', async () => {
        if (chatInput.disabled) return;
        await chatReady;
        displayConversation(await window.api.createConversation());
        addChatMessage('bot', 'Nova conversa com a Kaguya. Como posso ajudar?');
        await renderConversations();
    });

    function addChatMessage(role, text, avatarEmotion = 'curiosa') {
        if (!chatMessages) return;
        
        const isBot = role === 'bot';
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-msg ai-msg-${isBot ? 'bot' : 'user'}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'ai-msg-avatar';

        if (isBot) {
            let avatarImgSrc = 'assets/kaguya/kaguya_curiosa_avatar.png';
            if (avatarEmotion === 'ideia') {
                avatarImgSrc = 'assets/kaguya/kaguya_ideia_avatar.png';
            } else if (avatarEmotion === 'surpresa') {
                avatarImgSrc = 'assets/kaguya/kaguya_surpresa_avatar.png';
            } else if (avatarEmotion === 'brava' || (typeof text === 'string' && (text.startsWith('**Erro') || text.includes('Erro:')))) {
                avatarImgSrc = 'assets/kaguya/kaguya_brava_avatar.png';
            }
            avatarDiv.innerHTML = `<img src="${avatarImgSrc}" class="ai-msg-avatar-img" alt="Kaguya" />`;
        } else {
            avatarDiv.textContent = '👤';
        }
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'ai-msg-bubble';
        
        // Se for o bot, formata o markdown
        if (isBot && typeof marked !== 'undefined') {
            bubbleDiv.innerHTML = safeMarkdown(text);
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
            const slimPortfolioData = { snapshot: await buildAnalysisSnapshot() };
            slimPortfolioData.snapshot.previousAnalysis = window.AnalysisUI.lastReport();
            await chatReady;
            if (!activeConversation) throw new Error('Conversa indisponível.');
            const data = await window.api.aiChat({ session_id: chatSessionId, conversation_id: activeConversation.id, message: userMsg, portfolio_data: slimPortfolioData });
            
            if (aiTyping) aiTyping.classList.add('hidden');
            
            if (data.error) {
                addChatMessage('bot', `**Erro:** ${data.error}`, 'brava');
            } else if (data.response) {
                addChatMessage('bot', data.response, 'curiosa');
            }
            await renderConversations();
        } catch(e) {
            if (aiTyping) aiTyping.classList.add('hidden');
            addChatMessage('bot', `**Erro de conexão:** Não foi possível comunicar com o servidor.`, 'brava');
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
        btnClearChat.addEventListener('click', async () => {
            if (chatInput.disabled) return;
            await chatReady;
            activeConversation = await window.api.createConversation();
            if (!chatMessages) return;
            // Cria uma nova sessão para esquecer historico do back-end
            chatSessionId = activeConversation.id;
            
            // Mantém apenas a barra de digitação se ela estiver dentro, e reseta
            chatMessages.innerHTML = '';
            addChatMessage('bot', "Olá! Sou a **Kaguya**, sua assistente financeira no VS&A. ✨\n\nImporte seus dados B3 e me pergunte qualquer coisa sobre seus investimentos, metas e estratégias!", 'curiosa');
        });
    }

    // ==========================================
    // CHAT DRAWER - MENU LATERAL PERSISTENTE
    // ==========================================
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    const chatDrawer = document.getElementById('chat-drawer');
    const chatOverlay = document.getElementById('chat-overlay');
    const btnCloseChat = document.getElementById('btn-close-chat');

    async function openChatDrawer() {
        if (!chatDrawer) return;
        chatDrawer.classList.add('open');
        if (chatOverlay) chatOverlay.classList.remove('hidden');
        if (btnToggleChat) btnToggleChat.classList.add('open');
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
        if (chatInput) setTimeout(() => chatInput.focus(), 380);

        await chatReady;
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

    // --- Brapi Token Toggle (show/hide) ---
    const brapiToggle = document.getElementById('config-brapi-toggle');
    const brapiTokenInput = document.getElementById('config-brapi-token');
    if (brapiToggle && brapiTokenInput) {
        brapiToggle.addEventListener('click', () => {
            const isPassword = brapiTokenInput.type === 'password';
            brapiTokenInput.type = isPassword ? 'text' : 'password';
            brapiToggle.textContent = isPassword ? '🔒' : '👁️';
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

    // --- Override table state and rendering ---
    let currentAssetOverrides = {};

    function renderAssetOverridesTable() {
        const tbody = document.getElementById('config-override-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const keys = Object.keys(currentAssetOverrides);
        if (keys.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" class="config-override-empty">Nenhum override manual cadastrado.</td>`;
            tbody.appendChild(tr);
            return;
        }

        keys.sort().forEach(ticker => {
            const tr = document.createElement('tr');
            const cat = currentAssetOverrides[ticker];
            tr.innerHTML = `
                <td><strong>${ticker}</strong></td>
                <td><span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: var(--text-primary);">${cat}</span></td>
                <td style="text-align: center;">
                    <button type="button" class="config-override-del-btn" data-ticker="${ticker}" title="Remover override">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.config-override-del-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ticker = e.currentTarget.getAttribute('data-ticker');
                if (ticker && currentAssetOverrides[ticker]) {
                    delete currentAssetOverrides[ticker];
                    renderAssetOverridesTable();
                }
            });
        });
    }

    const btnAddOverride = document.getElementById('btn-add-override');
    const overrideTickerInput = document.getElementById('config-override-ticker');
    const overrideClassSelect = document.getElementById('config-override-class');

    if (btnAddOverride && overrideTickerInput && overrideClassSelect) {
        btnAddOverride.addEventListener('click', () => {
            const ticker = overrideTickerInput.value.trim().toUpperCase();
            const cat = overrideClassSelect.value;
            if (!ticker) {
                alert('Informe o ticker do ativo (ex: VGIA11).');
                overrideTickerInput.focus();
                return;
            }
            currentAssetOverrides[ticker] = cat;
            overrideTickerInput.value = '';
            renderAssetOverridesTable();
        });
    }

    // --- Load config on startup ---
    async function loadConfig() {
        try {
            const cfg = await window.api.getConfig();
            window.appConfig = cfg;
            currentAssetOverrides = { ...(cfg.asset_class_overrides || {}) };
            renderAssetOverridesTable();

            if (!cfg.is_configured) {
                openConfigModal(true);
                return;
            }

            // Pre-fill form fields
            document.getElementById('config-user-name').value = cfg.user_name || '';
            document.getElementById('config-excel-path').value = cfg.excel_folder_path || '';
            configProviderInput.value = cfg.ai_provider || 'gemini';
            if (brapiTokenInput) { brapiTokenInput.value = ''; brapiTokenInput.placeholder = cfg.brapi_token_masked || 'Token da Brapi'; }

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
                configKeyStatus.textContent = '✅ Salva';
                configKeyStatus.className = 'config-key-status success';
            } else {
                configKeyStatus.textContent = 'Não configurada';
                configKeyStatus.className = 'config-key-status unconfigured';
            }
        } catch(e) {
            console.error('Error loading config:', e);
        }
    }

    loadConfig().then(loadLocalExtrato);

    // Open config via gear button
    if (btnOpenConfig) {
        btnOpenConfig.addEventListener('click', () => {
            loadConfig().then(() => {
                openConfigModal(false);
            });
        });
    }

    // Browse Excel Folder
    const btnBrowseExcel = document.getElementById('btn-browse-excel');
    if (btnBrowseExcel) {
        btnBrowseExcel.addEventListener('click', async () => {
            const folderPath = await window.api.selectFolder();
            if (folderPath) {
                document.getElementById('config-excel-path').value = folderPath;
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
            const excelFolderPath = document.getElementById('config-excel-path').value.trim();
            const aiProvider = configProviderInput.value;
            const aiKey = document.getElementById('config-ai-key').value.trim();

            if (isFirstRun && !userName) {
                alert('Por favor, insira seu nome.');
                return;
            }

            btnSaveConfig.innerHTML = '⏳ Salvando...';
            btnSaveConfig.disabled = true;

            try {
                const brapiToken = brapiTokenInput ? brapiTokenInput.value.trim() : '';
                const data = await window.api.saveConfig({
                    user_name: userName,
                    excel_folder_path: excelFolderPath,
                    ai_provider: aiProvider,
                    ai_api_key: aiKey,
                    brapi_token: brapiToken,
                    asset_class_overrides: currentAssetOverrides
                });

                if (data.status === 'success') {
                    window.appConfig = await window.api.getConfig();
                    document.getElementById('config-ai-key').value = '';
                    if (brapiTokenInput) brapiTokenInput.value = '';

                    configModal.classList.add('hidden');
                    showConfigToast('Configurações salvas!');

                    // Reload/re-render dashboards with new overrides or path
                    if (excelFolderPath) await loadLocalExtrato();
                    else if (window.b3Data && window.b3Data.length > 1) await renderDashboards();

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
                configKeyStatus.textContent = '❌ ' + e.message;
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
                            changelogBodyDiv.innerHTML = safeMarkdown(md);
                        } else {
                            // Fallback: renderiza como texto pré-formatado
                            changelogBodyDiv.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(md)}</pre>`;
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
    // PATRIMÔNIO SCREEN
    // ==========================================
    function renderPatrimonioScreen() {
        if (!window.dashboardState) return;
        const { categories, monthlyInvestments, investTransactions } = window.dashboardState;

        const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // ---- KPIs ----
        let totalInvestido = 0;
        let patrimonioAtual = 0;
        const classNames = Object.keys(categories);

        classNames.forEach(cat => {
            totalInvestido += (categories[cat].investedTotal || categories[cat].total);
            patrimonioAtual += categories[cat].total;
        });

        const ganhoMercado = patrimonioAtual - totalInvestido;

        document.getElementById('pat-kpi-investido').textContent = fmtBRL(totalInvestido);
        document.getElementById('pat-kpi-patrimonio').textContent = fmtBRL(patrimonioAtual);

        const ganhoEl = document.getElementById('pat-kpi-ganho');
        ganhoEl.textContent = fmtBRL(ganhoMercado);
        ganhoEl.style.color = ganhoMercado >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';

        // Patrimônio médio — approximation based on cumulative monthly investments
        const sortedMonthKeys = Object.keys(monthlyInvestments).sort();
        let cumulativeInvested = 0;
        const monthlyPatValues = [];
        sortedMonthKeys.forEach(k => {
            cumulativeInvested += monthlyInvestments[k].total;
            monthlyPatValues.push(cumulativeInvested);
        });
        // For the last month, use actual patrimonio (includes market gains)
        if (monthlyPatValues.length > 0) {
            monthlyPatValues[monthlyPatValues.length - 1] = patrimonioAtual;
        }
        const last12 = monthlyPatValues.slice(-12);
        const patMedio = last12.length > 0 ? last12.reduce((a, b) => a + b, 0) / last12.length : 0;
        document.getElementById('pat-kpi-medio').textContent = fmtBRL(patMedio);

        // ---- Evolution Chart ----
        updatePatEvolutionChart();

        // ---- Composition Table ----
        const tbody = document.getElementById('pat-class-tbody');
        tbody.innerHTML = '';
        classNames.forEach(cat => {
            const catData = categories[cat];
            const invested = catData.investedTotal || catData.total;
            const current = catData.total;
            const pct = patrimonioAtual > 0 ? (current / patrimonioAtual * 100) : 0;
            const variation = invested > 0 ? ((current - invested) / invested * 100) : 0;
            const isEmpty = current === 0;
            const color = CLASS_COLORS[cat] || '#6B7280';

            const tr = document.createElement('tr');
            tr.className = 'pat-class-row' + (isEmpty ? ' empty' : '');
            tr.innerHTML = `
                <td><span class="pat-class-color" style="background: ${color};"></span></td>
                <td class="pat-class-name">${cat}</td>
                <td>${fmtBRL(current)}</td>
                <td>${pct.toFixed(1)}%</td>
                <td class="pat-class-var ${variation >= 0 ? 'positive' : 'negative'}">
                    ${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%
                </td>
            `;
            tbody.appendChild(tr);
        });

        // ---- Aportes Chart ----
        updatePatAportesChart();

        // ---- Concentration Alert ----
        const alertEl = document.getElementById('pat-concentration-alert');
        const alertTextEl = document.getElementById('pat-alert-text');
        let alertShown = false;

        if (patrimonioAtual > 0) {
            classNames.forEach(cat => {
                const pct = categories[cat].total / patrimonioAtual * 100;
                if (pct > 80) {
                    alertTextEl.textContent = `${cat} representa ${pct.toFixed(0)}% da carteira. Considere diversificar em outras classes para reduzir o risco.`;
                    alertShown = true;
                }
            });
        }
        alertEl.classList.toggle('hidden', !alertShown);
    }

    function updatePatEvolutionChart() {
        if (!window.dashboardState) return;
        const { monthlyInvestments } = window.dashboardState;

        const periodFilter = document.getElementById('pat-evol-period')?.value || 'all';
        const classFilter = document.getElementById('pat-evol-class')?.value || 'Todos';

        const allKeys = Object.keys(monthlyInvestments).sort();
        let filteredKeys = allKeys;

        if (periodFilter !== 'all') {
            const n = parseInt(periodFilter);
            filteredKeys = allKeys.slice(-n);
        }

        const labels = [];
        const aportadoAcum = [];
        const patrimonioData = [];
        let cumInvested = 0;

        // Calculate cumulative up to the filtered start
        const startIdx = allKeys.indexOf(filteredKeys[0]);
        for (let i = 0; i < startIdx; i++) {
            const k = allKeys[i];
            if (classFilter === 'Todos') {
                cumInvested += monthlyInvestments[k].total;
            } else {
                cumInvested += (monthlyInvestments[k][classFilter] || 0);
            }
        }

        filteredKeys.forEach((k, idx) => {
            const monthData = monthlyInvestments[k];
            labels.push(monthData.label);

            const monthVal = classFilter === 'Todos'
                ? monthData.total
                : (monthData[classFilter] || 0);
            cumInvested += monthVal;
            aportadoAcum.push(cumInvested);

            // For patrimônio we approximate with invested value
            // On the last data point, use actual current market value for that class
            if (idx === filteredKeys.length - 1 && window.dashboardState.categories) {
                const cats = window.dashboardState.categories;
                if (classFilter === 'Todos') {
                    let total = 0;
                    Object.keys(cats).forEach(c => { total += cats[c].total; });
                    patrimonioData.push(total);
                } else {
                    patrimonioData.push(cats[classFilter] ? cats[classFilter].total : cumInvested);
                }
            } else {
                // Historical approximation: invested + proportional market gain
                const cats = window.dashboardState.categories;
                let totalInvested = 0;
                let totalCurrent = 0;
                Object.keys(cats).forEach(c => {
                    totalInvested += (cats[c].investedTotal || cats[c].total);
                    totalCurrent += cats[c].total;
                });
                const ratio = totalInvested > 0 ? totalCurrent / totalInvested : 1;
                patrimonioData.push(cumInvested * ratio);
            }
        });

        const ctx = document.getElementById('patEvolutionChart');
        if (!ctx) return;

        if (charts.patEvolution) {
            charts.patEvolution.destroy();
            charts.patEvolution = null;
        }

        charts.patEvolution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total aportado',
                        data: aportadoAcum,
                        backgroundColor: '#6B7280',
                        barThickness: 20,
                        borderRadius: 3,
                        order: 2
                    },
                    {
                        label: 'Patrimônio total',
                        data: patrimonioData,
                        backgroundColor: '#3B82F6',
                        barThickness: 20,
                        borderRadius: 3,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 0, autoSkipPadding: 12 }
                    },
                    y: {
                        grace: '10%',
                        grid: { borderDash: [4, 4], color: getChartGridColor() },
                        ticks: {
                            callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toLocaleString('pt-BR')
                        }
                    }
                }
            }
        });
    }

    function updatePatAportesChart() {
        if (!window.dashboardState) return;
        const { monthlyInvestments } = window.dashboardState;

        const sortedKeys = Object.keys(monthlyInvestments).sort();
        const labels = [];
        const data = [];
        let totalAno = 0;
        const currentYear = new Date().getFullYear().toString();

        sortedKeys.forEach(k => {
            const monthData = monthlyInvestments[k];
            labels.push(monthData.label);
            const val = Math.abs(monthData.total);
            data.push(val);
            // Sum only current year for totals
            if (k.startsWith(currentYear)) {
                totalAno += val;
            }
        });

        const mediaMensal = data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
        const fmtBRL = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const totalsEl = document.getElementById('pat-aportes-totals');
        if (totalsEl) {
            totalsEl.innerHTML = `
                <span>Total aportado no ano: <strong>${fmtBRL(totalAno)}</strong></span>
                <span>Média mensal: <strong>${fmtBRL(mediaMensal)}</strong></span>
            `;
        }

        const ctx = document.getElementById('patAportesChart');
        if (!ctx) return;

        if (charts.patAportes) {
            charts.patAportes.destroy();
            charts.patAportes = null;
        }

        charts.patAportes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Aporte mensal',
                    data: data,
                    backgroundColor: '#10B981',
                    borderRadius: 4,
                    barThickness: 18
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => fmtBRL(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 0, autoSkipPadding: 12 }
                    },
                    y: {
                        grace: '10%',
                        grid: { borderDash: [4, 4], color: getChartGridColor() },
                        ticks: {
                            callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toLocaleString('pt-BR')
                        }
                    }
                }
            }
        });
    }

    // Patrimônio filter listeners
    if (!window.patFiltersAttached) {
        document.getElementById('pat-evol-period')?.addEventListener('change', updatePatEvolutionChart);
        document.getElementById('pat-evol-class')?.addEventListener('change', updatePatEvolutionChart);
        window.patFiltersAttached = true;
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
    let irStorageReadError = false;
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

    function irSaveStorage() {
        try {
            if (irStorageReadError) throw Error('Os registros anteriores estão inválidos e foram preservados. Restaure um backup antes de alterar.');
            localStorage.setItem(IR_STORAGE_KEY, JSON.stringify(irOperacoes));
            return true;
        } catch(e) {
            irLoadStorage();
            alert('Não foi possível salvar os registros de IR. ' + e.message);
            return false;
        }
    }

    function irLoadStorage() {
        try {
            irStorageReadError = false;
            const raw = localStorage.getItem(IR_STORAGE_KEY);
            irOperacoes = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(irOperacoes) || irOperacoes.some(op=>!op || typeof op.mes !== 'string')) throw Error('Formato inválido.');
        } catch (e) {
            irStorageReadError = true;
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
        const groups = {};
        for (const op of ops) {
            const key = op.mes + ':' + op.classe;
            const g = groups[key] ||= {mes:op.mes,classe:op.classe,vendas:0,custo:0,pago:0};
            g.vendas += Number(op.vendas) || 0; g.custo += Number(op.custo) || 0; g.pago += Number(op.irPago) || 0;
        }
        const money = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
        tbody.innerHTML = Object.values(groups).sort((a,b)=>a.mes.localeCompare(b.mes)).map(g=>
            '<tr><td>'+escapeHtml(g.mes)+'</td><td>'+escapeHtml(IR_CLASS_LABELS[g.classe]||g.classe)+'</td><td>'+money(g.vendas)+'</td><td>'+money(g.custo)+'</td><td>'+money(g.vendas-g.custo)+'</td><td>'+money(g.pago)+'</td><td><button class="ir-action-btn" data-action="irDeleteMonth" data-arg="'+escapeHtml(g.mes)+'">Excluir mês no filtro</button></td></tr>'
        ).join('') || '<tr><td colspan="7">Nenhuma venda registrada para este filtro.</td></tr>';
        const total = field => ops.reduce((n,op)=>n+(Number(op[field])||0),0);
        document.getElementById('ir-kpi-ganho-ano').textContent = money(total('vendas')-total('custo'));
        document.getElementById('ir-kpi-ir-ano').textContent = money(total('irPago'));
        document.getElementById('ir-kpi-darf-mes').textContent = 'Não calculado';
        document.getElementById('ir-kpi-prejuizo').textContent = 'Não calculado';
    }

    window.irDeleteMonth = function(mes) {
        if (!confirm(`Apagar as operações de ${mes} visíveis no filtro atual?`)) return;
        const selected = new Set(irGetFilteredOps().filter(op=>op.mes===mes));
        irOperacoes = irOperacoes.filter(op=>!selected.has(op));
        if (!irSaveStorage()) return;
        irRenderTable();
    };

    function irUpdateModalPreview() {
        const classe = document.getElementById('ir-form-class')?.value || 'acoes';
        const vendas = parseFloat(document.getElementById('ir-form-vendas')?.value) || 0;
        const custo = parseFloat(document.getElementById('ir-form-custo')?.value) || 0;
        const tempo = document.getElementById('ir-form-tempo')?.value || 'longo_2';
        const pago = parseFloat(document.getElementById('ir-form-pago')?.value) || 0;
        const op = { classe, vendas, custo, tempo, irPago: pago };
        const c = {ganho:vendas-custo};
        const fmt = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        const elG = document.getElementById('irp-ganho');
        const elI = document.getElementById('irp-isencao');
        const elB = document.getElementById('irp-base');
        const elD = document.getElementById('irp-devido');
        if (elG) elG.textContent = fmt(c.ganho);
        if (elI) elI.textContent = 'Não calculada';
        if (elB) elB.textContent = 'Não calculada';
        if (elD) elD.textContent = 'Não calculado';

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

                if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || ![vendas,custo,pago].every(Number.isFinite) || vendas <= 0 || custo < 0 || pago < 0) {
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
                if (!irSaveStorage()) return;

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

    function openRaioXModal(ticker, specialType = null) {
        if (!window.dashboardState) return;
        const { categories, yieldTransactions, investTransactions } = window.dashboardState;

        // Find asset across categories
        let assetData = null, assetClass = '', className = '';
        let isSpecial = !!specialType;

        if (isSpecial) {
            for (const [catName, cat] of Object.entries(categories)) {
                if (cat.specialAtivos && cat.specialAtivos[ticker]) {
                    assetData = cat.specialAtivos[ticker];
                    className = catName;
                    break;
                }
            }
        } else {
            for (const [catName, cat] of Object.entries(categories)) {
                if (cat.ativos[ticker]) {
                    assetData = cat.ativos[ticker];
                    className = catName;
                    break;
                }
            }
        }
        if (!assetData) return;

        // Determine asset class label and type
        const classLabels = { 'FIIs': 'FII', 'Ações': 'Ação', 'ETFs': 'ETF', 'Tesouro Direto': 'TD' };
        assetClass = classLabels[className] || className;

        let typeLabel = isSpecial ? assetData.typeLabel : className;
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
        const allYieldTxs = window.dashboardState.allYields || yieldTransactions || [];
        // We need ALL yield transactions, but yieldTransactions in dashboardState may be year-filtered.
        // Re-parse from b3Data if needed, or use what we have
        const tickerYields = allYieldTxs.filter(t => t.ticker === ticker);
        const totalProventos = tickerYields.reduce((acc, t) => acc + t.valTotal, 0);

        // Rentabilidade from rentabState
        let totalReturn = NaN;
        let monthlyReturns = {};
        if (window.rentabState && window.rentabState.individual && window.rentabState.individual[ticker]) {
            totalReturn = window.rentabState.individual[ticker].totalReturn ?? NaN;
            monthlyReturns = window.rentabState.individual[ticker].monthly || {};
        }

        document.getElementById('raiox-type-badge').textContent = typeLabel;

        // Toggle UI visibilities for Special vs Normal assets
        const kpisGrid = document.querySelector('.raiox-kpis-grid');
        const sections = document.querySelectorAll('.raiox-section');
        const hrSep = document.getElementById('raiox-sections-hr');
        const magicCard = document.getElementById('raiox-magic-card');
        
        let msgEl = document.getElementById('raiox-special-msg');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'raiox-special-msg';
            msgEl.className = 'raiox-special-msg';
            document.querySelector('.raiox-body').appendChild(msgEl);
        }

        // Populate header (FOR BOTH NORMAL AND SPECIAL)
        document.getElementById('raiox-title').textContent = `${ticker} — Raio-X`;
        document.getElementById('raiox-class-badge').textContent = assetClass;
        document.getElementById('raiox-ticker-name').textContent = ticker;
        document.getElementById('raiox-full-name').textContent = className;
        document.getElementById('raiox-type-badge').textContent = typeLabel;

        if (isSpecial) {
            if (kpisGrid) kpisGrid.style.display = 'none';
            sections.forEach(s => s.style.display = 'none');
            if (hrSep) hrSep.style.display = 'none';
            if (magicCard) magicCard.classList.add('hidden');
            
            msgEl.style.display = 'block';
            msgEl.textContent = `Este é um(a) ${assetData.typeLabel.toLowerCase()}. As métricas de rentabilidade e gráficos não se aplicam a este tipo de ativo.`;
            document.getElementById('raiox-modal').classList.remove('hidden');
            return; // Termina execução aqui
        } else {
            if (kpisGrid) kpisGrid.style.display = 'grid';
            sections.forEach(s => s.style.display = 'block');
            msgEl.style.display = 'none';
        }

        // --- NORMAL ASSET FLOW ---
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
        rentabEl.textContent = formatReturn(totalReturn);
        rentabEl.className = 'raiox-kpi-value ' + (totalReturn >= 0 ? 'positive' : 'negative');

        document.getElementById('raiox-kpi-posicao').textContent = currentVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('raiox-kpi-quant').textContent = quant.toLocaleString('pt-BR');
        document.getElementById('raiox-kpi-pm').textContent = avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const varEl = document.getElementById('raiox-kpi-var');
        varEl.textContent = (varPct > 0 ? '+' : '') + formatReturn(varPct);
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
                        tr += `<td class="${cls}">${formatReturn(val)}</td>`;
                    } else {
                        tr += `<td class="rentab-zero">-</td>`;
                    }
                }
                const yRet = cumByYear[year].yearRet;
                const cRet = cumByYear[year].cumRet;
                tr += `<td class="rentab-acum-cell">${formatReturn(yRet)}</td>`;
                tr += `<td class="rentab-acum-cell">${formatReturn(cRet)}</td>`;
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

    // ==========================================
    // AUTO-UPDATE LOGIC
    // ==========================================
    const updateBanner = document.getElementById('update-banner');
    const updateTitle = document.getElementById('update-title');
    const updateIcon = document.getElementById('update-icon');
    const updateProgressFill = document.getElementById('update-progress-fill');
    const updateProgressTrack = document.getElementById('update-progress-track');
    const btnUpdateDismiss = document.getElementById('btn-update-dismiss');
    const btnUpdateRestart = document.getElementById('btn-update-restart');

    if (updateBanner && window.api) {
        // Novo: Lógica do botão de verificação manual
        const btnCheckUpdates = document.getElementById('btn-check-updates');
        if (btnCheckUpdates) {
            btnCheckUpdates.addEventListener('click', async () => {
                btnCheckUpdates.innerHTML = '⏳ Verificando...';
                btnCheckUpdates.disabled = true;
                
                const res = await window.api.checkForUpdates();
                if (res && res.error) {
                    btnCheckUpdates.innerHTML = `❌ ${res.error}`;
                    setTimeout(() => {
                        btnCheckUpdates.innerHTML = '🔄 Checar Agora';
                        btnCheckUpdates.disabled = false;
                    }, 4000);
                }
            });

            if (window.api.onUpdateNotAvailable) {
                window.api.onUpdateNotAvailable(() => {
                    btnCheckUpdates.innerHTML = '✅ Versão mais recente instalada';
                    setTimeout(() => {
                        btnCheckUpdates.innerHTML = '🔄 Checar Agora';
                        btnCheckUpdates.disabled = false;
                    }, 4000);
                });
            }
        }

        btnUpdateDismiss.addEventListener('click', () => {
            updateBanner.classList.remove('visible');
        });

        btnUpdateRestart.addEventListener('click', () => {
            if (window.api.quitAndInstallUpdate) {
                window.api.quitAndInstallUpdate();
            }
        });

        if (window.api.onUpdateAvailable) {
            window.api.onUpdateAvailable(() => {
                if (btnCheckUpdates) {
                    btnCheckUpdates.innerHTML = '⬇️ Baixando atualização...';
                }
                updateBanner.classList.add('visible');
                updateBanner.classList.remove('ready');
                updateTitle.textContent = 'Nova versão disponível! Baixando atualização...';
                updateIcon.innerHTML = '<i class="ti ti-download">⬇️</i>';
                updateProgressTrack.classList.remove('hidden');
                updateProgressFill.style.width = '0%';
                btnUpdateRestart.classList.add('hidden');
                btnUpdateDismiss.textContent = 'Dispensar';
            });
        }

        if (window.api.onDownloadProgress) {
            window.api.onDownloadProgress((percent) => {
                updateProgressFill.style.width = `${percent}%`;
            });
        }

        if (window.api.onUpdateDownloaded) {
            window.api.onUpdateDownloaded(() => {
                updateBanner.classList.add('ready');
                updateTitle.textContent = 'Atualização pronta! Reinicie o app para aplicar.';
                updateIcon.innerHTML = '<i class="ti ti-rocket">🚀</i>';
                updateProgressTrack.classList.add('hidden');
                btnUpdateRestart.classList.remove('hidden');
                btnUpdateDismiss.textContent = 'Depois';
            });
        }
        
        if (window.api.onUpdaterError) {
            window.api.onUpdaterError((errorMsg) => {
                console.error('Updater Error:', errorMsg);
                updateBanner.classList.remove('visible');
            });
        }
    }

    // ==== METODOS AUXILIARES: FOCO NA CONSTRUÇÃO ====
    function getMagicNumberInfo(ticker, currentPrice, quant) {
        let magicNumber = 0;
        let avgMonthYield = 0;
        if (window.dashboardState && window.dashboardState.yieldTransactions) {
            const yieldsForAsset = window.dashboardState.yieldTransactions.filter(t => t.ticker === ticker && t.quant > 0);
            if (yieldsForAsset.length > 0) {
                let monthlyMap = {};
                yieldsForAsset.forEach(t => {
                    if (!monthlyMap[t.monthKey]) monthlyMap[t.monthKey] = [];
                    monthlyMap[t.monthKey].push(t.valTotal / t.quant);
                });
                let months = Object.keys(monthlyMap).sort().slice(-12);
                if (months.length > 0) {
                    let sumAvg = 0;
                    months.forEach(m => {
                        sumAvg += monthlyMap[m].reduce((a, b) => a + b, 0) / monthlyMap[m].length;
                    });
                    avgMonthYield = sumAvg / months.length;
                    if (avgMonthYield > 0 && currentPrice > 0) {
                        magicNumber = Math.ceil(currentPrice / avgMonthYield);
                    }
                }
            }
        }
        return { magicNumber, avgMonthYield };
    }

    function renderConstructionView() {
        if (!window.dashboardState) return;
        const { categories } = window.dashboardState;

        let constructionAssets = [];

        Object.keys(categories).forEach(catName => {
            const cat = categories[catName];
            Object.keys(cat.ativos).forEach(ticker => {
                const ativo = cat.ativos[ticker];
                if (ativo.quant <= 0) return;

                const avgPrice = ativo.quant > 0 ? ((ativo.investedVal !== undefined ? ativo.investedVal : ativo.totalVal) / ativo.quant) : 0;
                const currentPrice = ativo.currentPrice || avgPrice;
                const pctDiff = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;

                const { magicNumber, avgMonthYield } = getMagicNumberInfo(ticker, currentPrice, ativo.quant);

                if (magicNumber > 0) {
                    const progressPct = Math.min((ativo.quant / magicNumber) * 100, 100);
                    const isCompleted = progressPct >= 100;
                    const cotasFaltam = Math.max(magicNumber - ativo.quant, 0);
                    const costToComplete = cotasFaltam * currentPrice;

                    let badgeText = 'CONSTRUINDO';
                    let badgeClass = 'badge-construindo';
                    let fillClass = 'fill-construindo';

                    if (isCompleted) {
                        badgeText = 'COMPLETO';
                        badgeClass = 'badge-completo';
                        fillClass = 'fill-completo';
                    } else if (progressPct >= 70) {
                        badgeText = 'QUASE LÁ';
                        badgeClass = 'badge-quase-la';
                        fillClass = 'fill-quase-la';
                    }

                    constructionAssets.push({
                        ticker,
                        quant: ativo.quant,
                        magicNumber,
                        avgMonthYield,
                        currentPrice,
                        progressPct,
                        isCompleted,
                        cotasFaltam,
                        costToComplete,
                        pctDiff,
                        badgeText,
                        badgeClass,
                        fillClass,
                        totalVal: ativo.totalVal
                    });
                }
            });
        });

        window.constructionAssets = constructionAssets;

        const prioridadeList = constructionAssets.filter(a => !a.isCompleted);
        const completosList = constructionAssets.filter(a => a.isCompleted);

        const badgePrioridade = document.getElementById('badge-prioridade');
        const badgeCompletos = document.getElementById('badge-completos');
        const badgeTodos = document.getElementById('badge-todos');

        if (badgePrioridade) badgePrioridade.textContent = prioridadeList.length;
        if (badgeCompletos) badgeCompletos.textContent = completosList.length;
        if (badgeTodos) badgeTodos.textContent = constructionAssets.length;

        renderSuggestedAction(prioridadeList);
        renderConstructionList();
    }

    function renderSuggestedAction(prioridadeList) {
        const wrapper = document.getElementById('suggested-action-card-wrapper');
        if (!wrapper) return;

        if (prioridadeList.length === 0) {
            wrapper.innerHTML = `
                <div class="suggested-action-card" style="border-left-color: var(--positive-color);">
                    <div style="flex: 1; padding-right: 16px;">
                        <span class="suggested-label" style="color: var(--positive-color);"><span class="suggested-dot">●</span> Carteira Balanceada</span>
                        <h4 class="suggested-text">Todos os seus fundos/ativos com Número Mágico atingiram <strong>100% de conclusão</strong>! Parabéns! 🎉</h4>
                    </div>
                    <div class="suggested-percentage-col">
                        <span class="suggested-percentage-val" style="color: var(--positive-color);">100%</span>
                        <span class="suggested-percentage-lbl">Concluído</span>
                    </div>
                </div>
            `;
            return;
        }

        const sortedPriorities = [...prioridadeList].sort((a, b) => b.progressPct - a.progressPct);
        const nextTarget = sortedPriorities[0];

        const costFormatted = nextTarget.costToComplete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const pctFormatted = nextTarget.progressPct.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        wrapper.innerHTML = `
            <div class="suggested-action-card">
                <div style="flex: 1; padding-right: 16px;">
                    <span class="suggested-label"><span class="suggested-dot">●</span> Próxima Ação Sugerida</span>
                    <h4 class="suggested-text">
                        Faltam <strong>${nextTarget.cotasFaltam} cotas</strong> para <strong>${nextTarget.ticker}</strong> atingir o número mágico. No preço atual, isso representa um aporte de aproximadamente <strong>${costFormatted}</strong>.
                    </h4>
                </div>
                <div class="suggested-percentage-col">
                    <span class="suggested-percentage-val" style="color: var(--warning-color);">${pctFormatted}%</span>
                    <span class="suggested-percentage-lbl">Concluído</span>
                </div>
            </div>
        `;
    }

    function renderConstructionList() {
        const container = document.getElementById('construction-list');
        if (!container) return;

        const assets = window.constructionAssets || [];
        if (assets.length === 0) {
            container.innerHTML = `
                <div class="construction-empty-state">
                    <div class="construction-empty-icon">🎯</div>
                    <p>Nenhum ativo com Número Mágico calculado na sua carteira.</p>
                    <p style="font-size: 0.85rem; color: var(--text-tertiary); margin-top: 8px;">
                        O Número Mágico é calculado automaticamente para ativos que possuem quantidade em carteira e que pagaram dividendos/proventos nos últimos 12 meses.
                    </p>
                </div>
            `;
            return;
        }

        let filtered = [];
        const tab = window.currentConstructionTab || 'prioridade';

        if (tab === 'prioridade') {
            filtered = assets.filter(a => !a.isCompleted).sort((a, b) => b.progressPct - a.progressPct);
        } else if (tab === 'completos') {
            filtered = assets.filter(a => a.isCompleted).sort((a, b) => b.totalVal - a.totalVal);
        } else {
            const inProgress = assets.filter(a => !a.isCompleted).sort((a, b) => b.progressPct - a.progressPct);
            const completed = assets.filter(a => a.isCompleted).sort((a, b) => b.progressPct - a.progressPct);
            filtered = [...inProgress, ...completed];
        }

        if (filtered.length === 0) {
            let msg = "Nenhum ativo nesta aba.";
            if (tab === 'prioridade') msg = "Nenhum ativo em andamento.";
            else if (tab === 'completos') msg = "Nenhum ativo completo ainda.";

            container.innerHTML = `
                <div class="construction-empty-state" style="padding: 32px;">
                    <p>${msg}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        filtered.forEach(asset => {
            const card = document.createElement('div');
            card.className = `construction-card ${asset.isCompleted ? 'completed' : ''}`;
            
            const isPos = asset.pctDiff >= 0;
            const trendClass = isPos ? 'positive' : 'negative';
            const trendSign = isPos ? '▲' : '▼';

            const activeBars = Math.ceil(asset.progressPct / 25);

            card.innerHTML = `
                <div class="construction-card-left">
                    <span class="construction-ticker" data-action="openRaioXModal" data-arg="${escapeHtml(asset.ticker)}">${escapeHtml(asset.ticker)}</span>
                    <span class="construction-quotas">${asset.quant} / ${asset.magicNumber} cotas</span>
                </div>
                
                <div class="construction-card-middle">
                    <div class="construction-progress-header">
                        <span>Rumo ao número mágico</span>
                        <span>${asset.progressPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>
                    </div>
                    <div class="construction-progress-bar-track">
                        <div class="construction-progress-bar-fill ${asset.fillClass}" style="width: ${asset.progressPct}%"></div>
                    </div>
                    <div class="construction-badge ${asset.badgeClass}">${asset.badgeText}</div>
                </div>
                
                <div class="construction-card-right">
                    <div class="construction-price">${asset.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    <div class="construction-trend ${trendClass}" style="margin-top: 2px;">${trendSign} ${Math.abs(asset.pctDiff).toFixed(1)}%</div>
                    <div class="construction-bars">
                        <div class="bar bar-1 ${activeBars >= 1 ? 'active' : ''}"></div>
                        <div class="bar bar-2 ${activeBars >= 2 ? 'active' : ''}"></div>
                        <div class="bar bar-3 ${activeBars >= 3 ? 'active' : ''}"></div>
                        <div class="bar bar-4 ${activeBars >= 4 ? 'active' : ''}"></div>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });

        // Antigravity GSAP entry animation for the cards
        if (typeof gsap !== 'undefined') {
            const cards = container.querySelectorAll('.construction-card');
            gsap.fromTo(cards, 
                { y: 15, opacity: 0 }, 
                { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out" }
            );
        }
    }

    // =========================================================================
    // MÓDULO MULTI-ATIVOS: ALIMENTAÇÃO REAL DAS NOVAS CLASSES (AÇÕES, ETFS, RENDA FIXA, CRIPTO)
    // =========================================================================

    const MULTI_ASSETS_KEY = 'vsa_multi_assets';

    let multiAssetsReadError = false;
    function loadMultiAssets() {
        try {
            multiAssetsReadError = false;
            const raw = localStorage.getItem(MULTI_ASSETS_KEY);
            if (!raw) return { rendaFixa: [], cripto: [], manualAssets: [] };
            const data = JSON.parse(raw);
            if (!data || Array.isArray(data) || ["rendaFixa","cripto","manualAssets"].some(k => data[k] !== undefined && !Array.isArray(data[k]))) throw Error("Formato inválido de cadastros.");
            return {
                rendaFixa: Array.isArray(data.rendaFixa) ? data.rendaFixa : [],
                cripto: Array.isArray(data.cripto) ? data.cripto : [],
                manualAssets: Array.isArray(data.manualAssets) ? data.manualAssets : []
            };
        } catch (e) {
            multiAssetsReadError = true;
            console.error('Erro ao ler multi_assets:', e);
            return { rendaFixa: [], cripto: [], manualAssets: [] };
        }
    }

    function saveMultiAssets(data) {
        try {
            if (multiAssetsReadError) throw Error("Os cadastros salvos estão inválidos. O conteúdo original foi preservado; restaure um backup antes de alterar.");
            localStorage.setItem(MULTI_ASSETS_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Erro ao salvar multi_assets:', e);
            alert('Não foi possível salvar os cadastros. ' + e.message);
            return false;
        }
    }

    // Helper: Atualização de cotações em tempo real sob demanda
    async function fetchMultiAssetQuote(ticker) {
        if (!ticker || !window.api || !window.api.getQuotes) return;
        try {
            const q = await window.api.getQuotes([ticker], true);
            window.cachedQuotes = Object.assign(window.cachedQuotes || {}, q);
        } catch (e) {
            console.warn(`Não foi possível buscar cotação para ${ticker}:`, e);
        }
    }

    // -------------------------------------------------------------------------
    // 1. RENDERIZADOR: TELA DE AÇÕES
    // -------------------------------------------------------------------------
    function renderAcoesScreen() {
        const state = window.dashboardState || {};
        const b3Ativos = (state.categories && state.categories['Ações'] && state.categories['Ações'].ativos) || {};
        const multi = loadMultiAssets();
        const manual = (multi.manualAssets || []).filter(a => a.classe === 'Ações');

        const map = {};

        // Adiciona ações da B3
        Object.keys(b3Ativos).forEach(t => {
            const at = b3Ativos[t];
            if (at.quant > 0 || at.totalVal > 0 || at.investedVal > 0) {
                const q = at.quant || 0;
                const inv = at.investedVal || 0;
                const quote = (window.cachedQuotes && window.cachedQuotes[t]) || at.currentPrice || (q > 0 ? inv / q : 0);
                map[t] = {
                    ticker: t,
                    nome: t,
                    quant: q,
                    invested: inv,
                    currentPrice: quote,
                    source: 'B3',
                    isManual: false
                };
            }
        });

        // Adiciona/Mescla ações manuais
        manual.forEach(m => {
            const t = (m.ticker || '').toUpperCase().trim();
            if (!t) return;
            const q = parseFloat(m.quant) || 0;
            const pm = parseFloat(m.pm) || 0;
            const inv = q * pm;
            const quote = (window.cachedQuotes && window.cachedQuotes[t]) || pm;

            if (map[t]) {
                map[t].quant += q;
                map[t].invested += inv;
                map[t].source = 'B3 + Manual';
                map[t].manualId = m.id;
                if (!map[t].currentPrice || map[t].currentPrice === 0) map[t].currentPrice = quote;
            } else {
                map[t] = {
                    ticker: t,
                    nome: m.nome || t,
                    quant: q,
                    invested: inv,
                    currentPrice: quote,
                    source: 'Manual',
                    isManual: true,
                    manualId: m.id
                };
            }
        });

        const items = Object.values(map);
        let totalPatrimonio = 0;
        let totalInvestido = 0;

        items.forEach(it => {
            it.pm = it.quant > 0 ? it.invested / it.quant : 0;
            it.posicao = it.quant * it.currentPrice;
            it.lucro = it.posicao - it.invested;
            it.varPct = it.invested > 0 ? (it.lucro / it.invested) * 100 : 0;
            totalPatrimonio += it.posicao;
            totalInvestido += it.invested;
        });

        const totalLucro = totalPatrimonio - totalInvestido;
        const totalVarPct = totalInvestido > 0 ? (totalLucro / totalInvestido) * 100 : 0;

        // Proventos da B3 em Ações
        let totalProventos = 0;
        if (state.yieldTransactions && Array.isArray(state.yieldTransactions)) {
            totalProventos = state.yieldTransactions
                .filter(y => y.assetClass === 'Ações')
                .reduce((acc, y) => acc + (y.valTotal || 0), 0);
        }

        // Atualiza KPIs
        const elPat = document.getElementById('val-acoes-patrimonio');
        if (elPat) elPat.textContent = totalPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elInv = document.getElementById('val-acoes-investido');
        if (elInv) elInv.textContent = totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elLucro = document.getElementById('val-acoes-lucro');
        if (elLucro) {
            elLucro.textContent = totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            elLucro.className = `kpi-value ${totalLucro >= 0 ? 'positive' : 'negative'}`;
        }

        const elVar = document.getElementById('val-acoes-var-pct');
        if (elVar) {
            elVar.textContent = `${totalVarPct >= 0 ? '+' : ''}${totalVarPct.toFixed(2)}%`;
            elVar.style.color = totalVarPct >= 0 ? '#10B981' : '#EF4444';
        }

        const elProv = document.getElementById('val-acoes-proventos');
        if (elProv) elProv.textContent = totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elQtd = document.getElementById('val-acoes-qtd');
        if (elQtd) elQtd.textContent = items.length;

        const elBadge = document.getElementById('badge-acoes-count');
        if (elBadge) elBadge.textContent = `${items.length} empresa${items.length === 1 ? '' : 's'}`;

        // Empty state vs Tabela
        const tableCard = document.getElementById('acoes-table-card');
        const emptyCard = document.getElementById('empty-acoes-card');
        const tbody = document.getElementById('acoes-table-tbody');

        if (items.length === 0) {
            if (tableCard) tableCard.classList.add('hidden');
            if (emptyCard) emptyCard.classList.remove('hidden');
            if (tbody) tbody.innerHTML = '';
            return;
        }

        if (tableCard) tableCard.classList.remove('hidden');
        if (emptyCard) emptyCard.classList.add('hidden');

        // Ordena por posição decrescente
        items.sort((a, b) => b.posicao - a.posicao);

        const tot = totalPatrimonio > 0 ? totalPatrimonio : 1;
        let html = '';
        items.forEach(it => {
            const peso = (it.posicao / tot) * 100;
            const isPos = it.lucro >= 0;
            const badgeSource = it.isManual 
                ? `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(99, 102, 241, 0.15); color: #818CF8; font-weight: 600;">Manual</span>`
                : (it.source === 'B3 + Manual'
                    ? `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34D399; font-weight: 600;">B3 + Manual</span>`
                    : `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-weight: 600;">B3</span>`);

            const actionBtn = (it.isManual || it.manualId)
                ? `<div style="display:flex; justify-content:center; gap:6px;">
                     <button class="action-icon-btn edit" data-action="editManualAsset" data-arg="${escapeHtml(it.manualId)}" data-second="Ações" title="Editar Lançamento">✏️</button>
                     <button class="action-icon-btn delete" data-action="deleteManualAsset" data-arg="${escapeHtml(it.manualId)}" data-second="Ações" title="Excluir Lançamento">🗑️</button>
                   </div>`
                : `<span style="color: var(--text-tertiary); font-size: 0.75rem;">Importado B3</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(it.ticker)}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap: 8px;">
                            <span>${escapeHtml(it.nome)}</span>
                            ${badgeSource}
                        </div>
                    </td>
                    <td>${it.quant.toLocaleString('pt-BR')}</td>
                    <td>${it.pm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 600;">${it.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 700; color: var(--text-primary);">${it.posicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${it.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${it.varPct.toFixed(2)}%</td>
                    <td style="color: var(--text-secondary);">${peso.toFixed(1)}%</td>
                    <td style="text-align: center;">${actionBtn}</td>
                </tr>
            `;
        });
        if (tbody) tbody.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // 2. RENDERIZADOR: TELA DE ETFS
    // -------------------------------------------------------------------------
    function renderEtfsScreen() {
        const state = window.dashboardState || {};
        const b3Ativos = (state.categories && state.categories['ETFs'] && state.categories['ETFs'].ativos) || {};
        const multi = loadMultiAssets();
        const manual = (multi.manualAssets || []).filter(a => a.classe === 'ETFs');

        const map = {};

        // Adiciona ETFs da B3
        Object.keys(b3Ativos).forEach(t => {
            const at = b3Ativos[t];
            if (at.quant > 0 || at.totalVal > 0 || at.investedVal > 0) {
                const q = at.quant || 0;
                const inv = at.investedVal || 0;
                const quote = (window.cachedQuotes && window.cachedQuotes[t]) || at.currentPrice || (q > 0 ? inv / q : 0);
                map[t] = {
                    ticker: t,
                    nome: t,
                    quant: q,
                    invested: inv,
                    currentPrice: quote,
                    source: 'B3',
                    isManual: false
                };
            }
        });

        // Adiciona/Mescla ETFs manuais
        manual.forEach(m => {
            const t = (m.ticker || '').toUpperCase().trim();
            if (!t) return;
            const q = parseFloat(m.quant) || 0;
            const pm = parseFloat(m.pm) || 0;
            const inv = q * pm;
            const quote = (window.cachedQuotes && window.cachedQuotes[t]) || pm;

            if (map[t]) {
                map[t].quant += q;
                map[t].invested += inv;
                map[t].source = 'B3 + Manual';
                map[t].manualId = m.id;
                if (!map[t].currentPrice || map[t].currentPrice === 0) map[t].currentPrice = quote;
            } else {
                map[t] = {
                    ticker: t,
                    nome: m.nome || t,
                    quant: q,
                    invested: inv,
                    currentPrice: quote,
                    source: 'Manual',
                    isManual: true,
                    manualId: m.id
                };
            }
        });

        const items = Object.values(map);
        let totalPatrimonio = 0;
        let totalInvestido = 0;
        let globalPatrimonio = 0;

        const globalTickers = ['IVVB11', 'SPXI11', 'XINA11', 'ACWI11', 'NASD11', 'WRLD11', 'EURP11', 'HASH11', 'QBTC11', 'QETH11'];

        items.forEach(it => {
            it.pm = it.quant > 0 ? it.invested / it.quant : 0;
            it.posicao = it.quant * it.currentPrice;
            it.lucro = it.posicao - it.invested;
            it.varPct = it.invested > 0 ? (it.lucro / it.invested) * 100 : 0;
            totalPatrimonio += it.posicao;
            totalInvestido += it.invested;

            if (globalTickers.some(gt => it.ticker.startsWith(gt))) {
                globalPatrimonio += it.posicao;
            }
        });

        const totalLucro = totalPatrimonio - totalInvestido;
        const totalVarPct = totalInvestido > 0 ? (totalLucro / totalInvestido) * 100 : 0;
        const globalPct = totalPatrimonio > 0 ? (globalPatrimonio / totalPatrimonio) * 100 : 0;

        // Atualiza KPIs
        const elPat = document.getElementById('val-etfs-patrimonio');
        if (elPat) elPat.textContent = totalPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elInv = document.getElementById('val-etfs-investido');
        if (elInv) elInv.textContent = totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elLucro = document.getElementById('val-etfs-lucro');
        if (elLucro) {
            elLucro.textContent = totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            elLucro.className = `kpi-value ${totalLucro >= 0 ? 'positive' : 'negative'}`;
        }

        const elVar = document.getElementById('val-etfs-var-pct');
        if (elVar) {
            elVar.textContent = `${totalVarPct >= 0 ? '+' : ''}${totalVarPct.toFixed(2)}%`;
            elVar.style.color = totalVarPct >= 0 ? '#10B981' : '#EF4444';
        }

        const elGlobal = document.getElementById('val-etfs-global');
        if (elGlobal) elGlobal.textContent = `${globalPct.toFixed(1)}%`;

        const elQtd = document.getElementById('val-etfs-qtd');
        if (elQtd) elQtd.textContent = items.length;

        const elBadge = document.getElementById('badge-etfs-count');
        if (elBadge) elBadge.textContent = `${items.length} fundo${items.length === 1 ? '' : 's'}`;

        const tableCard = document.getElementById('etfs-table-card');
        const emptyCard = document.getElementById('empty-etfs-card');
        const tbody = document.getElementById('etfs-table-tbody');

        if (items.length === 0) {
            if (tableCard) tableCard.classList.add('hidden');
            if (emptyCard) emptyCard.classList.remove('hidden');
            if (tbody) tbody.innerHTML = '';
            return;
        }

        if (tableCard) tableCard.classList.remove('hidden');
        if (emptyCard) emptyCard.classList.add('hidden');

        items.sort((a, b) => b.posicao - a.posicao);

        const tot = totalPatrimonio > 0 ? totalPatrimonio : 1;
        let html = '';
        items.forEach(it => {
            const peso = (it.posicao / tot) * 100;
            const isPos = it.lucro >= 0;
            const badgeSource = it.isManual 
                ? `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(6, 182, 212, 0.15); color: #38BDF8; font-weight: 600;">Manual</span>`
                : (it.source === 'B3 + Manual'
                    ? `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); color: #34D399; font-weight: 600;">B3 + Manual</span>`
                    : `<span style="font-size:0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-weight: 600;">B3</span>`);

            const actionBtn = (it.isManual || it.manualId)
                ? `<div style="display:flex; justify-content:center; gap:6px;">
                     <button class="action-icon-btn edit" data-action="editManualAsset" data-arg="${escapeHtml(it.manualId)}" data-second="ETFs" title="Editar Lançamento">✏️</button>
                     <button class="action-icon-btn delete" data-action="deleteManualAsset" data-arg="${escapeHtml(it.manualId)}" data-second="ETFs" title="Excluir Lançamento">🗑️</button>
                   </div>`
                : `<span style="color: var(--text-tertiary); font-size: 0.75rem;">Importado B3</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(it.ticker)}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap: 8px;">
                            <span>${escapeHtml(it.nome)}</span>
                            ${badgeSource}
                        </div>
                    </td>
                    <td>${it.quant.toLocaleString('pt-BR')}</td>
                    <td>${it.pm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 600;">${it.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 700; color: var(--text-primary);">${it.posicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${it.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${it.varPct.toFixed(2)}%</td>
                    <td style="color: var(--text-secondary);">${peso.toFixed(1)}%</td>
                    <td style="text-align: center;">${actionBtn}</td>
                </tr>
            `;
        });
        if (tbody) tbody.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // 3. RENDERIZADOR: TELA DE RENDA FIXA
    // -------------------------------------------------------------------------
    function renderRendaFixaScreen() {
        const state = window.dashboardState || {};
        const b3Rf = (state.categories && state.categories['Tesouro Direto'] && state.categories['Tesouro Direto'].ativos) || {};
        const multi = loadMultiAssets();
        const manual = multi.rendaFixa || [];

        let items = [];

        // Itens de Renda Fixa da B3 (ex: Tesouro Direto)
        Object.keys(b3Rf).forEach(t => {
            const at = b3Rf[t];
            if (at.quant > 0 || at.totalVal > 0 || at.investedVal > 0) {
                const inv = at.investedVal || at.totalVal || 0;
                const pos = at.totalVal || inv;
                items.push({
                    id: `b3_${t}`,
                    nome: t,
                    tipo: 'Tesouro Direto',
                    taxa: 'Tesouro Direto B3',
                    dataAplicacao: '-',
                    vencimento: '-',
                    valorInvestido: inv,
                    valorAtual: pos,
                    rendimento: pos - inv,
                    rendPct: inv > 0 ? ((pos - inv) / inv) * 100 : 0,
                    isManual: false
                });
            }
        });

        // Itens manuais
        manual.forEach(r => {
            const inv = parseFloat(r.valorInvestido) || 0;
            const cur = r.valorAtual !== undefined ? parseFloat(r.valorAtual) : inv;
            const rend = cur - inv;
            const rendPct = inv > 0 ? (rend / inv) * 100 : 0;
            items.push({
                id: r.id,
                nome: r.nome || 'Título de Renda Fixa',
                tipo: r.tipo || 'CDB',
                taxa: r.taxa || '100% CDI',
                dataAplicacao: r.dataAplicacao || '-',
                vencimento: r.vencimento || '-',
                valorInvestido: inv,
                valorAtual: cur,
                rendimento: rend,
                rendPct: rendPct,
                isManual: true
            });
        });

        let totalPatrimonio = 0;
        let totalInvestido = 0;
        items.forEach(it => {
            totalPatrimonio += it.valorAtual;
            totalInvestido += it.valorInvestido;
        });

        const totalRendimento = totalPatrimonio - totalInvestido;

        // Atualiza KPIs
        const elPat = document.getElementById('val-rf-patrimonio');
        if (elPat) elPat.textContent = totalPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elInv = document.getElementById('val-rf-investido');
        if (elInv) elInv.textContent = totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elLucro = document.getElementById('val-rf-lucro');
        if (elLucro) {
            elLucro.textContent = totalRendimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            elLucro.className = `kpi-value ${totalRendimento >= 0 ? 'positive' : 'negative'}`;
        }

        const elTaxa = document.getElementById('val-rf-taxa');
        if (elTaxa) {
            elTaxa.textContent = items.length > 0 ? (items[0].taxa || '100% CDI') : '100% CDI';
        }

        const elQtd = document.getElementById('val-rf-qtd');
        if (elQtd) elQtd.textContent = items.length;

        const elBadge = document.getElementById('badge-rf-count');
        if (elBadge) elBadge.textContent = `${items.length} título${items.length === 1 ? '' : 's'}`;

        const tableCard = document.getElementById('rf-table-card');
        const emptyCard = document.getElementById('empty-rf-card');
        const tbody = document.getElementById('rf-table-tbody');

        if (items.length === 0) {
            if (tableCard) tableCard.classList.add('hidden');
            if (emptyCard) emptyCard.classList.remove('hidden');
            if (tbody) tbody.innerHTML = '';
            return;
        }

        if (tableCard) tableCard.classList.remove('hidden');
        if (emptyCard) emptyCard.classList.add('hidden');

        let html = '';
        items.forEach(it => {
            const isPos = it.rendimento >= 0;
            const actionBtn = it.isManual
                ? `<div style="display:flex; justify-content:center; gap:6px;">
                     <button class="action-icon-btn edit" data-action="editRendaFixa" data-arg="${escapeHtml(it.id)}" title="Editar">✏️</button>
                     <button class="action-icon-btn delete" data-action="deleteRendaFixa" data-arg="${escapeHtml(it.id)}" title="Excluir">🗑️</button>
                   </div>`
                : `<span style="color: var(--text-tertiary); font-size: 0.75rem;">B3 Extrato</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(it.nome)}</td>
                    <td><span class="sidebar-badge-pro" style="background: rgba(139, 92, 246, 0.15); color: #A78BFA;">${escapeHtml(it.tipo)}</span></td>
                    <td style="font-weight: 600; color: var(--text-secondary);">${escapeHtml(it.taxa)}</td>
                    <td>${escapeHtml(it.dataAplicacao)}</td>
                    <td>${escapeHtml(it.vencimento)}</td>
                    <td>${it.valorInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 700; color: var(--text-primary);">${it.valorAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">
                        ${isPos ? '+' : ''}${it.rendimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        <span style="font-size:0.75rem; opacity:0.8;">(${isPos ? '+' : ''}${it.rendPct.toFixed(2)}%)</span>
                    </td>
                    <td style="text-align: center;">${actionBtn}</td>
                </tr>
            `;
        });
        if (tbody) tbody.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // 4. RENDERIZADOR: TELA DE CRIPTOMOEDAS
    // -------------------------------------------------------------------------
    function renderCriptoScreen() {
        const multi = loadMultiAssets();
        const items = (multi.cripto || []).map(c => {
            const sym = (c.simbolo || '').toUpperCase().trim();
            const q = parseFloat(c.quant) || 0;
            const pm = parseFloat(c.pm) || 0;
            const quote = (window.cachedQuotes && window.cachedQuotes[sym]) || pm;
            const pos = q * quote;
            const inv = q * pm;
            const lucro = pos - inv;
            const varPct = inv > 0 ? (lucro / inv) * 100 : 0;
            return {
                id: c.id,
                simbolo: sym,
                nome: c.nome || sym,
                quant: q,
                pm: pm,
                currentPrice: quote,
                posicao: pos,
                invested: inv,
                lucro: lucro,
                varPct: varPct
            };
        });

        let totalPatrimonio = 0;
        let totalInvestido = 0;
        let topAsset = null;

        items.forEach(it => {
            totalPatrimonio += it.posicao;
            totalInvestido += it.invested;
            if (!topAsset || it.posicao > topAsset.posicao) {
                topAsset = it;
            }
        });

        const totalLucro = totalPatrimonio - totalInvestido;
        const totalVarPct = totalInvestido > 0 ? (totalLucro / totalInvestido) * 100 : 0;

        // Atualiza KPIs
        const elPat = document.getElementById('val-cripto-patrimonio');
        if (elPat) elPat.textContent = totalPatrimonio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elInv = document.getElementById('val-cripto-investido');
        if (elInv) elInv.textContent = totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const elLucro = document.getElementById('val-cripto-lucro');
        if (elLucro) {
            elLucro.textContent = totalLucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            elLucro.className = `kpi-value ${totalLucro >= 0 ? 'positive' : 'negative'}`;
        }

        const elVar = document.getElementById('val-cripto-var-pct');
        if (elVar) {
            elVar.textContent = `${totalVarPct >= 0 ? '+' : ''}${totalVarPct.toFixed(2)}%`;
            elVar.style.color = totalVarPct >= 0 ? '#10B981' : '#EF4444';
        }

        const elTop = document.getElementById('val-cripto-top');
        if (elTop) {
            if (topAsset && totalPatrimonio > 0) {
                const dom = (topAsset.posicao / totalPatrimonio) * 100;
                elTop.textContent = `${topAsset.simbolo} (${dom.toFixed(0)}%)`;
            } else {
                elTop.textContent = 'N/A';
            }
        }

        const elQtd = document.getElementById('val-cripto-qtd');
        if (elQtd) elQtd.textContent = items.length;

        const elBadge = document.getElementById('badge-cripto-count');
        if (elBadge) elBadge.textContent = `${items.length} moeda${items.length === 1 ? '' : 's'}`;

        const tableCard = document.getElementById('cripto-table-card');
        const emptyCard = document.getElementById('empty-cripto-card');
        const tbody = document.getElementById('cripto-table-tbody');

        if (items.length === 0) {
            if (tableCard) tableCard.classList.add('hidden');
            if (emptyCard) emptyCard.classList.remove('hidden');
            if (tbody) tbody.innerHTML = '';
            return;
        }

        if (tableCard) tableCard.classList.remove('hidden');
        if (emptyCard) emptyCard.classList.add('hidden');

        items.sort((a, b) => b.posicao - a.posicao);

        let html = '';
        items.forEach(it => {
            const isPos = it.lucro >= 0;
            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--text-primary);">${escapeHtml(it.nome)}</td>
                    <td><span class="sidebar-badge-pro" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24;">${escapeHtml(it.simbolo)}</span></td>
                    <td>${it.quant.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</td>
                    <td>${it.pm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 600;">${it.currentPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="font-weight: 700; color: var(--text-primary);">${it.posicao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${it.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style="color: ${isPos ? '#10B981' : '#EF4444'}; font-weight: 600;">${isPos ? '+' : ''}${it.varPct.toFixed(2)}%</td>
                    <td style="text-align: center;">
                        <div style="display:flex; justify-content:center; gap:6px;">
                            <button class="action-icon-btn edit" data-action="editCripto" data-arg="${escapeHtml(it.id)}" title="Editar">✏️</button>
                            <button class="action-icon-btn delete" data-action="deleteCripto" data-arg="${escapeHtml(it.id)}" title="Excluir">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        if (tbody) tbody.innerHTML = html;
    }

    // -------------------------------------------------------------------------
    // 5. MODAIS: ABERTURA, EDIÇÃO E SALVAMENTO
    // -------------------------------------------------------------------------

    // Abertura do Modal de Ação Manual
    document.getElementById('btn-add-acao')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-manual-asset');
        if (!modal) return;
        document.getElementById('modal-manual-title').textContent = '📈 Adicionar Ação à Carteira';
        document.getElementById('manual-asset-class').value = 'Ações';
        document.getElementById('manual-asset-edit-ticker').value = '';
        document.getElementById('manual-ticker').value = '';
        document.getElementById('manual-nome').value = '';
        document.getElementById('manual-quant').value = '';
        document.getElementById('manual-pm').value = '';
        modal.classList.remove('hidden');
        document.getElementById('manual-ticker').focus();
    });

    // Abertura do Modal de ETF Manual
    document.getElementById('btn-add-etf')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-manual-asset');
        if (!modal) return;
        document.getElementById('modal-manual-title').textContent = '🌐 Adicionar Fundo de Índice (ETF)';
        document.getElementById('manual-asset-class').value = 'ETFs';
        document.getElementById('manual-asset-edit-ticker').value = '';
        document.getElementById('manual-ticker').value = '';
        document.getElementById('manual-nome').value = '';
        document.getElementById('manual-quant').value = '';
        document.getElementById('manual-pm').value = '';
        modal.classList.remove('hidden');
        document.getElementById('manual-ticker').focus();
    });

    // Salvar Ação ou ETF Manual
    document.getElementById('btn-save-manual-asset')?.addEventListener('click', async () => {
        const classe = document.getElementById('manual-asset-class').value;
        const editTicker = document.getElementById('manual-asset-edit-ticker').value.trim().toUpperCase();
        const ticker = document.getElementById('manual-ticker').value.trim().toUpperCase();
        const nome = document.getElementById('manual-nome').value.trim() || ticker;
        const quant = parseFloat(document.getElementById('manual-quant').value) || 0;
        const pm = parseFloat(document.getElementById('manual-pm').value) || 0;

        if (!/^[A-Z0-9.-]{1,20}$/.test(ticker) || !Number.isFinite(quant) || !Number.isFinite(pm) || quant <= 0 || pm <= 0) {
            alert('Por favor, preencha o Ticker, a Quantidade e o Preço Médio corretamente.');
            return;
        }

        const multi = loadMultiAssets();
        multi.manualAssets = multi.manualAssets || [];
        if (multi.manualAssets.some(a=>a.classe===classe && a.ticker===ticker && a.ticker!==editTicker)) {
            alert('Este ticker já está cadastrado nesta classe. Edite a posição existente.');
            return;
        }

        // Remove item anterior se estava editando
        if (editTicker) {
            multi.manualAssets = multi.manualAssets.filter(a => !(a.classe === classe && a.ticker === editTicker));
        }

        const newId = `m_${Date.now()}`;
        multi.manualAssets.push({
            id: newId,
            classe,
            ticker,
            nome,
            quant,
            pm
        });

        if (!saveMultiAssets(multi)) return;
        document.getElementById('modal-add-manual-asset').classList.add('hidden');

        // Busca cotação imediata em segundo plano
        fetchMultiAssetQuote(ticker).then(() => {
            if (classe === 'Ações') renderAcoesScreen();
            else renderEtfsScreen();
            renderExecutiveDashboard();
        });

        if (classe === 'Ações') renderAcoesScreen();
        else renderEtfsScreen();
        renderExecutiveDashboard();
    });

    // Abertura do Modal de Renda Fixa
    document.getElementById('btn-add-rf')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-rf');
        if (!modal) return;
        document.getElementById('rf-edit-id').value = '';
        document.getElementById('rf-nome').value = '';
        document.getElementById('rf-tipo').value = 'Tesouro Direto';
        document.getElementById('rf-taxa').value = '';
        document.getElementById('rf-data-aplicacao').value = '';
        document.getElementById('rf-vencimento').value = '';
        document.getElementById('rf-valor-investido').value = '';
        document.getElementById('rf-valor-atual').value = '';
        modal.classList.remove('hidden');
        document.getElementById('rf-nome').focus();
    });

    // Salvar Renda Fixa
    document.getElementById('btn-save-rf')?.addEventListener('click', () => {
        const editId = document.getElementById('rf-edit-id').value;
        const nome = document.getElementById('rf-nome').value.trim();
        const tipo = document.getElementById('rf-tipo').value;
        const taxa = document.getElementById('rf-taxa').value.trim() || '100% CDI';
        const dataAplicacao = document.getElementById('rf-data-aplicacao').value;
        const vencimento = document.getElementById('rf-vencimento').value;
        const valorInvestido = parseFloat(document.getElementById('rf-valor-investido').value) || 0;
        const rawAtual = document.getElementById('rf-valor-atual').value;
        const valorAtual = rawAtual === '' ? valorInvestido : Number(rawAtual);

        if (!nome || !Number.isFinite(valorInvestido) || valorInvestido <= 0 || !Number.isFinite(valorAtual) || valorAtual < 0) {
            alert('Por favor, informe o Nome/Emissor e o Valor Investido.');
            return;
        }

        const multi = loadMultiAssets();
        multi.rendaFixa = multi.rendaFixa || [];

        if (editId) {
            const idx = multi.rendaFixa.findIndex(r => r.id === editId);
            if (idx !== -1) {
                multi.rendaFixa[idx] = { ...multi.rendaFixa[idx], nome, tipo, taxa, dataAplicacao, vencimento, valorInvestido, valorAtual };
            }
        } else {
            multi.rendaFixa.push({
                id: `rf_${Date.now()}`,
                nome,
                tipo,
                taxa,
                dataAplicacao,
                vencimento,
                valorInvestido,
                valorAtual
            });
        }

        if (!saveMultiAssets(multi)) return;
        document.getElementById('modal-add-rf').classList.add('hidden');
        renderRendaFixaScreen();
        renderExecutiveDashboard();
    });

    // Abertura do Modal de Cripto
    document.getElementById('btn-add-cripto')?.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-cripto');
        if (!modal) return;
        document.getElementById('cripto-edit-id').value = '';
        document.getElementById('cripto-simbolo').value = '';
        document.getElementById('cripto-nome').value = '';
        document.getElementById('cripto-quant').value = '';
        document.getElementById('cripto-pm').value = '';
        modal.classList.remove('hidden');
        document.getElementById('cripto-simbolo').focus();
    });

    // Salvar Criptoativo
    document.getElementById('btn-save-cripto')?.addEventListener('click', async () => {
        const editId = document.getElementById('cripto-edit-id').value;
        const simbolo = document.getElementById('cripto-simbolo').value.trim().toUpperCase();
        const nome = document.getElementById('cripto-nome').value.trim() || simbolo;
        const quant = parseFloat(document.getElementById('cripto-quant').value) || 0;
        const pm = parseFloat(document.getElementById('cripto-pm').value) || 0;

        if (!/^[A-Z0-9]{1,20}$/.test(simbolo) || !Number.isFinite(quant) || !Number.isFinite(pm) || quant <= 0 || pm <= 0) {
            alert('Por favor, preencha o Símbolo, a Quantidade e o Preço Médio.');
            return;
        }

        const multi = loadMultiAssets();
        multi.cripto = multi.cripto || [];

        if (editId) {
            const idx = multi.cripto.findIndex(c => c.id === editId);
            if (idx !== -1) {
                multi.cripto[idx] = { ...multi.cripto[idx], simbolo, nome, quant, pm };
            }
        } else {
            multi.cripto.push({
                id: `c_${Date.now()}`,
                simbolo,
                nome,
                quant,
                pm
            });
        }

        if (!saveMultiAssets(multi)) return;
        document.getElementById('modal-add-cripto').classList.add('hidden');

        // Busca cotação imediata via Binance/API em segundo plano
        fetchMultiAssetQuote(simbolo).then(() => {
            renderCriptoScreen();
            renderExecutiveDashboard();
        });

        renderCriptoScreen();
        renderExecutiveDashboard();
    });

    // -------------------------------------------------------------------------
    // 6. EXCLUSÃO E EDIÇÃO GLOBAL (WINDOW HANDLERS)
    // -------------------------------------------------------------------------
    window.editManualAsset = function(id, classe) {
        const multi = loadMultiAssets();
        const item = (multi.manualAssets || []).find(a => a.id === id);
        if (!item) return;
        const modal = document.getElementById('modal-add-manual-asset');
        if (!modal) return;
        document.getElementById('modal-manual-title').textContent = classe === 'ETFs' ? '🌐 Editar Fundo de Índice (ETF)' : '📈 Editar Ação';
        document.getElementById('manual-asset-class').value = classe;
        document.getElementById('manual-asset-edit-ticker').value = item.ticker || '';
        document.getElementById('manual-ticker').value = item.ticker || '';
        document.getElementById('manual-nome').value = item.nome || '';
        document.getElementById('manual-quant').value = item.quant || '';
        document.getElementById('manual-pm').value = item.pm || '';
        modal.classList.remove('hidden');
        document.getElementById('manual-quant').focus();
    };

    window.deleteManualAsset = function(id, classe) {
        if (!confirm('Deseja realmente remover este ativo cadastrado manualmente?')) return;
        const multi = loadMultiAssets();
        multi.manualAssets = (multi.manualAssets || []).filter(a => a.id !== id);
        if (!saveMultiAssets(multi)) return;
        if (classe === 'Ações') renderAcoesScreen();
        else renderEtfsScreen();
        renderExecutiveDashboard();
    };

    window.editRendaFixa = function(id) {
        const multi = loadMultiAssets();
        const item = (multi.rendaFixa || []).find(r => r.id === id);
        if (!item) return;
        document.getElementById('rf-edit-id').value = item.id;
        document.getElementById('rf-nome').value = item.nome || '';
        document.getElementById('rf-tipo').value = item.tipo || 'CDB';
        document.getElementById('rf-taxa').value = item.taxa || '';
        document.getElementById('rf-data-aplicacao').value = item.dataAplicacao || '';
        document.getElementById('rf-vencimento').value = item.vencimento || '';
        document.getElementById('rf-valor-investido').value = item.valorInvestido || '';
        document.getElementById('rf-valor-atual').value = item.valorAtual ?? item.valorInvestido ?? '';
        document.getElementById('modal-add-rf').classList.remove('hidden');
    };

    window.deleteRendaFixa = function(id) {
        if (!confirm('Deseja realmente excluir este título de renda fixa?')) return;
        const multi = loadMultiAssets();
        multi.rendaFixa = (multi.rendaFixa || []).filter(r => r.id !== id);
        if (!saveMultiAssets(multi)) return;
        renderRendaFixaScreen();
        renderExecutiveDashboard();
    };

    window.editCripto = function(id) {
        const multi = loadMultiAssets();
        const item = (multi.cripto || []).find(c => c.id === id);
        if (!item) return;
        document.getElementById('cripto-edit-id').value = item.id;
        document.getElementById('cripto-simbolo').value = item.simbolo || '';
        document.getElementById('cripto-nome').value = item.nome || '';
        document.getElementById('cripto-quant').value = item.quant || '';
        document.getElementById('cripto-pm').value = item.pm || '';
        document.getElementById('modal-add-cripto').classList.remove('hidden');
    };

    window.deleteCripto = function(id) {
        if (!confirm('Deseja realmente excluir este criptoativo?')) return;
        const multi = loadMultiAssets();
        multi.cripto = (multi.cripto || []).filter(c => c.id !== id);
        if (!saveMultiAssets(multi)) return;
        renderCriptoScreen();
        renderExecutiveDashboard();
    };

    // Renderização inicial no carregamento da página
    renderAcoesScreen();
    renderEtfsScreen();
    renderRendaFixaScreen();
    renderCriptoScreen();

    // Inicialização do Cockpit Executivo Multi-Ativos
    if (typeof initExecutiveDashboard === 'function') {
        initExecutiveDashboard();
    }
    if (typeof renderExecutiveDashboard === 'function') {
        renderExecutiveDashboard();
    }

});

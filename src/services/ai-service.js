/**
 * AI Service - Port of ai_service.py
 * Integration with Google Gemini, OpenAI, and Anthropic for portfolio analysis.
 */

const { SYSTEM_PROMPT, analysisPrompt } = require('./analysis-prompt');

class AIService {
    constructor() {
        this._provider = null;
        this._apiKey = null;
        this._model = null;
        this._userName = '';
        this.chatSessions = {}; // session_id -> chat history
        this.restoredMessages = {};
    }

    async configure(provider, apiKey, userName = '') {
        this._provider = provider;
        this._apiKey = apiKey;
        this._userName = userName;
        this._model = null;
        this.chatSessions = {}; // Reset sessions on reconfigure

        if (!apiKey) return;

        try {
            if (provider === 'gemini') {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(apiKey);
                this._model = genAI.getGenerativeModel({
                    model: 'gemini-2.0-flash',
                    systemInstruction: SYSTEM_PROMPT
                });
            } else if (provider === 'openai') {
                const OpenAI = require('openai');
                this._model = new OpenAI({ apiKey, timeout: 60000, maxRetries: 1 });
            } else if (provider === 'anthropic') {
                const Anthropic = require('@anthropic-ai/sdk');
                this._model = new Anthropic({ apiKey });
            }
        } catch (e) {
            console.error(`Error configuring AI (${provider}): ${e}`);
            this._model = null;
        }
    }

    isConfigured() {
        return !!(this._apiKey && this._model);
    }

    _buildSystemPrompt(strategyText = '') {
        let prompt = SYSTEM_PROMPT;
        if (this._userName) {
            prompt += `\n\nO nome do investidor é **${this._userName}**. Chame-o pelo nome.`;
        }
        if (strategyText) {
            prompt += `\n\n## ESTRATÉGIA ATUAL DO INVESTIDOR (memória persistente):\n${strategyText}\n\nEsta memória foi inferida e pode estar desatualizada. Use como hipótese contextual; priorize os dados e pedidos atuais.`;
        }
        return prompt;
    }

    _buildPortfolioContext(portfolioData) {
        if (!portfolioData) return 'Nenhum dado de portfólio disponível.';
        if (portfolioData.snapshot?.schema === 'vsa-analysis-v1') return JSON.stringify(portfolioData.snapshot, null, 2);

        const lines = ['## DADOS DO PORTFÓLIO DO INVESTIDOR\n'];

        // Assets summary
        if (portfolioData.categories) {
            lines.push('### Ativos por Categoria:');
            for (const [catName, catData] of Object.entries(portfolioData.categories)) {
                const total = catData.total || 0;
                const ativos = catData.ativos || {};
                lines.push(`\n**${catName}** (Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}):`)
                for (const [ticker, info] of Object.entries(ativos)) {
                    const quant = info.quant || 0;
                    if (quant > 0) {
                        const avgPrice = info.avgPrice ?? (quant > 0 ? info.investedVal / quant : 0);
                        const currentPrice = info.currentPrice || 0;
                        const totalVal = info.totalValue || quant * currentPrice;
                        lines.push(`  - ${ticker}: ${quant} cotas | PM: R$ ${avgPrice.toFixed(2)} | Preço Atual: R$ ${currentPrice.toFixed(2)} | Total: R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
                    }
                }
            }
        }

        // Performance
        if (portfolioData.performance) {
            const perf = portfolioData.performance;
            lines.push('\n### Performance:');
            if (perf.patrimonio !== undefined) lines.push(`- Patrimônio Total: R$ ${(perf.patrimonio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (perf.investido !== undefined) lines.push(`- Valor Investido: R$ ${(perf.investido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (perf.lucro !== undefined) lines.push(`- Lucro/Prejuízo: R$ ${(perf.lucro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (perf.proventos !== undefined) lines.push(`- Proventos Recebidos (período informado): R$ ${(perf.proventos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (perf.proventos_media !== undefined) lines.push(`- Média Mensal de Proventos: R$ ${(perf.proventos_media || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }

        // Rentabilidade
        if (portfolioData.rentabilidade) {
            const rent = portfolioData.rentabilidade;
            lines.push('\n### Rentabilidade estimada (Modified Dietz mensal):');
            if (rent.total !== undefined) lines.push(`- Total Acumulada: ${(rent.total || 0).toFixed(2)}%`);
            if (rent['12m'] !== undefined) lines.push(`- Últimos 12 Meses: ${(rent['12m'] || 0).toFixed(2)}%`);
            if (rent['1m'] !== undefined) lines.push(`- Último Mês: ${(rent['1m'] || 0).toFixed(2)}%`);
            if (rent.vs_cdi) lines.push(`- vs CDI: ${rent.vs_cdi}`);
        }

        // Metas
        if (portfolioData.metas) {
            lines.push('\n### Metas do Investidor:');
            for (const meta of portfolioData.metas) {
                const perc = meta.value_target > 0 ? (meta.value_current / meta.value_target * 100) : 0;
                const status = meta.kind === 'recurring' || meta.id === 'aporte_mensal' ? 'Compromisso recorrente ativo; não concluído' : perc >= 100 ? 'Objetivo atingido' : `${perc.toFixed(1)}%`;
                lines.push(`  - ${meta.title}: Atual R$ ${(meta.value_current || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / Objetivo R$ ${(meta.value_target || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${status})`);
            }
        }

        // Monthly investments
        if (portfolioData.aportes) {
            const ap = portfolioData.aportes;
            lines.push('\n### Aportes:');
            lines.push(`- Aporte médio mensal: R$ ${(ap.media_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            lines.push(`- Total aportado no ano: R$ ${(ap.total_ano || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }

        return lines.join('\n');
    }

    // ==========================================
    // GEMINI
    // ==========================================
    async _geminiAnalyze(context, strategyText = '', analysisType = 'geral') {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this._apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: this._buildSystemPrompt(strategyText)
        });
        const prompt = analysisPrompt(context, analysisType);
        const response = await model.generateContent(prompt);
        return response.response.text();
    }

    async _geminiChat(sessionId, message, portfolioData = null, strategyText = '') {
        if (!this.chatSessions[sessionId]) {
            const context = portfolioData ? this._buildPortfolioContext(portfolioData) : '';
            const history = [];
            if (context) {
                history.push(
                    { role: 'user', parts: [{ text: `Aqui estão os dados do meu portfólio para contexto:\n\n${context}\n\nPor favor, leve esses dados em consideração em todas as respostas.` }] },
                    { role: 'model', parts: [{ text: 'Entendido! Analisei todos os dados do seu portfólio e conheço sua estratégia. Estou pronto para ajudar com sugestões personalizadas. 🚀' }] }
                );
            }
            // For Gemini, system instruction is set on the model, not the session
            // We re-create the model with strategy context for this session
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(this._apiKey);
            const sessionModel = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction: this._buildSystemPrompt(strategyText)
            });
            history.push(...(this.restoredMessages[sessionId] || []).map(m => ({role: m.role === 'user' ? 'user' : 'model', parts: [{text: m.content}]})));
            this.chatSessions[sessionId] = sessionModel.startChat({ history });
        }

        const chat = this.chatSessions[sessionId];
        const response = await chat.sendMessage(message);
        return response.response.text();
    }

    async _geminiInferStrategy(context) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this._apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `Com base nos dados de portfólio abaixo, infira em 3-5 frases qual é a estratégia de investimento atual deste investidor. Seja específico, use os dados reais (ativos, metas, proventos). Escreva na terceira pessoa de forma objetiva, como uma memória estratégica para um assistente de IA. Não inclua disclaimers. Responda APENAS com o texto da estratégia, sem títulos.\n\n${context}`;
        const response = await model.generateContent(prompt);
        return response.response.text().trim();
    }

    // ==========================================
    // OPENAI (ChatGPT)
    // ==========================================
    async _openaiAnalyze(context, strategyText = '', analysisType = 'geral') {
        const prompt = analysisPrompt(context, analysisType);
        const response = await this._model.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: this._buildSystemPrompt(strategyText) },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4096
        });
        return response.choices[0].message.content;
    }

    async _openaiChat(sessionId, message, portfolioData = null, strategyText = '') {
        if (!this.chatSessions[sessionId]) {
            const context = portfolioData ? this._buildPortfolioContext(portfolioData) : '';
            const history = [{ role: 'system', content: this._buildSystemPrompt(strategyText) }];
            if (context) {
                history.push(
                    { role: 'user', content: `Aqui estão os dados do meu portfólio para contexto:\n\n${context}\n\nPor favor, leve esses dados em consideração em todas as respostas.` },
                    { role: 'assistant', content: 'Entendido! Analisei todos os dados do seu portfólio e conheço sua estratégia. Estou pronto para ajudar. 🚀' }
                );
            }
            history.push(...(this.restoredMessages[sessionId] || []).map(m => ({role: m.role === 'user' ? 'user' : 'assistant', content: m.content})));
            this.chatSessions[sessionId] = history;
        }

        this.chatSessions[sessionId].push({ role: 'user', content: message });

        const response = await this._model.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: this.chatSessions[sessionId],
            temperature: 0.7,
            max_tokens: 4096
        });

        const reply = response.choices[0].message.content;
        this.chatSessions[sessionId].push({ role: 'assistant', content: reply });
        return reply;
    }

    async _openaiInferStrategy(context) {
        const response = await this._model.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Você é um analista financeiro que sintetiza estratégias de investimento de forma objetiva.' },
                { role: 'user', content: `Com base nos dados de portfólio abaixo, infira em 3-5 frases qual é a estratégia de investimento atual deste investidor. Seja específico, use os dados reais. Escreva na terceira pessoa de forma objetiva, como uma memória estratégica para um assistente de IA. Não inclua disclaimers. Responda APENAS com o texto da estratégia.\n\n${context}` }
            ],
            temperature: 0.5,
            max_tokens: 512
        });
        return response.choices[0].message.content.trim();
    }

    // ==========================================
    // ANTHROPIC (Claude)
    // ==========================================
    async _anthropicAnalyze(context, strategyText = '', analysisType = 'geral') {
        const prompt = analysisPrompt(context, analysisType);
        const response = await this._model.messages.create({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 4096,
            system: this._buildSystemPrompt(strategyText),
            messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
    }

    async _anthropicChat(sessionId, message, portfolioData = null, strategyText = '') {
        if (!this.chatSessions[sessionId]) {
            const context = portfolioData ? this._buildPortfolioContext(portfolioData) : '';
            const history = [];
            if (context) {
                history.push(
                    { role: 'user', content: `Aqui estão os dados do meu portfólio para contexto:\n\n${context}\n\nPor favor, leve esses dados em consideração em todas as respostas.` },
                    { role: 'assistant', content: 'Entendido! Analisei todos os dados do seu portfólio e conheço sua estratégia. Estou pronto para ajudar. 🚀' }
                );
            }
            history.push(...(this.restoredMessages[sessionId] || []).map(m => ({role: m.role === 'user' ? 'user' : 'assistant', content: m.content})));
            this.chatSessions[sessionId] = history;
        }

        this.chatSessions[sessionId].push({ role: 'user', content: message });

        const response = await this._model.messages.create({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 4096,
            system: this._buildSystemPrompt(strategyText),
            messages: this.chatSessions[sessionId]
        });

        const reply = response.content[0].text;
        this.chatSessions[sessionId].push({ role: 'assistant', content: reply });
        return reply;
    }

    async _anthropicInferStrategy(context) {
        const response = await this._model.messages.create({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 512,
            system: 'Você é um analista financeiro que sintetiza estratégias de investimento de forma objetiva.',
            messages: [{ role: 'user', content: `Com base nos dados de portfólio abaixo, infira em 3-5 frases qual é a estratégia de investimento atual deste investidor. Seja específico, use os dados reais. Escreva na terceira pessoa de forma objetiva. Não inclua disclaimers. Responda APENAS com o texto da estratégia.\n\n${context}` }]
        });
        return response.content[0].text.trim();
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    async analyzePortfolio(portfolioData, strategyText = '') {
        if (!this.isConfigured()) {
            return { error: 'API key not configured. Acesse as Configurações (⚙️) para configurar.' };
        }

        const context = this._buildPortfolioContext(portfolioData);

        try {
            let text;
            const analysisType = portfolioData.analysisType || 'geral';
            
            if (this._provider === 'gemini') {
                text = await this._geminiAnalyze(context, strategyText, analysisType);
            } else if (this._provider === 'openai') {
                text = await this._openaiAnalyze(context, strategyText, analysisType);
            } else if (this._provider === 'anthropic') {
                text = await this._anthropicAnalyze(context, strategyText, analysisType);
            } else {
                return { error: `Provedor '${this._provider}' não suportado.` };
            }
            return { analysis: text };
        } catch (e) {
            const err = String(e);
            if (err.includes('429') || err.includes('Quota') || err.toLowerCase().includes('rate')) {
                return { error: 'Sem pressa! Aguarde um minuto. Você atingiu o limite de velocidade da API (Anti-Spam).' };
            }
            return { error: err };
        }
    }

    async chat(sessionId, message, portfolioData = null, strategyText = '') {
        if (!this.isConfigured()) {
            return { error: 'API key not configured. Acesse as Configurações (⚙️) para configurar.' };
        }

        try {
            let text;
            if (this._provider === 'gemini') {
                text = await this._geminiChat(sessionId, message, portfolioData, strategyText);
            } else if (this._provider === 'openai') {
                text = await this._openaiChat(sessionId, message, portfolioData, strategyText);
            } else if (this._provider === 'anthropic') {
                text = await this._anthropicChat(sessionId, message, portfolioData, strategyText);
            } else {
                return { error: `Provedor '${this._provider}' não suportado.` };
            }
            return { response: text };
        } catch (e) {
            const err = String(e);
            if (err.includes('429') || err.includes('Quota') || err.toLowerCase().includes('rate')) {
                return { error: 'Aguarde um minuto! O limite da API pediu uma pausa rápida.' };
            }
            return { error: err };
        }
    }

    /**
     * Infer the user's investment strategy using the AI.
     * Called only when the portfolio hash changes.
     */
    async inferStrategy(portfolioData, strategyText = '') {
        if (!this.isConfigured()) {
            return { error: 'API não configurada.' };
        }
        const context = this._buildPortfolioContext(portfolioData);
        try {
            let text;
            if (this._provider === 'gemini') {
                text = await this._geminiInferStrategy(context);
            } else if (this._provider === 'openai') {
                text = await this._openaiInferStrategy(context);
            } else if (this._provider === 'anthropic') {
                text = await this._anthropicInferStrategy(context);
            } else {
                return { error: `Provedor '${this._provider}' não suportado.` };
            }
            return { strategy: text };
        } catch (e) {
            const err = String(e);
            if (err.includes('429') || err.includes('Quota') || err.toLowerCase().includes('rate')) {
                return { error: 'Rate limit atingido ao inferir estratégia.' };
            }
            return { error: err };
        }
    }

    restoreSession(sessionId, messages) {
        // Rebuild each request with the current portfolio and bounded persisted history.
        delete this.chatSessions[sessionId];
        const recent = messages.slice(-40).filter(m => ['user', 'bot'].includes(m.role) && typeof m.content === 'string');
        while (recent.length && recent[0].role !== 'user') recent.shift();
        this.restoredMessages[sessionId] = recent;
    }

    clearSession(sessionId) {
        delete this.restoredMessages[sessionId];
        if (this.chatSessions[sessionId]) {
            delete this.chatSessions[sessionId];
        }
    }
}

// Singleton
const aiService = new AIService();
module.exports = { aiService, AIService };

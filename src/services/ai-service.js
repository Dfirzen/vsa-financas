/**
 * AI Service - Port of ai_service.py
 * Integration with Google Gemini, OpenAI, and Anthropic for portfolio analysis.
 */

const SYSTEM_PROMPT = `Você é o **InvestAI**, um consultor financeiro pessoal integrado a um dashboard de investimentos.

Seu papel é analisar o portfólio do investidor e fornecer insights personalizados, claros e acionáveis.

## Regras de conduta:
1. Sempre responda em **português brasileiro**
2. Use **emojis** para organizar e tornar a leitura agradável
3. Seja **objetivo e direto** — o investidor quer respostas práticas
4. Quando sugerir ativos específicos, sempre mencione que **não é recomendação formal de investimento**
5. Use dados concretos do portfólio nas suas análises (valores, percentuais, nomes de ativos)
6. Formate com **markdown**: use títulos, listas, negrito e itálico para organizar
7. Considere o perfil do investidor com base nos dados (conservador, moderado, arrojado)
8. Sempre relacione sugestões com as **metas** do investidor quando disponíveis
9. Se souber o nome do investidor, chame pelo nome para tornar a conversa mais pessoal

## Ao fazer análise automática, cubra:
- 📊 **Visão Geral** do portfólio
- 🎯 **Progresso das Metas** 
- ⚠️ **Pontos de Atenção** (concentração, risco, etc)
- 💡 **Sugestões** práticas e acionáveis
- 📈 **Projeções** baseadas no ritmo atual

## Disclaimer:
Sempre inclua ao final de análises mais detalhadas:
> ⚠️ *Este é um assistente educacional. As informações não constituem recomendação de investimento. Consulte um assessor certificado para decisões financeiras.*`;

class AIService {
    constructor() {
        this._provider = null;
        this._apiKey = null;
        this._model = null;
        this._userName = '';
        this.chatSessions = {}; // session_id -> chat history
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
                this._model = new OpenAI({ apiKey });
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

    _getSystemWithName() {
        if (this._userName) {
            return SYSTEM_PROMPT + `\n\nO nome do investidor é **${this._userName}**. Chame-o pelo nome.`;
        }
        return SYSTEM_PROMPT;
    }

    _buildPortfolioContext(portfolioData) {
        if (!portfolioData) return 'Nenhum dado de portfólio disponível.';

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
                        const avgPrice = info.avgPrice || 0;
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
            if (perf.proventos !== undefined) lines.push(`- Proventos Recebidos (12M): R$ ${(perf.proventos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (perf.proventos_media !== undefined) lines.push(`- Média Mensal de Proventos: R$ ${(perf.proventos_media || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }

        // Rentabilidade
        if (portfolioData.rentabilidade) {
            const rent = portfolioData.rentabilidade;
            lines.push('\n### Rentabilidade (TWR):');
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
                const status = perc >= 100 ? '✅ Concluída' : `${perc.toFixed(1)}%`;
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
    async _geminiAnalyze(context) {
        const prompt = `Analise o portfólio abaixo e forneça uma análise completa e personalizada.\n\n${context}\n\nForneça sua análise cobrindo: Visão Geral, Progresso das Metas, Pontos de Atenção, Sugestões práticas e Projeções.`;
        const response = await this._model.generateContent(prompt);
        return response.response.text();
    }

    async _geminiChat(sessionId, message, portfolioData = null) {
        if (!this.chatSessions[sessionId]) {
            const context = portfolioData ? this._buildPortfolioContext(portfolioData) : '';
            const history = [];
            if (context) {
                history.push(
                    { role: 'user', parts: [{ text: `Aqui estão os dados do meu portfólio para contexto:\n\n${context}\n\nPor favor, leve esses dados em consideração em todas as respostas.` }] },
                    { role: 'model', parts: [{ text: 'Entendido! Analisei todos os dados do seu portfólio. Estou pronto para responder suas dúvidas e fornecer sugestões personalizadas com base nos seus investimentos, metas e performance. Como posso ajudar? 🚀' }] }
                );
            }
            this.chatSessions[sessionId] = this._model.startChat({ history });
        }

        const chat = this.chatSessions[sessionId];
        const response = await chat.sendMessage(message);
        return response.response.text();
    }

    // ==========================================
    // OPENAI (ChatGPT)
    // ==========================================
    async _openaiAnalyze(context) {
        const prompt = `Analise o portfólio abaixo e forneça uma análise completa e personalizada.\n\n${context}\n\nForneça sua análise cobrindo: Visão Geral, Progresso das Metas, Pontos de Atenção, Sugestões práticas e Projeções.`;
        const response = await this._model.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: this._getSystemWithName() },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4096
        });
        return response.choices[0].message.content;
    }

    async _openaiChat(sessionId, message, portfolioData = null) {
        if (!this.chatSessions[sessionId]) {
            const context = portfolioData ? this._buildPortfolioContext(portfolioData) : '';
            const history = [{ role: 'system', content: this._getSystemWithName() }];
            if (context) {
                history.push(
                    { role: 'user', content: `Aqui estão os dados do meu portfólio para contexto:\n\n${context}\n\nPor favor, leve esses dados em consideração em todas as respostas.` },
                    { role: 'assistant', content: 'Entendido! Analisei todos os dados do seu portfólio. Estou pronto para responder suas dúvidas e fornecer sugestões personalizadas. Como posso ajudar? 🚀' }
                );
            }
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

    // ==========================================
    // ANTHROPIC (Claude)
    // ==========================================
    async _anthropicAnalyze(context) {
        const prompt = `Analise o portfólio abaixo e forneça uma análise completa e personalizada.\n\n${context}\n\nForneça sua análise cobrindo: Visão Geral, Progresso das Metas, Pontos de Atenção, Sugestões práticas e Projeções.`;
        const response = await this._model.messages.create({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 4096,
            system: this._getSystemWithName(),
            messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
    }

    async _anthropicChat(sessionId, message, portfolioData = null) {
        if (!this.chatSessions[sessionId]) {
            const context = portfolioData ? this._buildPortfolioContext(portfolioData) : '';
            const history = [];
            if (context) {
                history.push(
                    { role: 'user', content: `Aqui estão os dados do meu portfólio para contexto:\n\n${context}\n\nPor favor, leve esses dados em consideração em todas as respostas.` },
                    { role: 'assistant', content: 'Entendido! Analisei todos os dados do seu portfólio. Estou pronto para responder suas dúvidas e fornecer sugestões personalizadas. Como posso ajudar? 🚀' }
                );
            }
            this.chatSessions[sessionId] = history;
        }

        this.chatSessions[sessionId].push({ role: 'user', content: message });

        const response = await this._model.messages.create({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 4096,
            system: this._getSystemWithName(),
            messages: this.chatSessions[sessionId]
        });

        const reply = response.content[0].text;
        this.chatSessions[sessionId].push({ role: 'assistant', content: reply });
        return reply;
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    async analyzePortfolio(portfolioData) {
        if (!this.isConfigured()) {
            return { error: 'API key not configured. Acesse as Configurações (⚙️) para configurar.' };
        }

        const context = this._buildPortfolioContext(portfolioData);

        try {
            let text;
            if (this._provider === 'gemini') {
                text = await this._geminiAnalyze(context);
            } else if (this._provider === 'openai') {
                text = await this._openaiAnalyze(context);
            } else if (this._provider === 'anthropic') {
                text = await this._anthropicAnalyze(context);
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

    async chat(sessionId, message, portfolioData = null) {
        if (!this.isConfigured()) {
            return { error: 'API key not configured. Acesse as Configurações (⚙️) para configurar.' };
        }

        try {
            let text;
            if (this._provider === 'gemini') {
                text = await this._geminiChat(sessionId, message, portfolioData);
            } else if (this._provider === 'openai') {
                text = await this._openaiChat(sessionId, message, portfolioData);
            } else if (this._provider === 'anthropic') {
                text = await this._anthropicChat(sessionId, message, portfolioData);
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

    clearSession(sessionId) {
        if (this.chatSessions[sessionId]) {
            delete this.chatSessions[sessionId];
        }
    }
}

// Singleton
const aiService = new AIService();
module.exports = { aiService };

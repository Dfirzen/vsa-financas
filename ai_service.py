"""
AI Service - Integração com Google Gemini, OpenAI e Anthropic para análise de portfólio.
"""
import os
import sys

SYSTEM_PROMPT = """Você é o **InvestAI**, um consultor financeiro pessoal integrado a um dashboard de investimentos.

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
> ⚠️ *Este é um assistente educacional. As informações não constituem recomendação de investimento. Consulte um assessor certificado para decisões financeiras.*
"""


class AIService:
    def __init__(self):
        self._provider = None
        self._api_key = None
        self._model = None
        self._user_name = ""
        self.chat_sessions = {}  # session_id -> chat history

    def configure(self, provider, api_key, user_name=""):
        """Reconfigure the AI service with a new provider and API key."""
        self._provider = provider
        self._api_key = api_key
        self._user_name = user_name
        self._model = None
        self.chat_sessions = {}  # Reset sessions on reconfigure
        
        if not api_key:
            return
            
        try:
            if provider == 'gemini':
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self._model = genai.GenerativeModel(
                    model_name='gemini-2.0-flash',
                    system_instruction=SYSTEM_PROMPT
                )
            elif provider == 'openai':
                from openai import OpenAI
                self._model = OpenAI(api_key=api_key)
            elif provider == 'anthropic':
                from anthropic import Anthropic
                self._model = Anthropic(api_key=api_key)
        except Exception as e:
            print(f"Error configuring AI ({provider}): {e}")
            self._model = None

    def is_configured(self):
        return bool(self._api_key and self._model)

    def _get_system_with_name(self):
        if self._user_name:
            return SYSTEM_PROMPT + f"\n\nO nome do investidor é **{self._user_name}**. Chame-o pelo nome."
        return SYSTEM_PROMPT

    def _build_portfolio_context(self, portfolio_data):
        """Builds a text context from portfolio data for the AI."""
        if not portfolio_data:
            return "Nenhum dado de portfólio disponível."
        
        lines = ["## DADOS DO PORTFÓLIO DO INVESTIDOR\n"]
        
        # Assets summary
        if 'categories' in portfolio_data:
            lines.append("### Ativos por Categoria:")
            for cat_name, cat_data in portfolio_data['categories'].items():
                total = cat_data.get('total', 0)
                ativos = cat_data.get('ativos', {})
                lines.append(f"\n**{cat_name}** (Total: R$ {total:,.2f}):")
                for ticker, info in ativos.items():
                    quant = info.get('quant', 0)
                    if quant > 0:
                        avg_price = info.get('avgPrice', 0)
                        current_price = info.get('currentPrice', 0)
                        total_val = info.get('totalValue', quant * current_price)
                        lines.append(f"  - {ticker}: {quant} cotas | PM: R$ {avg_price:.2f} | Preço Atual: R$ {current_price:.2f} | Total: R$ {total_val:,.2f}")
        
        # Performance
        if 'performance' in portfolio_data:
            perf = portfolio_data['performance']
            lines.append(f"\n### Performance:")
            lines.append(f"- Patrimônio Total: R$ {perf.get('patrimonio', 0):,.2f}")
            lines.append(f"- Valor Investido: R$ {perf.get('investido', 0):,.2f}")
            lines.append(f"- Lucro/Prejuízo: R$ {perf.get('lucro', 0):,.2f}")
            lines.append(f"- Proventos Recebidos (12M): R$ {perf.get('proventos', 0):,.2f}")
            lines.append(f"- Média Mensal de Proventos: R$ {perf.get('proventos_media', 0):,.2f}")
        
        # Rentabilidade
        if 'rentabilidade' in portfolio_data:
            rent = portfolio_data['rentabilidade']
            lines.append(f"\n### Rentabilidade (TWR):")
            lines.append(f"- Total Acumulada: {rent.get('total', 0):.2f}%")
            lines.append(f"- Últimos 12 Meses: {rent.get('12m', 0):.2f}%")
            lines.append(f"- Último Mês: {rent.get('1m', 0):.2f}%")
            if 'vs_cdi' in rent:
                lines.append(f"- vs CDI: {rent['vs_cdi']}")
        
        # Metas
        if 'metas' in portfolio_data:
            lines.append(f"\n### Metas do Investidor:")
            for meta in portfolio_data['metas']:
                perc = (meta['value_current'] / meta['value_target'] * 100) if meta['value_target'] > 0 else 0
                status = "✅ Concluída" if perc >= 100 else f"{perc:.1f}%"
                lines.append(f"  - {meta['title']}: Atual R$ {meta['value_current']:,.2f} / Objetivo R$ {meta['value_target']:,.2f} ({status})")
        
        # Monthly investments
        if 'aportes' in portfolio_data:
            ap = portfolio_data['aportes']
            lines.append(f"\n### Aportes:")
            lines.append(f"- Aporte médio mensal: R$ {ap.get('media_mensal', 0):,.2f}")
            lines.append(f"- Total aportado no ano: R$ {ap.get('total_ano', 0):,.2f}")
        
        return "\n".join(lines)

    # ==========================================
    # GEMINI
    # ==========================================
    def _gemini_analyze(self, context):
        prompt = f"""Analise o portfólio abaixo e forneça uma análise completa e personalizada.

{context}

Forneça sua análise cobrindo: Visão Geral, Progresso das Metas, Pontos de Atenção, Sugestões práticas e Projeções."""
        
        response = self._model.generate_content(prompt)
        return response.text

    def _gemini_chat(self, session_id, message, portfolio_data=None):
        import google.generativeai as genai
        
        if session_id not in self.chat_sessions:
            context = self._build_portfolio_context(portfolio_data) if portfolio_data else ""
            history = []
            if context:
                history = [
                    {"role": "user", "parts": [f"Aqui estão os dados do meu portfólio para contexto:\n\n{context}\n\nPor favor, leve esses dados em consideração em todas as respostas."]},
                    {"role": "model", "parts": [f"Entendido! Analisei todos os dados do seu portfólio. Estou pronto para responder suas dúvidas e fornecer sugestões personalizadas com base nos seus investimentos, metas e performance. Como posso ajudar? 🚀"]}
                ]
            
            self.chat_sessions[session_id] = self._model.start_chat(history=history)
        
        chat = self.chat_sessions[session_id]
        response = chat.send_message(message)
        return response.text

    # ==========================================
    # OPENAI (ChatGPT)
    # ==========================================
    def _openai_analyze(self, context):
        prompt = f"""Analise o portfólio abaixo e forneça uma análise completa e personalizada.

{context}

Forneça sua análise cobrindo: Visão Geral, Progresso das Metas, Pontos de Atenção, Sugestões práticas e Projeções."""
        
        response = self._model.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": self._get_system_with_name()},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4096
        )
        return response.choices[0].message.content

    def _openai_chat(self, session_id, message, portfolio_data=None):
        if session_id not in self.chat_sessions:
            context = self._build_portfolio_context(portfolio_data) if portfolio_data else ""
            history = [{"role": "system", "content": self._get_system_with_name()}]
            if context:
                history.append({"role": "user", "content": f"Aqui estão os dados do meu portfólio para contexto:\n\n{context}\n\nPor favor, leve esses dados em consideração em todas as respostas."})
                history.append({"role": "assistant", "content": "Entendido! Analisei todos os dados do seu portfólio. Estou pronto para responder suas dúvidas e fornecer sugestões personalizadas. Como posso ajudar? 🚀"})
            self.chat_sessions[session_id] = history
        
        self.chat_sessions[session_id].append({"role": "user", "content": message})
        
        response = self._model.chat.completions.create(
            model="gpt-4o-mini",
            messages=self.chat_sessions[session_id],
            temperature=0.7,
            max_tokens=4096
        )
        
        reply = response.choices[0].message.content
        self.chat_sessions[session_id].append({"role": "assistant", "content": reply})
        return reply

    # ==========================================
    # ANTHROPIC (Claude)
    # ==========================================
    def _anthropic_analyze(self, context):
        prompt = f"""Analise o portfólio abaixo e forneça uma análise completa e personalizada.

{context}

Forneça sua análise cobrindo: Visão Geral, Progresso das Metas, Pontos de Atenção, Sugestões práticas e Projeções."""
        
        response = self._model.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=4096,
            system=self._get_system_with_name(),
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.content[0].text

    def _anthropic_chat(self, session_id, message, portfolio_data=None):
        if session_id not in self.chat_sessions:
            context = self._build_portfolio_context(portfolio_data) if portfolio_data else ""
            history = []
            if context:
                history.append({"role": "user", "content": f"Aqui estão os dados do meu portfólio para contexto:\n\n{context}\n\nPor favor, leve esses dados em consideração em todas as respostas."})
                history.append({"role": "assistant", "content": "Entendido! Analisei todos os dados do seu portfólio. Estou pronto para responder suas dúvidas e fornecer sugestões personalizadas. Como posso ajudar? 🚀"})
            self.chat_sessions[session_id] = history
        
        self.chat_sessions[session_id].append({"role": "user", "content": message})
        
        response = self._model.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=4096,
            system=self._get_system_with_name(),
            messages=self.chat_sessions[session_id]
        )
        
        reply = response.content[0].text
        self.chat_sessions[session_id].append({"role": "assistant", "content": reply})
        return reply

    # ==========================================
    # PUBLIC API
    # ==========================================
    def analyze_portfolio(self, portfolio_data):
        """Generate automatic portfolio analysis."""
        if not self.is_configured():
            return {"error": "API key not configured. Acesse as Configurações (⚙️) para configurar."}
        
        context = self._build_portfolio_context(portfolio_data)
        
        try:
            if self._provider == 'gemini':
                text = self._gemini_analyze(context)
            elif self._provider == 'openai':
                text = self._openai_analyze(context)
            elif self._provider == 'anthropic':
                text = self._anthropic_analyze(context)
            else:
                return {"error": f"Provedor '{self._provider}' não suportado."}
            
            return {"analysis": text}
        except Exception as e:
            err = str(e)
            if "429" in err or "Quota" in err or "rate" in err.lower():
                return {"error": "Sem pressa! Aguarde um minuto. Você atingiu o limite de velocidade da API (Anti-Spam)."}
            return {"error": err}

    def chat(self, session_id, message, portfolio_data=None):
        """Send a chat message with portfolio context."""
        if not self.is_configured():
            return {"error": "API key not configured. Acesse as Configurações (⚙️) para configurar."}
        
        try:
            if self._provider == 'gemini':
                text = self._gemini_chat(session_id, message, portfolio_data)
            elif self._provider == 'openai':
                text = self._openai_chat(session_id, message, portfolio_data)
            elif self._provider == 'anthropic':
                text = self._anthropic_chat(session_id, message, portfolio_data)
            else:
                return {"error": f"Provedor '{self._provider}' não suportado."}
            
            return {"response": text}
        except Exception as e:
            err = str(e)
            if "429" in err or "Quota" in err or "rate" in err.lower():
                return {"error": "Aguarde um minuto! O limite da API pediu uma pausa rápida."}
            return {"error": err}

    def clear_session(self, session_id):
        """Clear a chat session."""
        if session_id in self.chat_sessions:
            del self.chat_sessions[session_id]


# Singleton instance
ai_service = AIService()

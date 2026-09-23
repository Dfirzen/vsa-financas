# Changelog — VS&A

## v5.3.2 — 23/09/2026
- Novo filtro por fundo imobiliário na tela de Proventos.
- Resumo, evolução mensal ou anual, histórico e lista de pagamentos respondem ao fundo selecionado.
- O total identifica claramente quando representa a carteira inteira ou um ticker específico.
- A lista detalhada mostra inicialmente os 20 registros mais recentes e permite expandir todos os pagamentos.


## v5.3.1 — 23/09/2026
- A barra superior do VS&A e os controles da janela permanecem visíveis durante a rolagem.
- A visão Categorias dos Fundos Imobiliários agora agrupa os ativos em Tijolo, Papel e recebíveis, Fundo de fundos, Híbrido, Desenvolvimento ou Não classificado.
- Classes gerais como Ações, ETFs e Tesouro Direto deixaram de aparecer dentro da tela de FIIs.
- A visão Foco na Construção foi preservada.


## v5.3.0 — 22/09/2026
- Nova Central de Saúde da Carteira com sinais de qualidade dos dados, concentração e renda recente.
- Distribuição por classe e contribuição positiva ou negativa de cada posição.
- Ranking dos ativos que mais pagaram proventos no histórico importado.
- Limites pessoais editáveis para concentração por ativo, concentração por classe e janela da renda média.
- Os indicadores usam apenas dados importados e deixam explícitas cotações indisponíveis ou histórico incompleto.


## v5.2.2 — 20/09/2026
- Controles de janela coloridos no canto superior direito: minimizar, maximizar, restaurar e fechar.
- Botões amarelo e verde dos modais agora controlam a janela; o vermelho fecha somente o modal.


## v5.2.1 — 20/09/2026
- Metas reorganizadas em compromisso mensal, objetivo anual e marcos de longo prazo.
- Análise Kaguya com panorama da carteira, resultado, proventos e progresso nas metas.
- Visão executiva e outras telas adaptadas a janelas menores.
- Melhorias no processamento do extrato B3, nas cotações, na proteção dos dados locais e nos cadastros manuais.
- Imposto de Renda preserva os registros como controle manual; cálculos automáticos inconsistentes foram removidos.


## Correção de cotações e benchmarks — 18/09/2026
- Brapi: fila sequencial global, um ticker por chamada, consultas duplicadas compartilhadas, tentativas com espera e tratamento explícito de atualização parcial.
- Histórico: substituída a fonte que retornava HTML de verificação; históricos vazios antigos são recuperados automaticamente.
- Visão executiva: adicionada a curva do IPCA, ao lado da carteira, CDI e Ibovespa, com indicação dos meses disponíveis.
- Atualização manual agora também renova históricos e índices; removido o log repetitivo de datas de proventos ausentes.
- Validação real de cotações, cobertura histórica dos oito ativos do extrato e nove meses de retorno, além dos testes automatizados.

## Correções locais — revisão de 18/09/2026
- Importação B3: direção de liquidações, datas Excel, validação de colunas e conciliação de extratos sobrepostos preservando operações repetidas.
- Custo médio separado de lucro realizado; rentabilidade mensal estimada incluindo vendas encerradas e proventos, com indicação de dados insuficientes.
- Metas corrigidas, histórico de conversas restaurado e painel de conversas conectado ao armazenamento.
- Chaves protegidas pelo Windows, Markdown sanitizado, sandbox habilitado e dependências locais atualizadas.
- Gráfico executivo passou a usar dados calculados; removidos índices e notas de saúde simulados.
- Testes automatizados, documentação e build local separado da publicação.

## v5.2.0 — 14/08/2026
- (preencha as novidades desta versão)


## v5.1.0 — 14/08/2026
- (preencha as novidades desta versão)



## v5.0.0 — 14/08/2026
- (preencha as novidades desta versão)


## v4.1.0 — 09/08/2026
- (preencha as novidades desta versão)


## v4.0.0 — 09/08/2026
- (preencha as novidades desta versão)


## v3.2.0 — 09/08/2026
- (preencha as novidades desta versão)


## v3.1.0 — 09/07/2026
- (preencha as novidades desta versão)


## v3.0.0 — 03/07/2026
- **Novo:** Sistema inteligente de identificação e separação de ativos especiais.
- **Novo:** Alerta proativo na aba de Resumo sobre direitos de subscrição pendentes.
- **Melhoria:** Direitos de subscrição (12), recibos (13) e frações (F) não impactam mais os cálculos de patrimônio ou rentabilidade global.
- **Visual:** Nova tabela dedicada para "Direitos e Subscrições" dentro da seção de ativos, simplificada e com badges coloridos.
- **Visual:** Modal de Raio-X inteligente que exibe alertas em vez de rentabilidade zero para recibos e frações.


## v2.0.0 — 03/07/2026
- **Novo:** Sistema de Atualização Automática (Auto-Update) integrado em background.
- **Novo:** Banner de notificação elegante não-intrusivo para informar quando uma atualização estiver sendo baixada e pronta para instalar.
- **Novo:** Opção manual de "Checar Atualizações" na aba Sobre das Configurações.
- **Melhoria:** Script de build reformulado (`Build.bat`) com publicação automática para o GitHub Releases e menu de versão.


## v1.2.3 — 30/05/2026
- (preencha as novidades desta versão)


## v1.2.2 — 23/05/2026
- (preencha as novidades desta versão)


## v1.2.1 — 18/05/2026
- Redesign completo do modal de Configurações com navegação por abas
- Nova aba **Perfil**: nome do usuário, seleção de aparência (Claro/Escuro/Sistema) e moeda padrão
- Nova aba **Extrato B3**: caminho do arquivo com file picker e card de última sincronização
- Nova aba **Inteligência Artificial**: seleção de provedor, API Key com toggle de visibilidade e status
- Nova aba **Sobre**: identidade do app, versão dinâmica, changelog e informações técnicas
- Tema de aparência agora aplica imediatamente ao clicar, sem precisar salvar
- Suporte ao tema "Sistema" — acompanha automaticamente o modo do Windows
- Toast de confirmação ao salvar configurações


## v1.2.0 — 30/04/2026
- (preencha as novidades desta versão)


## v1.1.0 — 30/04/2026
- (preencha as novidades desta versão)


## v1.0.1 — 30/04/2026
- Versionamento automático implementado
- Versão exibida no rodapé e nas configurações
- Seção "Sobre o aplicativo" adicionada às Configurações

## v1.0.0
- Versão inicial do sistema

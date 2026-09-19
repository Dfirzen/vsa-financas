# Validação do aplicativo local — 19/09/2026

## Arquitetura e privacidade

O aplicativo inicia o Electron e carrega `renderer/index.html` por arquivo local. Não inicia servidor HTTP, Flask ou Express e não exige hospedagem. O XLSX é lido localmente. Há conexões de saída para cotações, índices, calendário de proventos, IA solicitada pelo usuário e, na versão instalada, atualização pelo GitHub. Portanto, leitura e registros são locais; os serviços externos dependem de internet.

Configurações e chaves do aplicativo ficam no perfil do Electron, fora do repositório. As chaves de IA e Brapi são protegidas por `safeStorage` do Windows e mascaradas na interface. Os arquivos locais antigos `.env` e `data/` também permanecem ignorados: não foram apagados nem copiados para o instalador.

A checagem local pesquisou padrões conhecidos de tokens e chaves privadas, atribuições de credenciais, arquivos candidatos ao Git, o index e os 10 commits acessíveis. Não houve ocorrências. Isso é uma checagem por padrões, não uma garantia de detecção de qualquer segredo possível. Nada foi enviado ao GitHub nesta revisão.

Comandos disponíveis:

- `npm run check:privacy`: arquivos versionáveis e index; executado também antes do build.
- `npm run check:history`: inclui o histórico Git local.
- `npm test`: cálculos, metas, contexto da IA, persistência e serviços de mercado.
- `npm run test:electron`: importação, IPC, sandbox, credenciais protegidas, metas e análise/chat.
- `npm run test:flows`: navegação, cadastros manuais, atualização de renda fixa e controle manual de IR.
- `npm run test:responsive`: layout em 1400, 1280, 1024 e 800 pixels.

## Correções desta revisão

- Círculo de ativos deixa de encolher em apenas um eixo; cartões, cabeçalho e tabelas se adaptam à largura disponível. Textos do menu podem quebrar linha.
- Removidas as cópias inativas de `static/` e `templates/`, a dependência sem uso `yahoo-finance2` e funções antigas de cálculo tributário.
- Nomes e campos de ativos manuais são escapados antes da inserção no HTML. Tickers e valores recebem validação adicional; cadastros duplicados de um ticker na mesma classe são recusados com orientação para editar.
- Cadastros manuais e registros de IR inválidos não são sobrescritos silenciosamente. Falhas ao salvar são informadas.
- Renda fixa manual passa a permitir edição do valor atual, separada do custo investido.
- Falhas de leitura de arquivos/pastas B3 deixam de parecer sincronização bem-sucedida; importações parciais bloqueiam a série de rentabilidade.
- O filtro anual da tela de IR acompanha o seletor global. Excluir um mês respeita as classes visíveis no filtro.

## Mudança importante no Imposto de Renda

O cálculo antigo utilizava a última alíquota encontrada para grupos com classes diferentes, aplicava o limite de isenção por lançamento e possuía tratamentos inconsistentes de prejuízo e imposto pago. Esses números não eram uma apuração confiável.

Os registros existentes foram preservados. A tela agora mostra vendas, custos, resultado bruto e imposto pago informado, separados por mês e classe. DARF, isenções e saldo fiscal compensável ficam explicitamente não calculados. Uma futura apuração fiscal precisa de um módulo específico e validação tributária; não basta o extrato de movimentações atual.

## Limites da validação

Os testes de interface usam extratos e credenciais sintéticos, sem consumir a API pessoal nem alterar o perfil real. A revisão cobre os fluxos descritos e não constitui prova de ausência de qualquer bug. `npm audit` não apresentou vulnerabilidades conhecidas após a remoção da dependência sem uso.

A rentabilidade continua sendo uma aproximação mensal, sujeita à completude do extrato e dos preços. Eventos corporativos não reconhecidos exigem conciliação. Renda fixa manual usa o valor informado, sem precificação automática. Ativos manuais não entram na série histórica B3 nem no retrato da IA.

O backup do código no GitHub não inclui seus extratos, configurações, metas, conversas e cadastros locais. Para preservar também os dados pessoais, mantenha separadamente uma cópia do perfil do aplicativo e dos arquivos XLSX. Não adicione esse backup ao repositório.

## Empacotamento desta revisão

O aplicativo empacotado em `dist-review/win-unpacked/` foi conferido contra as fontes e não contém planilhas, perfil pessoal ou arquivos da interface antiga. A geração do instalador NSIS falhou duas vezes ao executar o auxiliar de desinstalação (`spawn UNKNOWN`). Portanto, não considerar um instalador desta execução como validado. O código pode ser executado por `npm start` ou pelo `VSA.exe` dentro de `win-unpacked`, mantendo a pasta inteira.

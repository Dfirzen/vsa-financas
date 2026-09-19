# VS&A — carteira pessoal a partir do extrato B3

Aplicativo Electron para ler arquivos XLSX/XLS de movimentação da B3, organizar posições, acompanhar proventos e metas e conversar com a Kaguya por API. Não envia ordens, não negocia ativos e não altera os extratos importados.

## Executar e validar

Requer Node.js compatível com as dependências do `package-lock.json` e Windows para o aplicativo distribuído.

```powershell
npm ci
npm start
npm test
npm run test:electron
npm run build
```

`npm start` e `npm run build` preparam as bibliotecas locais do renderer. Gráficos, formatação de mensagens e leitura de XLSX não dependem de CDNs. Cotações e respostas da IA precisam de internet e dos respectivos serviços.

`npm test` executa cenários determinísticos do extrato e dos cálculos. `test:electron` abre o aplicativo oculto com um perfil temporário, extrato sintético e serviços externos simulados. Verifica a ponte IPC, metas, criptografia no Windows, chat, reinício e importação. Não utiliza chaves ou dados pessoais. O perfil sintético é preservado no diretório temporário para diagnóstico; a captura fica em `test-results/smoke.png`.

`node scripts/check-market-data.cjs` é um diagnóstico **real e opcional**: utiliza o token Brapi já configurado para consultar KNSC11 e HGRE11, testa CDI/IPCA/Ibovespa e verifica a cobertura histórica do extrato local. Consome chamadas de cotação da Brapi. Não imprime chaves, não chama a IA e não altera o perfil pessoal; a cópia temporária do estado criptografado é apagada ao terminar.

## Cotações e benchmarks

- As cotações atuais continuam vindo da **Brapi**, com um ticker por chamada, fila global sequencial, intervalo entre chamadas e reaproveitamento de requisições simultâneas para o mesmo ticker. O cache dura 30 minutos; o botão de atualização força uma nova consulta.
- Limites temporários (`429`) respeitam `Retry-After`, com tentativas limitadas. Falhas preservam o preço e a data da última consulta válida; o botão informa atualização parcial e o aviso explica o motivo. Uma resposta em cache não é apresentada como consulta nova.
- O histórico de preços e o Ibovespa vêm do Yahoo Finance. O serviço anterior (Stooq) estava retornando HTML de verificação de navegador, que acabava armazenado como série vazia. Caches vazios antigos não impedem a recuperação; respostas vazias ou inválidas não substituem históricos válidos.
- CDI e IPCA vêm das séries 4390 e 433 do Banco Central. A visão executiva compara os quatro conjuntos: carteira B3, CDI, Ibovespa e IPCA. Meses ainda não publicados do IPCA permanecem sem ponto no gráfico.
- O botão de atualização também renova históricos e índices. A leitura normal usa cache diário para esses dados. `cache hit → null` era apenas o cache de uma data de provento não encontrada; essa mensagem repetitiva foi removida.

Referência dos limites da API: [Brapi — limites por plano](https://brapi.dev/faq/quais-as-limitacoes).

`npm run build` gera o instalador local, sem mudar a versão e **sem publicar**. Os aliases `build:minor` e `build:major` também fazem apenas build local. A publicação é uma operação separada e explícita: `npm run release:patch`, `release:minor` ou `release:major`. Esses comandos incrementam a versão, executam validações e publicam no GitHub configurado. Não os use para apenas testar.

## Importação e cálculos

- Configure uma pasta com os extratos de movimentação ou importe um arquivo pela interface. Prefira o histórico completo desde as primeiras aquisições, incluindo posições já vendidas.
- A aba `Movimentação` tem prioridade. São aceitas datas brasileiras, ISO e números seriais do Excel. Cabeçalhos obrigatórios são validados.
- A direção de `Transferência - Liquidação` vem de `Entrada/Saída`: crédito/entrada aumenta a posição; débito/saída diminui.
- As transações são ordenadas por data. Vendas baixam o custo médio das unidades vendidas, separando lucro realizado e custo da posição restante. Operações no mercado fracionário são consolidadas com o ticker comum.
- Extratos sobrepostos são conciliados por todos os campos, incluindo instituição e direção. Repetições legítimas no mesmo arquivo são preservadas. Sem identificador único da B3, duas operações idênticas em arquivos separados continuam sendo ambíguas: a conciliação usa a maior quantidade de ocorrências encontrada em um arquivo.
- A rentabilidade é uma **estimativa mensal Modified Dietz** dos ativos importados, incluindo proventos. O extrato de movimentação não contém todo o saldo em conta nem avaliações em cada aporte; portanto não é um TWR diário exato. O gráfico executivo usa os mesmos retornos reais calculados, nunca curvas de demonstração. Ativos manuais não entram nessa série de retorno.
- Meses sem preços históricos ou com histórico inválido ficam indisponíveis (`—`) e não viram retorno zero. O acumulado também fica indisponível quando atravessa uma lacuna. Posições sem cotação podem ser mostradas pelo custo, acompanhadas de aviso.
- O filtro anual considera posições até o fim do ano selecionado. A valorização de anos encerrados utiliza preços de dezembro, quando disponíveis.
- Eventos não reconhecidos, como certas transferências de custódia, bonificações, desdobramentos ou conversões, exigem conferência. O app avisa e bloqueia a rentabilidade em vez de inventar valores. Vendas sem compras anteriores também geram aviso. A classificação automática pode ser corrigida nas configurações.

Referência da aproximação de retorno: [GIPS — Calculation Methodology / Modified Dietz](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/). Distribuição do leitor XLSX: [SheetJS — instalação oficial](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Dados pessoais e Kaguya

A tela **Análise · Kaguya** explica panorama, resultado, proventos e metas sob demanda. O **Simulador** tem uma entrada separada e não usa IA. Abrir a tela ou o chat não gera chamadas de análise. O retrato enviado identifica o filtro, datas, custo, valorização, proventos, metas recorrentes e comparações no mesmo período; abrange somente o histórico B3 importado. A última análise fica no armazenamento local do renderer e recebe um aviso quando os dados mudam. O chat recebe esse relatório como contexto anterior, junto com os dados atuais.

A integração existente usa a API configurada no app; não conecta ainda a um servidor externo do projeto Kaguya. OpenAI permanece na interface [Chat Completions da documentação oficial](https://developers.openai.com/api/reference/resources/chat), com testes de transporte simulado para não consumir a chave pessoal durante a validação.

Configurações, metas, cache e conversas ficam no diretório `userData` do Electron. Cadastros manuais e preferências existentes continuam no armazenamento local da interface. Faça backup do perfil completo, além dos extratos originais.

As chaves da IA e da Brapi são migradas de texto simples para `safeStorage` do Electron, protegido pelo Windows. A interface recebe somente indicadores mascarados. Chaves protegidas podem não ser recuperáveis em outro usuário/computador; nesse caso será necessário reconfigurá-las. Campo de chave vazio ao salvar mantém a credencial anterior.

O chat ativo é restaurado ao reiniciar. A IA recebe o histórico recente e o contexto atualizado da carteira; respostas em Markdown são sanitizadas. A futura integração completa com o projeto Kaguya pode substituir o serviço de IA mantendo a ponte de interface em `preload.js` e `src/ipc-handlers.js`.

Não há execução de ordens no serviço de IA. A conexão real com provedores depende das chaves, modelos e disponibilidade externa; os testes locais não fazem chamadas pagas.

## Organização

- `main.js` / `preload.js`: janela, sandbox, atualização e ponte de comunicação.
- `src/ipc-handlers.js`: operações autorizadas pelo renderer e validações.
- `src/services/`: configuração protegida, IA, cotações, proventos, histórico e persistência.
- `renderer/portfolio-core.js`: importação normalizada, conciliação, custo médio e retorno, testáveis sem interface.
- `renderer/script.js`: interação e apresentação das telas existentes.
- `renderer/vendor/`: dependências geradas localmente a partir das versões travadas; não editar.
- `tests/`: cenários automatizados, sem dados reais do investidor.

As cópias antigas `static/` e `templates/` foram removidas: a interface executada é a de `renderer/`.

Veja [VALIDACAO.md](VALIDACAO.md) para o escopo dos testes, proteção do repositório e limites do controle manual de IR. Antes de enviar alterações ao GitHub, execute `npm run check:history`. Extratos e perfil pessoal precisam de backup separado do código.

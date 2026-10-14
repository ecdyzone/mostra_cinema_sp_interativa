# Mostra de Cinema de São Paulo — 2026

[Acesse o guia interativo](https://ecdyzone.github.io/mostra_cinema_sp_interativa/) para escolher e combinar sessões da [50ª Mostra de Cinema de São Paulo](https://mostra.org/), de **15 a 29 de outubro de 2026**. A página reúne horários, duração, cinemas, links oficiais e motivos para assistir aos filmes da curadoria.

A **curadoria é a visualização padrão**, com 131 títulos e 428 opções de sessão. O botão **Toda a programação** amplia a lista para as 1.373 opções das grades presenciais disponíveis. Os curtas de Pelechian são agrupados em programas: essas opções correspondem, respectivamente, a 446 e 1.391 registros individuais de filmes. Os números refletem a programação salva no projeto.

## Usar e compartilhar

Abra [index.html](index.html) diretamente no navegador ou acesse o site publicado. O HTML é autossuficiente, sem dependências externas ou arquivos de dados para carregar durante o uso.

- Escolha a data, use busca e filtros de tema e duração e marque as estrelas.
- Ative **Toda a programação** para ampliar a lista. Essa visualização começa ordenada por horário e inclui filmes com informações básicas e link oficial.
- **Minha lista do dia** reúne os favoritos das duas visualizações, inclusive os filmes fora da curadoria. Os downloads incluem todas essas escolhas do dia, independentemente dos filtros ativos.
- Abra o menu **Exportar** para escolher **Baixar minha lista** (texto), **Exportar para calendário** ou **Salvar PDF**. Abra o arquivo `.ics` no aplicativo de calendário ou importe-o no serviço que utiliza. Cada evento inclui nome, local, link, início e término estimado pela duração; os horários correspondem a São Paulo.
- Compartilhe uma data com `?dia=2026-10-24`; acrescente `&visao=todos` para abrir a programação completa. [Exemplo com os dois parâmetros](https://ecdyzone.github.io/mostra_cinema_sp_interativa/?dia=2026-10-24&visao=todos).

Os favoritos ficam no navegador. As escolhas da primeira versão de 17/10 são migradas automaticamente quando o navegador e o endereço do site são os mesmos.

A página explica o recorte da curadoria, apresenta as [quatro fontes editoriais](referencias/urls.md) e informa a abertura da compra online quatro dias antes da sessão, às 9h, com link para as regras oficiais da Mostra.

## Estrutura do repositório

Esta pasta é a raiz do repositório. Todos os comandos abaixo partem dela.

```text
.
├── index.html                   # Site e dados embutidos; arquivo atualizado pelo gerador
├── README.md                    # Uso, manutenção e curadoria
├── docs/
│   └── programacao.md           # Coleta, cache, formato e validação das grades
├── programacao_por_dia/         # Grades Markdown: 15 linhas por filme e sessão
├── referencias/
│   ├── curadoria_site.json      # Textos, justificativas, links e prioridades
│   ├── filmes-para-escolher.md  # Guia inicial com sinopses e critérios de escolha
│   ├── todos-os-filmes-citados.md # Catálogo dos títulos citados nas fontes
│   └── urls.md                  # Quatro matérias de origem
├── cache/
│   └── programacao/             # HTML original da Mostra para processamento local
└── scripts/                     # Coleta, sincronização, geração e verificações
```

O cache original é mantido no repositório para permitir reproduzir a extração e recuperar os endereços oficiais das fichas sem novos downloads. Arquivos temporários de Python e cópias de editor são ignorados pelo Git.

## Atualizar os dados e o HTML

Requisitos: **Python 3.10 ou superior** e **Node.js 18 ou superior** para as verificações do site. Os scripts usam apenas as bibliotecas padrão; não é necessário instalar pacotes.

```sh
python scripts/baixar_programacao.py --faltantes --offline
python scripts/sincronizar_curadoria.py
python scripts/gerar_site.py
node scripts/verificar_site.cjs
```

1. **Coleta:** gera os Markdown faltantes em `programacao_por_dia/` usando o HTML salvo em `cache/programacao/`. O modo `--offline` não acessa o site e preserva as grades existentes.
2. **Sincronização:** cruza as grades com o catálogo de referências, reaproveita as sinopses do guia e cadastra títulos e datas na curadoria. Preserva textos, links e prioridades existentes e informa justificativas pendentes.
3. **Geração:** atualiza os cartões e os dados em `index.html`, incluindo as duas visualizações. Filmes fora da curadoria recebem informações básicas e links oficiais.
4. **Verificação:** confere os 15 dias, as justificativas da curadoria, as duas visualizações, filtros, ordenação, favoritos e exportações.

Se todas as grades estiverem prontas, comece pela sincronização. Para atualizar o HTML após editar apenas a curadoria, execute a geração e a verificação. O HTML também contém o CSS e o JavaScript da interface: mantenha-o ao atualizar os dados.

Para acrescentar ou revisar grades, siga o [guia de coleta](docs/programacao.md). Um único HTML salvo contém a programação de vários dias em `window.__NUXT__` e pode atender a todo o período sem novas requisições. O cache registra a programação no momento do download; atualizações no site oficial exigem uma nova coleta.

## Ajustar a curadoria

Edite [referencias/curadoria_site.json](referencias/curadoria_site.json):

- `summary`: descrição curta do filme.
- `why`: justificativa que ajude a decidir, indicando temas, proposta ou um diferencial.
- `award`, `tags` e `url`: premiações, categorias e link oficial.
- `days`: datas ISO associadas a prioridades; `1` a `98` marca destaque e `99` mantém o filme entre as outras opções da curadoria.
- `default_priority`: preferência para sugestões em dias novos; números menores têm prioridade e `null` não sugere destaque.

**Todo título da curadoria precisa ter um `why`.** A sincronização preserva os textos existentes e aproveita o trecho “Vale ver se” do guia ao cadastrar um título novo. Quando não encontra esse trecho, deixa a justificativa para preenchimento editorial. O gerador recusa campos ausentes, vazios ou contendo apenas espaços e preserva o HTML anterior até a correção. Filmes fora da curadoria podem continuar sem justificativa.

Os textos se baseiam nas sinopses, nos temas das fichas oficiais salvas no cache e nas premiações das referências; não são críticas escritas após assistir aos filmes. O catálogo da curadoria é um recorte das quatro matérias de origem. A visualização completa inclui títulos das grades que não aparecem nessas matérias.

Em dias novos, a sincronização sugere até 12 títulos com prioridade geral, baseada nas escolhas iniciais do guia, nos destaques de dias anteriores e nos filmes com sinopse. Programas restaurados de Pelechian também recebem destaque. Um título com várias sessões pode aparecer em vários cartões. Essas sugestões são um ponto de partida editável.

Os filmes de Pelechian com o mesmo dia, horário e sala são apresentados como um programa, com links individuais e duração calculada pela soma dos filmes. As grades podem ter posições diferentes para linhas vazias; o gerador valida e lê os campos preenchidos.

## Verificar as alterações

```sh
python -m unittest discover -s scripts -p 'test_*.py'
node scripts/verificar_site.cjs
```

Os testes Python verificam extração, cache, preservação das grades, justificativas obrigatórias e proteção do HTML anterior quando faltam dados. A comparação com as páginas reais usa os HTMLs em `cache/programacao/`; sem cache, essa parte é marcada como não executada.

A verificação Node.js exercita a lógica da interface e as exportações com um DOM simulado. Confere fuso, duração, virada de dia, identificadores estáveis e UTF-8 do calendário, além dos programas de Pelechian. Algumas verificações usam sessões conhecidas; revise-as se alterar o período ou essas seleções. Não substitui uma revisão visual no navegador.

## Publicação

O GitHub Pages serve o [index.html](index.html) da raiz deste repositório. As alterações dos scripts são locais; para publicá-las, envie os arquivos atualizados ao repositório e mantenha o Pages configurado para a raiz da branch de publicação. Não há etapa de build nem pasta `github/` adicional dentro do projeto.

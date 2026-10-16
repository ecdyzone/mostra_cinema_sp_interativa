# Instruções para trabalhar neste repositório

## Começar uma nova sessão

Esta pasta é a raiz Git do projeto. Abra o Codex aqui e execute os comandos daqui. O nome `github/` vem da organização antiga do workspace: **não acrescente outro `github/` aos caminhos**. O site fica em `index.html` na raiz.

Leia [README.md](README.md) para uso e manutenção. Consulte [docs/programacao.md](docs/programacao.md) quando precisar coletar ou interpretar a programação. Todo o material necessário está neste repositório; não é preciso recuperar conversas anteriores nem arquivos da pasta pai.

Antes de editar, confira `git status --short` e preserve alterações existentes do usuário. Responda em português brasileiro e mantenha os textos públicos diretos, compreensíveis por qualquer pessoa e sem referências a arquivos locais.

## Objetivo e arquitetura

Guia independente para escolher sessões da 50ª Mostra de Cinema de São Paulo, de 15 a 29/10/2026.

- Site publicado: <https://ecdyzone.github.io/mostra_cinema_sp_interativa/>.
- `index.html`: página autossuficiente com HTML, CSS, JavaScript e dados embutidos. Deve funcionar ao abrir o arquivo no navegador, sem servidor, bibliotecas externas ou requisições de dados.
- `referencias/curadoria_site.json`: fonte dos textos editoriais, justificativas, prêmios, links e prioridades.
- `referencias/urls.md`: quatro matérias que originaram a curadoria.
- `referencias/todos-os-filmes-citados.md`: catálogo dos títulos citados nessas matérias.
- `referencias/filmes-para-escolher.md`: guia inicial com sinopses e critérios de escolha.
- `programacao_por_dia/`: grades presenciais, com um bloco de **15 linhas por filme e sessão**. Preserve as linhas vazias; os scripts validam esse formato.
- `cache/programacao/`: HTML original da Mostra. Preserve o cache: permite extração offline, comparação com as grades e recuperação dos endereços oficiais das fichas.
- `scripts/`: ferramentas Python e verificação Node.js; sem dependências de terceiros.
- `transferir-favoritos/index.html`: cópia da página auxiliar publicada na raiz do repositório `ecdyzone/mostra-transferir-favoritos`, em `https://ecdyzone.github.io/mostra-transferir-favoritos/`, sem domínio personalizado. Veja `docs/migracao-favoritos.md`.

Requisitos documentados: Python 3.10+ e Node.js 18+.

## Fluxo de manutenção

Quando as grades já existem:

```sh
python scripts/sincronizar_curadoria.py
python scripts/gerar_site.py
```

Para gerar grades faltantes usando o cache, antes da sincronização:

```sh
python scripts/baixar_programacao.py --faltantes --offline
```

Depois de editar apenas os textos da curadoria, basta executar o gerador. Ao alterar a interface, edite o CSS/JavaScript/estrutura de `index.html` e, quando pertinente, o HTML dos cartões em `render_card` de `scripts/gerar_site.py`.

**O gerador usa o próprio `index.html` como base.** Ele substitui os cartões, `const films` e elementos derivados das datas; não recria a página do zero. Não remova o arquivo nem altere isoladamente os textos ou dados gerados: essas alterações seriam sobrescritas. Preserve os IDs e marcadores usados pelas expressões regulares do gerador, ou atualize o gerador junto.

O arquivo contém uma linha muito grande com `const films`. Evite imprimir essa linha inteira em buscas e leituras: leia trechos delimitados da interface ou extraia o JSON com um script.

## Curadoria e integridade editorial

- A curadoria é a visualização padrão. `Toda a programação` amplia a lista para todas as sessões presenciais das grades locais.
- Todo título em `curadoria_site.json` precisa de `why` com uma justificativa útil: temas, proposta ou diferencial que ajude a escolher. O gerador rejeita campos ausentes, vazios ou só com espaços antes de substituir o HTML.
- Use sinopses, temas das fichas oficiais e premiações verificadas para escrever os textos. As justificativas não pressupõem que os filmes foram assistidos. Não invente enredos, prêmios ou avaliações.
- Filmes fora da curadoria podem ter apenas informações básicas, sem `why`, sinopse editorial ou premiação.
- `days` associa datas ISO a prioridades: `1`–`98` indica destaque; `99` inclui o filme sem destaque. `default_priority` orienta novos dias: menor número tem preferência; `null` não sugere destaque.
- A sincronização preserva textos, links e prioridades já definidos. Para novos títulos, aproveita o trecho “Vale ver se” do guia quando disponível; justificativas restantes exigem preenchimento editorial.
- Preserve os links oficiais individuais. Os slugs reais das fichas podem diferir do slug calculado pelo título; o cache fornece esses endereços.
- Curtas de Artavazd Pelechian com o mesmo dia, horário e sala são agrupados em programas com links individuais e duração somada. Preserve esse agrupamento.

## Comportamentos da interface a preservar

- Favoritos são sessões específicas, persistidas em `localStorage`. Preserve IDs estáveis, `legacyId` e a migração dos favoritos da primeira versão de 17/10.
- Importações por TXT ou transferência acrescentam sessões sem apagar escolhas existentes e só confirmam sucesso após persistir. A recuperação automática temporária é controlada por `AUTO_RECOVER_FAVORITES`; só ative após verificar a publicação da página auxiliar na origem antiga. A opção manual e a importação de TXT continuam disponíveis após desativar a automação.
- `Minha lista do dia`, TXT e calendário incluem todos os favoritos daquele dia nas duas visualizações, inclusive os ocultos pela busca ou filtros.
- `?dia=2026-10-24` seleciona uma data; `&visao=todos` abre a programação completa, inicialmente ordenada por horário.
- Use o texto **Exportar para calendário**, acessível a pessoas sem conhecimento de ICS. Eventos usam horários de São Paulo e término estimado pela duração; mantenha a conversão de fuso, UTF-8, escape e quebra de linhas do formato ICS.
- Mantenha local, duração e link oficial em cada opção. A página deve explicar o recorte da curadoria e citar as fontes, sem sugerir que a seleção editorial representa todo o festival.

## Coleta e uso da rede

Priorize o cache e evite downloads redundantes. O HTML salvo de 17/10 contém `window.__NUXT__` com sessões de várias datas e atende aos 15 dias do período. Uma página aparentemente vazia no `curl` pode conter todos os dados embutidos.

`scripts/mostra_nuxt.py` interpreta um subconjunto restrito da serialização: não executa JavaScript baixado nem usa `eval`. O campo `sinopse` observado nesse cache contém um marcador (`'1'`), não texto utilizável como sinopse.

Novas requisições são possíveis quando faltarem informações. Para atualizar grades, siga o guia de coleta: o cache é uma fotografia histórica; `--sobrescrever` substitui Markdown, mas não atualiza o HTML em cache. Preserve os originais e o intervalo entre downloads. Não substitua páginas reais por amostras sintéticas.

## Verificação

Após alterações em dados, geração ou comportamento:

```sh
python -m unittest discover -s scripts -p 'test_*.py'
node scripts/verificar_site.cjs
git diff --check
```

Os testes Python cobrem extração, cache, preservação de arquivos e justificativas obrigatórias. As comparações reais dependem do cache. A verificação Node.js usa um DOM simulado e cobre os 15 dias, visualizações, filtros, favoritos, TXT e ICS; **não é um teste visual em navegador**. Algumas asserções usam sessões conhecidas e precisam ser revistas se essas seleções mudarem.

Referência após a organização de 14/10/2026: 131 títulos com `why`, 428 opções na curadoria e 1.373 na programação completa; 15 testes Python e verificação Node.js passando. As opções agrupam curtas de Pelechian, por isso diferem dos 446 e 1.391 registros individuais de filmes. Recalcule se os dados mudarem.

Atualize a documentação quando mudar caminhos, comandos ou regras. O GitHub Pages publica o `index.html` da raiz; não há build. Gerar o HTML localmente não publica alterações.

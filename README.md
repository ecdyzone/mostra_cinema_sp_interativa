Acesse o site interativo: https://ecdyzone.github.io/mostra_cinema_sp_interativa/

---

Protótipo para tornar a escolha de filmes da mostra de cinema de são paulo mais fácil e interativa.

https://mostra.org/

Agora há seleções para **todos os dias de 15 a 29 de outubro de 2026**, com horários, duração, cinemas e links oficiais. O seletor de dia atualiza a lista, os destaques e os favoritos. A lista para download contém apenas as escolhas do dia selecionado.

Marque as estrelas e use **Exportar para calendário** para baixar as sessões escolhidas no dia em formato `.ics`. Abra o arquivo no aplicativo de calendário ou importe-o pelas configurações do serviço. Cada evento inclui nome, local, link, início e término estimado pela duração do filme; os horários correspondem a São Paulo. O download em texto continua disponível.

A página explica o recorte da curadoria, apresenta as quatro fontes de `urls.md` e informa a abertura da venda online de ingressos avulsos quatro dias antes da sessão, às 9h, conforme as regras oficiais da Mostra.

A **curadoria é o padrão**, com 428 opções correspondentes a 446 sessões de filmes. O botão **Toda a programação** amplia a lista para todas as sessões presenciais das grades de 15 a 29/10: são 1.373 opções, correspondentes a 1.391 registros de filmes. Os curtas de Pelechian são agrupados em programas nas duas visualizações.

Ao abrir a programação completa, a ordenação começa por horário. Busca, temas e duração continuam disponíveis. **Minha lista do dia** e os downloads reúnem as estrelas marcadas nas duas visualizações, inclusive os filmes fora da curadoria.

É possível compartilhar um dia diretamente pelo parâmetro `?dia=2026-10-24` na URL. Para abrir a programação completa, acrescente `&visao=todos`. Os favoritos da versão anterior de 17/10 são migrados automaticamente no mesmo navegador e endereço do site.

## Atualizar a seleção

A coleta das grades pode ser automatizada com `scripts/baixar_programacao.py`. Consulte o [guia de download e extração](../scripts/README-programacao.md) para reutilizar o cache e gerar os dias faltantes sem novas requisições quando a grade completa já estiver no HTML.

O HTML continua autossuficiente: não precisa carregar arquivos de dados para funcionar. Para acrescentar dias, na raiz do projeto:

1. Salve a programação em `programacao_por_dia/`, com um bloco de 15 linhas por filme, seguindo as grades existentes.
2. Execute `python scripts/sincronizar_curadoria.py`. O script cruza as grades com `referencias/todos-os-filmes-citados.md`, reaproveita as sinopses de `referencias/filmes-para-escolher.md` e cadastra as datas em `referencias/curadoria_site.json`, sem acessar a rede. Textos, links e prioridades já definidos são preservados.
3. Execute `python scripts/gerar_site.py` para atualizar os cartões e os dados em `github/index.html`. O gerador inclui todas as sessões das grades e identifica quais pertencem à curadoria; os filmes restantes recebem dados básicos e links, sem sinopses ou prêmios presumidos.
4. Execute `node scripts/verificar_site.cjs` para verificar os 15 dias nas duas visualizações, filtros por tema, ordenação, favoritos, exportações em texto e calendário e os programas de Pelechian. A verificação do calendário cobre fuso, duração, virada de dia, identificadores estáveis e codificação de caracteres. Algumas verificações de conteúdo usam sessões conhecidas; atualize-as se mudar essas seleções.

Depois de gerar novas grades, o fluxo habitual é:

```sh
python scripts/sincronizar_curadoria.py
python scripts/gerar_site.py
node scripts/verificar_site.cjs
```

Para ajustar a seleção, edite `referencias/curadoria_site.json`: `days` associa datas ISO a prioridades. Números de `1` a `98` marcam destaques e `99` deixa o filme nas outras opções. `default_priority` orienta os destaques de dias ainda não configurados; um número menor tem preferência e `null` não sugere destaque.

Em dias novos, a sincronização seleciona até 12 títulos com prioridade geral, baseada nas escolhas iniciais do guia, nos destaques de dias anteriores e nos filmes com sinopse. Programas restaurados de Pelechian também recebem destaque. Um título com mais de uma sessão pode aparecer em vários cartões. Isso é um ponto de partida editável, não uma nova avaliação crítica dos filmes.

Os filmes de Pelechian no mesmo dia, horário e sala são apresentados como um programa, com links individuais e duração calculada pela soma dos filmes. As grades podem usar posições diferentes para linhas vazias; o gerador valida e lê os campos preenchidos.

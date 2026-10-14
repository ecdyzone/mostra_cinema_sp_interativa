Acesse o site interativo: https://ecdyzone.github.io/mostra_cinema_sp_interativa/

---

Protótipo para tornar a escolha de filmes da mostra de cinema de são paulo mais fácil e interativa.

https://mostra.org/

Agora há seleções para **17, 23, 24 e 25 de outubro de 2026**, com horários, duração, cinemas e links oficiais. O seletor de dia atualiza a lista, os destaques e os favoritos. A lista para download contém apenas as escolhas do dia selecionado.

Marque as estrelas e use **Exportar para calendário** para baixar as sessões escolhidas no dia em formato `.ics`. Abra o arquivo no aplicativo de calendário ou importe-o pelas configurações do serviço. Cada evento inclui nome, local, link, início e término estimado pela duração do filme; os horários correspondem a São Paulo. O download em texto continua disponível.

A página explica o recorte da curadoria, apresenta as quatro fontes de `urls.md` e informa a abertura da venda online de ingressos avulsos quatro dias antes da sessão, às 9h, conforme as regras oficiais da Mostra.

São 24 opções em 17/10, 30 em 23/10, 32 em 24/10 e 27 em 25/10. O recorte reúne os filmes das grades que aparecem nas referências e na curadoria, com 10 destaques em 17/10 e 12 em cada um dos outros dias.

É possível compartilhar um dia diretamente pelo parâmetro `?dia=2026-10-24` na URL. Os favoritos da versão anterior de 17/10 são migrados automaticamente no mesmo navegador e endereço do site.

## Atualizar a seleção

O HTML continua autossuficiente: não precisa carregar arquivos de dados para funcionar. Para acrescentar dias, na raiz do projeto:

1. Salve a programação em `programacao_por_dia/`, com um bloco de 15 linhas por filme, seguindo as grades existentes.
2. Edite `referencias/curadoria_site.json`: cada filme tem descrição, temas, URL e um objeto `days` que associa datas ISO a prioridades. Use `1` a `98` para destaques e `99` para outras opções. Horários, locais, direção e duração vêm da grade do dia.
3. Execute `python scripts/gerar_site.py` para atualizar os cartões e os dados em `github/index.html`.
4. Execute `node scripts/verificar_site.cjs` para verificar os quatro dias, filtros por tema, favoritos, exportações em texto e calendário e os dois programas de Pelechian. A verificação do calendário cobre fuso, duração, virada de dia, identificadores estáveis e codificação de caracteres. As contagens desse teste correspondem às seleções atuais; atualize-as se mudar o conteúdo.

Os filmes de Pelechian no mesmo dia, horário e sala são apresentados como um programa, com links individuais e duração calculada pela soma dos filmes. As grades podem usar posições diferentes para linhas vazias; o gerador valida e lê os campos preenchidos.

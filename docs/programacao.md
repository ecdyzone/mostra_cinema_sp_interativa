# Baixar e extrair a programação da Mostra

## O que foi descoberto

O HTML obtido por `curl` parece vazio porque a interface é montada com JavaScript. Mas o arquivo contém os dados: um bloco `window.__NUXT__` usado para inicializar a página.

No HTML de 17/10 salvo em `cache/programacao/2026-10-17.html`, esse bloco contém **1.409 registros de sessões de várias datas**, dos quais **1.391 pertencem ao período de 15 a 29/10/2026**. O parâmetro `?data=17%2F10` escolhe o dia inicialmente mostrado; não limita a grade embutida no arquivo a esse dia.

Assim, **o único HTML recebido já bastou para testar os dois dias e extrair todo o período**, sem precisar baixar uma segunda página. A pasta de cache guarda o HTML original, não uma reconstrução do conteúdo.

## Como o script extrai os filmes

O [baixar_programacao.py](../scripts/baixar_programacao.py) faz o download, administra o cache e grava os Markdown. O [mostra_nuxt.py](../scripts/mostra_nuxt.py) lê o bloco de dados embutido.

1. O leitor encontra `window.__NUXT__` dentro de uma tag `<script>`.
2. A serialização Nuxt usa nomes curtos como referências a valores, além de arrays preenchidos por índice. O leitor reconstrói somente esses dados, reconhecendo um conjunto restrito de literais e atribuições. **Não usa `eval`, não executa JavaScript baixado e não abre navegador.**
3. Dentro do estado reconstruído, encontra `apiDataPresencial`, a lista de sessões presenciais.
4. Filtra `pro_data` pela data solicitada e ordena por horário, preservando a ordem original em empates.
5. Confere os campos e gera um bloco de **15 linhas por sessão**, compatível com o gerador do site.

| Campo no HTML | Uso no Markdown |
| --- | --- |
| `titulo` | Nome do filme, repetido nas posições esperadas pelo formato existente |
| `secao` e `secao_sec` | Seções da Mostra |
| `diretores` | Direção |
| `pais` | Países |
| `genero` | Ficção, documentário, animação etc. |
| `duracao` | Duração em minutos, normalizada como `96 min.` |
| `pro_data` | Data no formato `DD/MM/2026` |
| `pro_hora` | Horário no formato `HH:MM` |
| `pro_sala` | Cinema e sala |

Os filmes de um programa de curtas continuam como registros individuais na grade. O agrupamento de Pelechian acontece depois, no gerador do site.

## Rodar agora, sem acessar o site

Os comandos podem ser executados na raiz do projeto. É necessário apenas Python 3; não há pacotes adicionais para instalar.

Para repetir a conversão de 17 e 24/10 em uma pasta de teste, preservando seus Markdown manuais:

```sh
python scripts/baixar_programacao.py --dias 17 24 --offline --saida /tmp/mostra-validacao
```

Para preencher os **dias faltantes de 15 a 29**, reutilizando o HTML já salvo:

```sh
python scripts/baixar_programacao.py --faltantes --offline
```

Esse segundo comando cria os arquivos faltantes em `programacao_por_dia/`. Os Markdown que já existem são preservados. Com o cache validado nesta sessão, **nenhuma nova requisição é necessária**.

O script imprime `CACHE`, `PULOU` e `GEROU` para mostrar o que aconteceu. No fim, informa quantas páginas baixou naquela execução.

## Baixar páginas quando não houver cache

Para baixar apenas duas páginas, sem gerar Markdown:

```sh
python scripts/baixar_programacao.py --dias 17 24 --somente-baixar
```

Os arquivos ficam em `cache/programacao/2026-10-17.html` e `cache/programacao/2026-10-24.html`. Um HTML já existente é reutilizado; repetir o comando não o baixa novamente.

Para processar dias faltantes permitindo download apenas se nenhum HTML do cache contiver a data:

```sh
python scripts/baixar_programacao.py --faltantes
```

O intervalo mínimo entre downloads é de dois segundos. Pode ser aumentado:

```sh
python scripts/baixar_programacao.py --dias 17 24 --somente-baixar --intervalo 5
```

O script não baixa cartazes, arquivos JavaScript, fichas individuais ou outras páginas. Não faz tentativas automáticas adicionais quando um download falha.

## Preservação dos arquivos e atualização

- Markdown existente é ignorado por padrão. Para regenerar conscientemente um dia, use `--dias 17 --sobrescrever --offline`.
- `--sobrescrever` permite substituir o Markdown, mas **não atualiza o cache**.
- Para consultar uma grade mais recente, mova os HTMLs antigos para fora de `cache/programacao/` ou para uma subpasta, e baixe uma página novamente. O cache é uma fotografia da programação no momento do download.
- Se não encontrar a data, detectar campos incompletos, sessões duplicadas ou uma estrutura Nuxt desconhecida, o script informa erro. Não grava um Markdown vazio ou parcialmente extraído para o dia com problema.
- Se ocorrer um erro durante uma execução com vários dias, os dias concluídos anteriormente permanecem salvos. Uma nova execução pula os Markdown que já existem.
- `--cache CAMINHO` e `--saida CAMINHO` permitem escolher outras pastas.

## Como foi validado

Sem novas requisições ao site:

- Comparação de **86 sessões de 17/10** e **102 de 24/10** com os Markdown manuais, incluindo título, seção, direção, países, tipo, duração, data, horário e sala. Todos os valores conferiram; só foi normalizado o ponto final de algumas durações.
- Validação dos campos de todas as datas entre 15 e 29 no mesmo HTML.
- Testes de cache reutilizado entre datas, preservação de Markdown existente, modo offline, intervalo entre downloads e rejeição de conteúdo inesperado.
- A duração `96'`, encontrada na grade, também é reconhecida como 96 minutos.

Para executar os testes:

```sh
python -m unittest discover -s scripts -p 'test_baixar_programacao.py' -v
```

Os testes não acessam a rede. Os testes com páginas reais são executados quando existem HTMLs em `cache/programacao/`; sem esses arquivos, essa parte é marcada como não executada. As amostras sintéticas dos testes são identificadas como tal.

## Relação com o site interativo

Este script preenche a **grade completa por dia**. Para integrar essas grades ao recorte do site, execute:

```sh
python scripts/sincronizar_curadoria.py
python scripts/gerar_site.py
node scripts/verificar_site.cjs
```

A sincronização cadastra os filmes reconhecidos nas referências e suas datas, reaproveita as descrições existentes e preserva as prioridades já configuradas. O gerador atualiza o HTML com a curadoria como padrão e um botão para ver toda a programação presencial das grades disponíveis. Filmes fora da curadoria recebem informações básicas e links oficiais, sem sinopses presumidas. Ambos trabalham localmente, sem novas requisições ao site da Mostra.

Para ajustar os destaques, edite `days` em `referencias/curadoria_site.json` e gere o HTML novamente. As regras de sugestões automáticas para dias novos estão no [README do projeto](../README.md#ajustar-a-curadoria).

A extração é específica da estrutura observada da Mostra de 2026. Caso o site mude sua serialização, o leitor pode precisar de ajuste; ele prefere interromper a conversão a adivinhar campos.

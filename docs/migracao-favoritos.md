# Migração de favoritos

O navegador mantém favoritos separados por origem. O site em `https://mostrasp.com.br` não lê diretamente o armazenamento de `https://ecdyzone.github.io`. A página auxiliar faz a leitura na origem antiga e retorna ao domínio novo com os identificadores no fragmento da URL. Não há servidor de favoritos nem envio dessas escolhas ao servidor.

## Publicar a página auxiliar

1. Na conta **ecdyzone**, usar o repositório **mostra-transferir-favoritos** (já publicado).
2. Copiar o conteúdo de [transferir-favoritos/index.html](../transferir-favoritos/index.html) para um arquivo `index.html` na raiz desse novo repositório. Não copiar o `CNAME` do site principal.
3. Publicar pelo GitHub Pages, usando a raiz da branch de publicação.
4. Manter **Custom domain vazio** nesse repositório. A página precisa abrir em `https://ecdyzone.github.io/mostra-transferir-favoritos/`. Se houver redirecionamento herdado de um site de usuário, resolver isso antes de ativar a migração; servir a página no domínio novo não permite ler os dados antigos.
5. Publicar o site principal atualizado em `https://mostrasp.com.br` e testar a opção **Importar favoritos → Recuperar do endereço antigo** com o mesmo navegador e perfil usados no endereço anterior.

A auxiliar verifica a origem antes de ler os dados. Publicá-la apenas como subpasta do site com domínio próprio não atende ao requisito: é necessário que responda na origem `https://ecdyzone.github.io`.

## Configuração da recuperação automática

A página auxiliar foi verificada em 16/10/2026: HTTP 200, sem redirecionamento para outro domínio, com conteúdo idêntico à cópia deste projeto. O código local do repositório independente está em `/home/camu/code/mostra-transferir-favoritos`. A verificação de `https://mostrasp.com.br/` encontrou um certificado que não corresponde ao domínio (curl, erro 60). A recuperação automática permanece desativada até o HTTPS do destino estar válido.

No JavaScript de `index.html` do site principal, alterar:

```js
const AUTO_RECOVER_FAVORITES = false;
```

para:

```js
const AUTO_RECOVER_FAVORITES = true;
```

Publicar a alteração depois de verificar a página auxiliar e confirmar que `https://mostrasp.com.br/` abre com certificado válido. O fluxo automático só roda em `https://mostrasp.com.br`, uma vez por navegador e perfil. Abrir o HTML localmente ou usar o endereço antigo não inicia esse fluxo.

A chave `mostra-migracao-2026-v1` registra a tentativa antes de navegar. Um retorno bem-sucedido marca `done`. Tentativas interrompidas ou com erro oferecem nova tentativa manual, sem repetir redirecionamentos automaticamente. Limpar os dados do site permite uma nova tentativa automática. Se o armazenamento estiver bloqueado, não iniciar navegação automática.

A transferência preserva os parâmetros `dia` e `visao`, retorna somente ao domínio fixo `https://mostrasp.com.br/` e une os favoritos às escolhas atuais. O fragmento é removido após salvar com sucesso; se a gravação falhar, fica disponível para tentar novamente recarregando após liberar o armazenamento. Dados antigos não são removidos. A chave atual de favoritos tem preferência sobre a primeira versão de 17/10, evitando recuperar escolhas legadas que a pessoa já havia desmarcado.

## Desativar após o período de migração

Voltar `AUTO_RECOVER_FAVORITES` para `false` e publicar. Os favoritos recuperados permanecem salvos. A importação de TXT, a recuperação manual e o processamento de retornos já iniciados continuam funcionando.

Manter o repositório auxiliar publicado por mais tempo para quem voltar posteriormente. A automação alcança apenas visitantes durante o período ativo; não há contagem central de pessoas migradas.

## Importação por TXT

**Importar favoritos → Importar arquivo TXT** aceita o formato diário e o completo já exportados pelo site. O arquivo é lido localmente, com limite de 1 MB. Data, horário, título e cinema precisam identificar uma sessão única; acentos, caixa e espaços são normalizados. Entradas desconhecidas ou ambíguas não são importadas. Duplicatas não criam novas escolhas, e favoritos existentes são preservados.

As entradas de programas de Pelechian são identificadas pelo título do programa e sua sessão; os links dos curtas no corpo do TXT não viram favoritos separados. TXT editados sem data ou cinema não permitem recuperar a sessão com segurança. A importação permanece disponível depois da desativação da recuperação automática.

## Verificação

```sh
python -m unittest discover -s scripts -p 'test_*.py'
node scripts/verificar_site.cjs
git diff --check
```

Antes de ativar a automação em produção, conferir no navegador:

1. No domínio novo, recuperar escolhas conhecidas pelo menu e conferir sessões de diferentes dias.
2. Confirmar preservação das escolhas já feitas no domínio novo e das escolhas na origem antiga.
3. Ativar a automação e abrir com os dados do domínio novo limpos, mantendo os dados da origem antiga. Confirmar uma única ida e volta e preservação de `dia` e `visao`.
4. Reabrir: não deve haver outra navegação automática.
5. Conferir uma lista TXT diária e uma completa, inclusive em dispositivo móvel.

Os testes Node.js usam DOM e origens simulados; não verificam DNS, certificado, redirecionamento do GitHub Pages ou restrições específicas de navegadores.

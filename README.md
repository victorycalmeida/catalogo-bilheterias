# Top 200 Bilheterias no Streaming (Brasil)

Lista as 200 maiores bilheterias mundiais da história (segundo o TMDB) e mostra onde cada uma está disponível **no Brasil**: assinatura, aluguel ou compra. Os dados são atualizados todo dia às 06:00 (horário de Brasília) por um workflow do GitHub Actions e publicados no GitHub Pages.

## Como funciona

- `scripts/atualizar.js` consulta a API do TMDB e grava `site/dados.json`. Se algo falhar, o arquivo anterior é mantido.
- `site/` é uma página estática (HTML/CSS/JS puro) que só lê o `dados.json`. O token nunca vai para a página.
- `.github/workflows/atualizar.yml` roda o script diariamente, faz o commit do `dados.json` e publica `site/`.

## Configuração (uma vez)

1. **Token do TMDB:** em themoviedb.org, entre em *Configurações → API* e copie o **API Read Access Token** (o token longo, não a "API Key").
2. **Repositório:** crie um repositório **público** no GitHub (o Pages gratuito exige isso; só o token fica secreto). Depois, nesta pasta:
   ```bash
   git checkout main
   git remote add origin https://github.com/<seu-usuario>/<repositorio>.git
   git push -u origin main
   ```
3. **Segredo:** no repositório, *Settings → Secrets and variables → Actions → New repository secret*. Nome `TMDB_TOKEN`, valor: o token do passo 1.
4. **Pages:** *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
5. **Primeira atualização:** *Actions → Atualizar e publicar → Run workflow*. Quando ficar verde, a lista estará em `https://<seu-usuario>.github.io/<repositorio>/`.

Para atualizar fora do horário, use o mesmo botão **Run workflow**. Se a atualização passar de 3 dias sem rodar, a página mostra um aviso.

## Rodar localmente

Requer Node 20 ou mais recente, sem dependências.

```bash
npm test                                  # testes
TMDB_TOKEN=seu_token npm run atualizar    # gera site/dados.json
npx --yes serve site                      # abre a página em http://localhost:3000
```

## Observações

- A bilheteria vem do TMDB (dados da comunidade, valores nominais). A ordem no fim da lista pode diferir de listas oficiais.
- Uso pessoal e não comercial, conforme os termos do TMDB.

## Créditos

Dados de streaming: [JustWatch](https://www.justwatch.com). Filmes: [TMDB](https://www.themoviedb.org).
This product uses the TMDB API but is not endorsed or certified by TMDB.

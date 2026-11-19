# Catálogo: Top 200 Bilheterias no Streaming (Brasil) — Design

Data: 2026-11-19

## Intenção

App de uso pessoal que responde: "das 200 maiores bilheterias mundiais da história, quais posso assistir hoje no Brasil, e onde?". Precisa abrir no celular (e no PC) sem instalar nada.

## Objetivos

- Listar os 200 filmes de maior bilheteria mundial, na ordem do ranking.
- Para cada filme, mostrar onde está disponível no Brasil, separado em **Assinatura**, **Aluguel** e **Compra** (todos os serviços).
- Filtros: ligar/desligar cada tipo; escolher um serviço específico; mostrar/esconder filmes indisponíveis (escondidos por padrão).
- Dados atualizados automaticamente uma vez por dia, com a data da última atualização visível.
- Acessível pelo celular via URL.

## Não-objetivos

- Disponibilidade "grátis com anúncios" (`ads`/`free`) — fora.
- Outros países além do Brasil.
- Séries de TV.
- Contas de usuário, favoritos, "já assisti".
- Correção de bilheteria pela inflação.
- Link direto para dentro do app de cada streaming (a API não fornece).
- Uso comercial.

## Anti-objetivos (falharia mesmo funcionando)

- Chave/token do TMDB visível na página publicada ou no repositório.
- Mostrar dados velhos sem deixar claro de quando são.
- Uma falha de atualização apagar ou esvaziar a lista que já estava publicada.

## Restrições

- Fonte única: API do TMDB (v3), autenticada com o *API Read Access Token* (Bearer).
- Dados de disponibilidade vêm do JustWatch via TMDB; a licença exige creditar JustWatch e TMDB na página.
- Uso não comercial (licença gratuita do TMDB).
- GitHub Pages gratuito exige repositório público — tudo publicado (código e `dados.json`) é público; só o token fica em segredo.

## Abordagens consideradas

| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| A | Página HTML única chamando o TMDB direto do navegador, cache no `localStorage` | Mais simples, mas só no PC; hospedar exporia a chave | Descartada |
| **B** | **Script gera `dados.json` diariamente; página estática só lê o JSON** | Mais peças (agendamento, hospedagem), mas abre no celular e a chave nunca vai para a página | **Escolhida pelo usuário** |
| C | App completo (React/Next ou mobile) | Estrutura demais para 200 filmes e uso pessoal | Descartada |

## Como funciona

### Peças

```
GitHub Actions (diário + manual)
   └─ node scripts/atualizar.js  ──(TMDB API)──▶  site/dados.json  ──commit──▶  repo
GitHub Pages serve /site  ──▶  index.html lê dados.json  ──▶  você no celular/PC
```

### 1. Script de atualização (`scripts/atualizar.js`)

- Node 20+, sem dependências (usa `fetch` nativo). *(Decisão minha: zero instalação, roda igual no Actions e no PC.)*
- Token lido de `process.env.TMDB_TOKEN`.
- **Ranking:** `GET /discover/movie?sort_by=revenue.desc&include_adult=false&page=1..10` → 200 IDs na ordem. Remove duplicados entre páginas; se faltar filme, busca a página 11 em diante até completar 200.
  - Ressalva aceita pelo usuário: a bilheteria do TMDB é mantida pela comunidade e é nominal; o fim da lista pode divergir de listas oficiais (Box Office Mojo).
- **Detalhes + disponibilidade (1 chamada por filme):** `GET /movie/{id}?language=pt-BR&append_to_response=watch/providers`
  - Usa: `title` (pt-BR), `original_title`, `release_date` (ano), `revenue`, `poster_path`, e `watch/providers.results.BR` → `flatrate`, `rent`, `buy`, `link`.
  - Ignora `ads` e `free`.
- Ordem final pelo `revenue` retornado nos detalhes (posição 1–200).
- Concorrência limitada (ex.: 5–10 requisições simultâneas) e nova tentativa com espera em HTTP 429/5xx.
- **Falha = não grava.** Se qualquer etapa falhar após as tentativas, o script sai com erro e o `dados.json` anterior permanece. Também aborta se vierem menos de 200 filmes.
- A lógica de transformação (resposta da API → registro do filme) fica numa função pura exportada, testada com `node:test`.

### 2. Formato de `site/dados.json`

```json
{
  "atualizadoEm": "2026-11-19T09:00:00Z",
  "regiao": "BR",
  "filmes": [
    {
      "posicao": 1,
      "tmdbId": 19995,
      "titulo": "Avatar",
      "tituloOriginal": "Avatar",
      "ano": 2009,
      "bilheteria": 2923706026,
      "poster": "/caminho.jpg",
      "link": "https://www.themoviedb.org/movie/19995/watch?locale=BR",
      "assinatura": [{ "id": 337, "nome": "Disney Plus", "logo": "/logo.jpg" }],
      "aluguel": [],
      "compra": []
    }
  ]
}
```

Filme sem nada no Brasil: as três listas vazias (continua no arquivo, posição preservada). Sem `link` de disponibilidade: usar a página do filme no TMDB.

### 3. Página (`site/index.html` + CSS/JS próprios)

- HTML/CSS/JS puro, sem framework, sem build. *(Decisão minha.)*
- Carrega `dados.json`, renderiza a lista conforme o esboço:

```
Top 200 Bilheterias · disponível no Brasil
[Assinatura ✓] [Aluguel ✓] [Compra ✓]   Serviço: Todos ▾
[ ] Mostrar indisponíveis               Atualizado: 19/11 06:00
#1 [pôster] Avatar (2009) · US$ 2,92 bi
   Assinatura: Disney+
   Aluguel: Apple TV, Google Play
   Compra: Apple TV, Google Play
...
Dados de streaming: JustWatch · Filmes: TMDB
```

- **Filtros:**
  - Tipos: um filme aparece se tiver pelo menos um serviço em algum tipo ligado; só as linhas dos tipos ligados são mostradas.
  - Serviço: lista com todos os serviços presentes nos dados, com o nome exato que vem da API (incluindo variantes como "Amazon Channel"), ordenada por nome; ao escolher um, mostra só filmes com esse serviço em algum tipo ligado.
  - "Mostrar indisponíveis": inclui filmes sem nada nos tipos ligados, em tom apagado.
  - A posição `#N` é sempre a do ranking original, mesmo com filtro.
  - Os filtros escolhidos ficam salvos no `localStorage` (conveniência; a página funciona sem ele).
- **Clique no filme:** abre `link` em nova aba.
- Pôster via `https://image.tmdb.org/t/p/w185{poster}`; logos via `.../w45{logo}`.
- Mobile-first, legível em tela de celular.
- **Data visível:** "Atualizado: dd/mm hh:mm" (horário de Brasília). Se `atualizadoEm` tiver mais de 3 dias, mostrar aviso de dados desatualizados.
- Rodapé com créditos JustWatch e TMDB (incluindo o aviso exigido pelo TMDB: "This product uses the TMDB API but is not endorsed or certified by TMDB").

### 4. Automação e hospedagem

- Repositório público no GitHub do usuário.
- Segredo do repositório: `TMDB_TOKEN`.
- Workflow `.github/workflows/atualizar.yml`:
  - `schedule`: diário às 09:00 UTC (06:00 de Brasília) — *decisão minha*.
  - `workflow_dispatch`: botão "Run workflow" para atualizar na hora (substitui o botão "Atualizar" da página, que na abordagem B não pode chamar a API).
  - Passos: checkout → `node scripts/atualizar.js` → commit e push do `dados.json` → deploy do Pages, **tudo no mesmo workflow**. *(Decisão minha: um push feito com `GITHUB_TOKEN` não dispara outro workflow, então o deploy não pode depender de um workflow separado.)*
  - Commit todo dia, mesmo sem mudança nos filmes, porque `atualizadoEm` muda a cada execução. *(Decisão minha: isso evita o falso aviso de "desatualizado" e impede o GitHub de desligar o agendamento depois de 60 dias sem atividade.)*
- GitHub Pages publica a pasta `site/` pelo deploy desse mesmo workflow.
- Onde fica: o projeto é construído em `d:\Claude Code`. Criar o repositório público, cadastrar o segredo `TMDB_TOKEN` e ativar o Pages são passos que o usuário executa, com instruções.
- Rodar localmente: `TMDB_TOKEN=... node scripts/atualizar.js` e abrir `site/` com um servidor estático qualquer.

## Deixado para quem construir

- Visual (cores, tipografia, layout exato dos cards), desde que siga o esboço e funcione no celular.
- Formatação de valores (ex.: "US$ 2,92 bi").
- Números exatos de concorrência/tentativas.
- Estrutura interna dos arquivos JS.

## Pré-requisitos do usuário

- Conta no TMDB com API Read Access Token.
- Conta no GitHub.

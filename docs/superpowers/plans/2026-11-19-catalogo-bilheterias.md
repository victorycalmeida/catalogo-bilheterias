# Catálogo Top 200 Bilheterias no Streaming — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar diariamente um `dados.json` com as 200 maiores bilheterias mundiais (TMDB) e sua disponibilidade no Brasil, e publicar uma página estática que lista e filtra esses filmes.

**Architecture:** Um script Node sem dependências (`scripts/`) consulta o TMDB e grava `site/dados.json` só se tudo der certo. A página em `site/` é HTML/CSS/JS puro e só lê o JSON. Um único workflow do GitHub Actions roda o script todo dia, faz o commit e publica `site/` no GitHub Pages.

**Tech Stack:** Node 20+ (ES modules, `fetch` nativo, `node:test`), HTML/CSS/JS puro, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-19-catalogo-bilheterias-design.md`

## Global Constraints

- Node 20+; **nenhuma dependência npm** (nem de desenvolvimento). `package.json` com `"type": "module"`.
- Token lido de `process.env.TMDB_TOKEN`, enviado como `Authorization: Bearer <token>`. O token nunca aparece em arquivo versionado nem em `site/`.
- API base: `https://api.themoviedb.org/3`. Imagens: `https://image.tmdb.org/t/p/w185{poster}` e `https://image.tmdb.org/t/p/w45{logo}`.
- Região `BR`; idioma `pt-BR`. Tipos usados: `flatrate` → `assinatura`, `rent` → `aluguel`, `buy` → `compra`. Ignorar `ads` e `free`.
- Total de filmes: exatamente 200. Menos que 200 ⇒ erro, não grava.
- Falha em qualquer etapa ⇒ processo sai com código ≠ 0 e `site/dados.json` anterior fica intacto.
- Rodapé da página, texto exato: `Dados de streaming: JustWatch · Filmes: TMDB` e `This product uses the TMDB API but is not endorsed or certified by TMDB.`
- Horários exibidos em `America/Sao_Paulo`. Aviso de desatualizado quando `atualizadoEm` tiver mais de 3 dias.
- Agendamento: `cron: "0 9 * * *"` (06:00 de Brasília) + `workflow_dispatch`.
- Testes: `node --test` (arquivos `tests/*.test.js`).

## Review Focus

1. **Filme sem `watch/providers.results.BR`** (ou sem a chave `watch/providers`): deve virar três listas vazias, com `link` apontando para `https://www.themoviedb.org/movie/{id}`, sem quebrar. Teste na Task 1.
2. **`poster_path` ou `release_date` nulos/vazios:** `poster: null` / `ano: null`; a página mostra um bloco cinza no lugar do pôster e omite o ano. Teste na Task 1, comportamento visual na Task 5.
3. **`TMDB_TOKEN` ausente:** o script sai com a mensagem `TMDB_TOKEN não definido` e código 1, sem chamar a API e sem gravar. Teste na Task 3.
4. **HTTP 401 (token inválido):** não deve ser repetido como 429/5xx; falha imediata com o status na mensagem. Teste na Task 2.
5. **`dados.json` não carrega na página** (404, JSON inválido): mostrar `Não foi possível carregar os dados.` em vez de uma tela vazia. Verificação manual na Task 5.

---

## Estrutura de arquivos

```
package.json                    # type: module; scripts test e atualizar
.gitignore                      # node_modules, .env
README.md                       # como configurar repo, segredo e Pages; rodar local
scripts/transformar.js          # funções puras: resposta TMDB → registros
scripts/tmdb.js                 # cliente HTTP com retry
scripts/atualizar.js            # orquestração + main (CLI)
site/index.html                 # estrutura da página
site/estilo.css                 # visual mobile-first
site/filtros.js                 # funções puras de filtro (testadas no Node)
site/formato.js                 # funções puras de formatação (testadas no Node)
site/app.js                     # carrega dados.json, liga DOM, localStorage
site/dados.json                 # gerado (commitado pelo workflow)
tests/fixtures/detalhes-*.json  # respostas de exemplo do TMDB
tests/*.test.js
.github/workflows/atualizar.yml
```

---

### Task 1: Projeto + transformação dos dados

**Files:**
- Create: `package.json`, `.gitignore`, `scripts/transformar.js`, `tests/transformar.test.js`, `tests/fixtures/detalhes-avatar.json`, `tests/fixtures/detalhes-sem-br.json`

**Interfaces:**
- Produces:
  - `coletarIds(paginas: Array<{results: Array<{id:number}>}>) -> number[]`: IDs em ordem, sem duplicados.
  - `transformarFilme(detalhes: object) -> Filme` (sem `posicao`).
  - `montarDados(detalhesLista: object[], agora: Date) -> Dados`: ordena por `revenue` desc (empate mantém a ordem de entrada), atribui `posicao` 1..N.
  - `Filme = { posicao, tmdbId, titulo, tituloOriginal, ano: number|null, bilheteria, poster: string|null, link, assinatura: Servico[], aluguel: Servico[], compra: Servico[] }`
  - `Servico = { id: number, nome: string, logo: string|null }` (de `provider_id`, `provider_name`, `logo_path`)
  - `Dados = { atualizadoEm: string (ISO), regiao: "BR", filmes: Filme[] }`

- [ ] **Step 1: Inicializar o repositório**

Run: `git init -b main` em `d:\Claude Code`. Criar `package.json` (`name: "catalogo-bilheterias"`, `private: true`, `type: "module"`, `engines.node: ">=20"`, scripts `"test": "node --test"`, `"atualizar": "node scripts/atualizar.js"`) e `.gitignore` (`node_modules/`, `.env`).

- [ ] **Step 2: Criar fixtures**

`detalhes-avatar.json`: objeto no formato de `GET /movie/19995?language=pt-BR&append_to_response=watch/providers` com `id: 19995`, `title: "Avatar"`, `original_title: "Avatar"`, `release_date: "2009-12-15"`, `revenue: 2923706026`, `poster_path: "/avatar.jpg"` e `"watch/providers": { results: { BR: { link: "https://www.themoviedb.org/movie/19995/watch?locale=BR", flatrate: [{provider_id: 337, provider_name: "Disney Plus", logo_path: "/d.jpg"}], rent: [{provider_id: 2, provider_name: "Apple TV", logo_path: "/a.jpg"}], buy: [{provider_id: 2, provider_name: "Apple TV", logo_path: "/a.jpg"}], ads: [{provider_id: 999, provider_name: "X", logo_path: "/x.jpg"}] }, US: {...} } }`.
`detalhes-sem-br.json`: `id: 1`, `title: "Sem BR"`, `release_date: ""`, `poster_path: null`, `revenue: 100`, `"watch/providers": { results: { US: {...} } }`.

- [ ] **Step 3: Escrever os testes que falham** (`tests/transformar.test.js`)

```js
test('transformarFilme mapeia tipos BR e ignora ads', () => {
  const f = transformarFilme(avatar);
  assert.deepEqual(f, { tmdbId: 19995, titulo: 'Avatar', tituloOriginal: 'Avatar', ano: 2009,
    bilheteria: 2923706026, poster: '/avatar.jpg',
    link: 'https://www.themoviedb.org/movie/19995/watch?locale=BR',
    assinatura: [{ id: 337, nome: 'Disney Plus', logo: '/d.jpg' }],
    aluguel: [{ id: 2, nome: 'Apple TV', logo: '/a.jpg' }],
    compra: [{ id: 2, nome: 'Apple TV', logo: '/a.jpg' }] });
});
test('transformarFilme sem BR: listas vazias, link TMDB, ano e poster nulos', () => {
  const f = transformarFilme(semBr);
  assert.equal(f.link, 'https://www.themoviedb.org/movie/1');
  assert.deepEqual([f.assinatura, f.aluguel, f.compra], [[], [], []]);
  assert.equal(f.ano, null); assert.equal(f.poster, null);
});
test('transformarFilme sem a chave watch/providers não quebra', () => {
  const { ['watch/providers']: _, ...semChave } = avatar;
  assert.deepEqual(transformarFilme(semChave).assinatura, []);
});
test('coletarIds remove duplicados mantendo a ordem', () => {
  assert.deepEqual(coletarIds([{ results: [{id:3},{id:1}] }, { results: [{id:1},{id:2}] }]), [3, 1, 2]);
});
test('montarDados ordena por revenue e numera posicao', () => {
  const d = montarDados([semBr, avatar], new Date('2026-11-19T09:00:00Z'));
  assert.equal(d.atualizadoEm, '2026-11-19T09:00:00.000Z');
  assert.equal(d.regiao, 'BR');
  assert.deepEqual(d.filmes.map(f => [f.posicao, f.tmdbId]), [[1, 19995], [2, 1]]);
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `node --test tests/transformar.test.js` — Expected: FAIL (módulo `scripts/transformar.js` não encontrado).

- [ ] **Step 5: Implementar `scripts/transformar.js`** com as três funções exportadas acima.

- [ ] **Step 6: Rodar e ver passar**

Run: `node --test` — Expected: 5 testes PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore scripts/transformar.js tests docs
git commit -m "feat: transformação das respostas do TMDB"
```

---

### Task 2: Cliente TMDB com retry

**Files:**
- Create: `scripts/tmdb.js`, `tests/tmdb.test.js`

**Interfaces:**
- Produces: `criarCliente({ token: string, fetch?: typeof fetch, maxTentativas?: number = 4, esperaBaseMs?: number = 1000, esperar?: (ms) => Promise<void> }) -> { get(caminho: string, params?: Record<string,string|number|boolean>) -> Promise<object> }`
  - URL = `https://api.themoviedb.org/3` + `caminho` + query string de `params`.
  - Header `Authorization: Bearer ${token}`, `accept: application/json`.
  - 429 e 5xx (e erro de rede): nova tentativa após `Retry-After` (segundos) se presente, senão `esperaBaseMs * 2 ** (tentativa-1)`; após `maxTentativas`, lança `Error` com o status.
  - Outros status ≠ 2xx: lança imediatamente `Error(`TMDB ${status} em ${caminho}`)`.

- [ ] **Step 1: Escrever os testes que falham** (fetch falso que devolve uma sequência de respostas; `esperar` falso que registra os ms)

```js
test('get monta URL, query e header', async () => { /* fetch falso captura (url, opts) */
  await cliente.get('/discover/movie', { page: 2, sort_by: 'revenue.desc' });
  assert.equal(url, 'https://api.themoviedb.org/3/discover/movie?page=2&sort_by=revenue.desc');
  assert.equal(opts.headers.Authorization, 'Bearer tk');
});
test('429 repete respeitando Retry-After e depois devolve o JSON', async () => {
  // respostas: 429 com Retry-After: 2, depois 200 {ok:true}
  assert.deepEqual(await cliente.get('/x'), { ok: true });
  assert.deepEqual(esperas, [2000]);
});
test('500 repete com backoff e falha após maxTentativas', async () => {
  // 4 respostas 500
  await assert.rejects(cliente.get('/x'), /500/);
  assert.deepEqual(esperas, [1000, 2000, 4000]);
});
test('401 falha na hora, sem repetir', async () => {
  await assert.rejects(cliente.get('/x'), /TMDB 401 em \/x/);
  assert.equal(chamadas, 1);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test tests/tmdb.test.js` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `criarCliente`** em `scripts/tmdb.js`.
- [ ] **Step 4: Rodar e ver passar** — `node --test` → todos PASS.
- [ ] **Step 5: Commit** — `git add scripts/tmdb.js tests/tmdb.test.js && git commit -m "feat: cliente TMDB com retry"`

---

### Task 3: Orquestração e CLI

**Files:**
- Create: `scripts/atualizar.js`, `tests/atualizar.test.js`

**Interfaces:**
- Consumes: `criarCliente` (Task 2); `coletarIds`, `montarDados` (Task 1).
- Produces:
  - `buscarRanking(cliente, total = 200) -> Promise<number[]>`: páginas 1, 2, … de `GET /discover/movie` com `{ sort_by: 'revenue.desc', include_adult: false, page }`, acumulando via `coletarIds` até ter `total` IDs (corta no `total`); se `page > total_pages` antes disso, lança `Error('Ranking incompleto: N de 200')`.
  - `buscarDetalhes(cliente, ids: number[], concorrencia = 8) -> Promise<object[]>`: `GET /movie/{id}` com `{ language: 'pt-BR', append_to_response: 'watch/providers' }`; resultado na mesma ordem de `ids`; no máximo `concorrencia` requisições simultâneas; qualquer rejeição rejeita tudo.
  - `executar({ cliente, caminhoSaida: string, agora: Date }) -> Promise<Dados>`: ranking → detalhes → `montarDados`; se `filmes.length !== 200` lança erro; grava JSON (indentado com 2 espaços) em arquivo temporário ao lado e renomeia sobre `caminhoSaida`.
  - Main (só quando executado diretamente: `import.meta.url === pathToFileURL(process.argv[1]).href`): sem `TMDB_TOKEN` → `console.error('TMDB_TOKEN não definido')` e `process.exit(1)`; senão `executar` com saída `site/dados.json` (relativa à raiz do projeto); erro → mensagem no stderr e `exit(1)`.

- [ ] **Step 1: Escrever os testes que falham** (cliente falso: `get(caminho, params)` responde a partir de mapas; saída num `fs.mkdtemp` de `os.tmpdir()`)

```js
test('buscarRanking busca a página 11 quando há duplicados', async () => {
  // páginas 1..10 com 20 IDs cada, sendo 1 duplicado entre a 1 e a 2; página 11 com novos IDs; total_pages: 50
  const ids = await buscarRanking(cliente);
  assert.equal(ids.length, 200); assert.equal(new Set(ids).size, 200);
  assert.ok(paginasPedidas.includes(11));
});
test('buscarRanking lança se as páginas acabarem', async () => {
  // total_pages: 1, 20 resultados
  await assert.rejects(buscarRanking(cliente), /Ranking incompleto: 20 de 200/);
});
test('buscarDetalhes preserva ordem e respeita a concorrência', async () => {
  // get com atraso aleatório; contador de simultâneas
  const r = await buscarDetalhes(cliente, [5, 4, 3, 2, 1], 2);
  assert.deepEqual(r.map(d => d.id), [5, 4, 3, 2, 1]);
  assert.ok(maxSimultaneas <= 2);
});
test('executar grava 200 filmes', async () => {
  const d = await executar({ cliente, caminhoSaida, agora: new Date('2026-11-19T09:00:00Z') });
  assert.equal(JSON.parse(await readFile(caminhoSaida, 'utf8')).filmes.length, 200);
});
test('executar com falha nos detalhes mantém o arquivo anterior', async () => {
  await writeFile(caminhoSaida, '{"antigo":true}');
  // get de /movie/7 rejeita
  await assert.rejects(executar({ cliente, caminhoSaida, agora }));
  assert.equal(await readFile(caminhoSaida, 'utf8'), '{"antigo":true}');
});
test('CLI sem TMDB_TOKEN sai com código 1', () => {
  const r = spawnSync(process.execPath, ['scripts/atualizar.js'], { env: { ...process.env, TMDB_TOKEN: '' }, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /TMDB_TOKEN não definido/);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test tests/atualizar.test.js` → FAIL.
- [ ] **Step 3: Implementar `scripts/atualizar.js`.**
- [ ] **Step 4: Rodar e ver passar** — `node --test` → todos PASS.
- [ ] **Step 5 (se o usuário tiver fornecido o token no ambiente): teste real** — `TMDB_TOKEN=... node scripts/atualizar.js` → cria `site/dados.json` com 200 filmes; conferir que o #1 tem `bilheteria` > 2,5 bi. Se não houver token, pular e registrar que a verificação real fica para a primeira execução do workflow.
- [ ] **Step 6: Commit** — `git add scripts/atualizar.js tests/atualizar.test.js && git commit -m "feat: script de atualização do dados.json"` (incluir `site/dados.json` se foi gerado no Step 5).

---

### Task 4: Lógica da página (filtros e formatação)

**Files:**
- Create: `site/filtros.js`, `site/formato.js`, `tests/filtros.test.js`, `tests/formato.test.js`

**Interfaces:**
- Consumes: formato `Filme` / `Servico` (Task 1).
- Produces:
  - `TIPOS = ['assinatura', 'aluguel', 'compra']`; `ROTULOS = { assinatura: 'Assinatura', aluguel: 'Aluguel', compra: 'Compra' }`.
  - `listarServicos(filmes) -> Servico[]`: únicos por `id`, nome exato da API, ordenados por `nome.localeCompare(b, 'pt-BR')`.
  - `filtrarFilmes(filmes, { tipos: Set<string>, servico: number|null, mostrarIndisponiveis: boolean }) -> Array<{ filme, disponivel: boolean, linhas: Array<{ tipo, servicos: Servico[] }> }>`
    - `linhas`: só tipos ligados com lista não vazia (todos os serviços daquele tipo).
    - `disponivel`: existe ao menos um serviço nos tipos ligados (e, se `servico` ≠ null, esse serviço está em algum tipo ligado).
    - Não disponível e `mostrarIndisponiveis = false` ⇒ fora do resultado. Ordem = `posicao`.
  - `formatarBilheteria(n) -> string`: ≥ 1e9 ⇒ `US$ 2,92 bi` (2 casas); senão `US$ 950 mi` (0 casas, arredondado).
  - `formatarAtualizado(iso) -> string`: `dd/mm HH:mm` em `America/Sao_Paulo`.
  - `estaDesatualizado(iso, agora: Date) -> boolean`: `agora - iso > 3 dias`.

- [ ] **Step 1: Escrever os testes que falham**

```js
// filtros: A(assinatura Netflix 8), B(aluguel Apple 2), C(nada)
test('todos os tipos ligados escondem indisponíveis', () => {
  assert.deepEqual(filtrar({}).map(r => r.filme.tmdbId), [A, B]);
});
test('só assinatura: B some; com indisponíveis volta apagado', () => {
  assert.deepEqual(filtrar({ tipos: ['assinatura'] }).map(r => r.filme.tmdbId), [A]);
  const r = filtrar({ tipos: ['assinatura'], mostrarIndisponiveis: true });
  assert.deepEqual(r.map(x => [x.filme.tmdbId, x.disponivel]), [[A, true], [B, false], [C, false]]);
  assert.deepEqual(r[1].linhas, []);
});
test('serviço específico filtra por tipos ligados', () => {
  assert.deepEqual(filtrar({ servico: 2 }).map(r => r.filme.tmdbId), [B]);
  assert.deepEqual(filtrar({ servico: 2, tipos: ['assinatura'] }), []);
});
test('listarServicos únicos e ordenados', () => {
  assert.deepEqual(listarServicos(filmes).map(s => s.nome), ['Apple TV', 'Netflix']);
});
// formato
test('formatarBilheteria', () => {
  assert.equal(formatarBilheteria(2923706026), 'US$ 2,92 bi');
  assert.equal(formatarBilheteria(949_600_000), 'US$ 950 mi');
});
test('formatarAtualizado em horário de Brasília', () => {
  assert.equal(formatarAtualizado('2026-11-19T09:00:00Z'), '19/11 06:00');
});
test('estaDesatualizado acima de 3 dias', () => {
  const agora = new Date('2026-11-23T09:00:01Z');
  assert.equal(estaDesatualizado('2026-11-20T09:00:00Z', agora), true);
  assert.equal(estaDesatualizado('2026-11-21T09:00:00Z', agora), false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test tests/filtros.test.js tests/formato.test.js` → FAIL.
- [ ] **Step 3: Implementar `site/filtros.js` e `site/formato.js`** como ES modules puros (sem DOM), para rodarem tanto no navegador quanto no Node.
- [ ] **Step 4: Rodar e ver passar** — `node --test` → todos PASS.
- [ ] **Step 5: Commit** — `git add site/filtros.js site/formato.js tests && git commit -m "feat: filtros e formatação da página"`

---

### Task 5: Página

**Files:**
- Create: `site/index.html`, `site/estilo.css`, `site/app.js`, `tests/fixtures/dados-exemplo.json`

**Interfaces:**
- Consumes: `filtrarFilmes`, `listarServicos`, `TIPOS`, `ROTULOS` (Task 4 / `site/filtros.js`); `formatarBilheteria`, `formatarAtualizado`, `estaDesatualizado` (`site/formato.js`); `dados.json` no formato `Dados` (Task 1).

- [ ] **Step 1: Fixture para pré-visualização**: `tests/fixtures/dados-exemplo.json` no formato `Dados`, com ~6 filmes cobrindo: os três tipos, só aluguel, nenhum serviço, `poster: null`, `ano: null`, `atualizadoEm` com 5 dias de idade.

- [ ] **Step 2: Implementar a página**
  - `index.html`: `<html lang="pt-BR">`, viewport meta, título `Top 200 Bilheterias no Streaming`; cabeçalho com título, três toggles de tipo (ligados por padrão), `<select>` "Serviço" (opção `Todos` + `listarServicos`), checkbox "Mostrar indisponíveis" (desligado), texto `Atualizado: dd/mm HH:mm`; `<main>` com a lista; rodapé com o texto exato de Global Constraints. `<script type="module" src="app.js">`.
  - `app.js`: `fetch('dados.json', { cache: 'no-cache' })`; em falha, mostrar `Não foi possível carregar os dados.`; se `estaDesatualizado`, aviso `Dados desatualizados (última atualização há mais de 3 dias).`; renderizar cada item: `#posicao`, pôster (ou bloco cinza se `null`, `loading="lazy"`), título (+ ` (ano)` se houver), bilheteria, uma linha por tipo `Rótulo: logos + nomes`; item inteiro é link para `filme.link` com `target="_blank" rel="noopener"`; indisponíveis com classe que reduz a opacidade; contador "N filmes". Filtros salvos/lidos em `localStorage` (chave `catalogo-filtros`) dentro de `try/catch`.
  - `estilo.css`: mobile-first, uma coluna, cabeçalho fixo no topo, legível com 360px de largura; suporte a tema escuro via `prefers-color-scheme`.

- [ ] **Step 3: Verificação manual**

Copiar a fixture: `cp tests/fixtures/dados-exemplo.json site/dados.json` (não commitar essa cópia), rodar `npx --yes serve site` e abrir no navegador, em largura de desktop e de celular (DevTools, 360px). Conferir: aviso de desatualizado; desligar "Aluguel" e "Compra" esconde o filme só de aluguel; "Mostrar indisponíveis" mostra os apagados; escolher um serviço filtra; recarregar mantém os filtros; pôster nulo mostra o bloco cinza; ano nulo é omitido. Renomear `site/dados.json` temporariamente → aparece a mensagem de erro. Depois, restaurar ou apagar a cópia.

- [ ] **Step 4: Commit** — `git add site/index.html site/estilo.css site/app.js tests/fixtures/dados-exemplo.json && git commit -m "feat: página do catálogo"`

---

### Task 6: Workflow, publicação e README

**Files:**
- Create: `.github/workflows/atualizar.yml`, `README.md`

- [ ] **Step 1: Escrever o workflow** (config exata):

```yaml
name: Atualizar e publicar
on:
  schedule:
    - cron: "0 9 * * *"
  workflow_dispatch:
permissions:
  contents: write
  pages: write
  id-token: write
concurrency:
  group: atualizar
  cancel-in-progress: false
jobs:
  atualizar:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test
      - run: node scripts/atualizar.js
        env:
          TMDB_TOKEN: ${{ secrets.TMDB_TOKEN }}
      - name: Commit dados.json
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add site/dados.json
          git commit -m "dados: atualização diária" || echo "sem mudanças"
          git push
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Escrever o `README.md`** com: o que é; pré-requisitos (token "API Read Access Token" em themoviedb.org → Configurações → API; conta GitHub); passo a passo — criar repositório **público**, `git remote add origin … && git push -u origin main`, Settings → Secrets and variables → Actions → `TMDB_TOKEN`, Settings → Pages → Source: **GitHub Actions**, Actions → "Atualizar e publicar" → Run workflow; endereço final `https://<usuário>.github.io/<repo>/`; rodar local (`TMDB_TOKEN=... npm run atualizar`, `npx --yes serve site`); créditos JustWatch/TMDB.

- [ ] **Step 3: Verificar** — `node --test` → todos PASS; `git status` limpo depois do commit; conferir que nenhum arquivo versionado contém o token (`git grep -n "eyJ"` não retorna nada).

- [ ] **Step 4: Commit** — `git add .github README.md && git commit -m "ci: atualização diária e publicação no Pages"`

- [ ] **Step 5: Entregar ao usuário** os passos de configuração do README (criar o repositório, cadastrar o segredo, ativar o Pages, rodar o workflow). A verificação de ponta a ponta é a primeira execução do workflow ficar verde e a URL do Pages abrir a lista no celular.

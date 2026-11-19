import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarRanking, buscarDetalhes, executar } from '../scripts/atualizar.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const agora = new Date('2026-11-19T09:00:00Z');

// Cliente falso: páginas do discover com IDs sequenciais; /movie/{id} devolve detalhes mínimos.
function clienteFalso({ paginas, totalPaginas = 50, falharEm = null } = {}) {
  const paginasPedidas = [];
  const pagina = (n) => paginas?.[n] ?? Array.from({ length: 20 }, (_, i) => (n - 1) * 20 + i + 1);
  return {
    paginasPedidas,
    async get(caminho, params) {
      if (caminho === '/discover/movie') {
        paginasPedidas.push(params.page);
        return { page: params.page, total_pages: totalPaginas, results: pagina(params.page).map((id) => ({ id })) };
      }
      const id = Number(caminho.split('/').pop());
      if (id === falharEm) throw new Error('TMDB 500 em ' + caminho);
      return { id, title: `Filme ${id}`, original_title: `Film ${id}`, release_date: '2000-01-01', revenue: 10_000 - id, poster_path: null };
    },
  };
}

test('buscarRanking busca a página 11 quando há duplicados', async () => {
  const p2 = Array.from({ length: 20 }, (_, i) => 21 + i);
  p2[0] = 1; // duplicado da página 1
  const cliente = clienteFalso({ paginas: { 2: p2 } });
  const ids = await buscarRanking(cliente);
  assert.equal(ids.length, 200);
  assert.equal(new Set(ids).size, 200);
  assert.ok(cliente.paginasPedidas.includes(11));
});

test('buscarRanking lança se as páginas acabarem', async () => {
  await assert.rejects(buscarRanking(clienteFalso({ totalPaginas: 1 })), /Ranking incompleto: 20 de 200/);
});

test('buscarDetalhes preserva ordem e respeita a concorrência', async () => {
  let ativas = 0;
  let maxSimultaneas = 0;
  const cliente = {
    async get(caminho) {
      ativas++;
      maxSimultaneas = Math.max(maxSimultaneas, ativas);
      await new Promise((r) => setTimeout(r, Math.random() * 15));
      ativas--;
      return { id: Number(caminho.split('/').pop()) };
    },
  };
  const r = await buscarDetalhes(cliente, [5, 4, 3, 2, 1], 2);
  assert.deepEqual(r.map((d) => d.id), [5, 4, 3, 2, 1]);
  assert.ok(maxSimultaneas <= 2);
});

test('buscarDetalhes pede pt-BR com watch/providers', async () => {
  const pedidos = [];
  await buscarDetalhes({ get: async (c, p) => { pedidos.push([c, p]); return {}; } }, [7]);
  assert.deepEqual(pedidos, [['/movie/7', { language: 'pt-BR', append_to_response: 'watch/providers' }]]);
});

test('executar grava 200 filmes', async () => {
  const caminhoSaida = join(await mkdtemp(join(tmpdir(), 'catalogo-')), 'dados.json');
  await executar({ cliente: clienteFalso(), caminhoSaida, agora });
  const dados = JSON.parse(await readFile(caminhoSaida, 'utf8'));
  assert.equal(dados.filmes.length, 200);
  assert.equal(dados.filmes[0].tmdbId, 1);
  assert.equal(dados.atualizadoEm, '2026-11-19T09:00:00.000Z');
});

test('executar com falha nos detalhes mantém o arquivo anterior', async () => {
  const caminhoSaida = join(await mkdtemp(join(tmpdir(), 'catalogo-')), 'dados.json');
  await writeFile(caminhoSaida, '{"antigo":true}');
  await assert.rejects(executar({ cliente: clienteFalso({ falharEm: 7 }), caminhoSaida, agora }));
  assert.equal(await readFile(caminhoSaida, 'utf8'), '{"antigo":true}');
});

test('CLI sem TMDB_TOKEN sai com código 1', () => {
  const r = spawnSync(process.execPath, ['scripts/atualizar.js'], {
    cwd: raiz, env: { ...process.env, TMDB_TOKEN: '' }, encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /TMDB_TOKEN não definido/);
});

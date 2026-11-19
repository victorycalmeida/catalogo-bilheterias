import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCliente } from '../scripts/tmdb.js';

// fetch falso: devolve as respostas da fila, em ordem, e registra as chamadas.
function montar(respostas, opcoes = {}) {
  const chamadas = [];
  const esperas = [];
  const fetch = async (url, opts) => {
    chamadas.push({ url, opts });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200, headers: r.headers ?? {} });
  };
  const cliente = criarCliente({ token: 'tk', fetch, esperar: async (ms) => { esperas.push(ms); }, ...opcoes });
  return { cliente, chamadas, esperas };
}

test('get monta URL, query e header', async () => {
  const { cliente, chamadas } = montar([{ corpo: { ok: true } }]);
  await cliente.get('/discover/movie', { page: 2, sort_by: 'revenue.desc' });
  assert.equal(chamadas[0].url, 'https://api.themoviedb.org/3/discover/movie?page=2&sort_by=revenue.desc');
  assert.equal(chamadas[0].opts.headers.Authorization, 'Bearer tk');
});

test('429 repete respeitando Retry-After e depois devolve o JSON', async () => {
  const { cliente, esperas } = montar([{ status: 429, headers: { 'Retry-After': '2' } }, { corpo: { ok: true } }]);
  assert.deepEqual(await cliente.get('/x'), { ok: true });
  assert.deepEqual(esperas, [2000]);
});

test('500 repete com backoff e falha após maxTentativas', async () => {
  const { cliente, esperas, chamadas } = montar([{ status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }]);
  await assert.rejects(cliente.get('/x'), /500/);
  assert.deepEqual(esperas, [1000, 2000, 4000]);
  assert.equal(chamadas.length, 4);
});

test('erro de rede também é repetido', async () => {
  const { cliente } = montar([new TypeError('fetch failed'), { corpo: { ok: 1 } }]);
  assert.deepEqual(await cliente.get('/x'), { ok: 1 });
});

test('401 falha na hora, sem repetir', async () => {
  const { cliente, chamadas } = montar([{ status: 401 }, { corpo: {} }]);
  await assert.rejects(cliente.get('/x'), /TMDB 401 em \/x/);
  assert.equal(chamadas.length, 1);
});

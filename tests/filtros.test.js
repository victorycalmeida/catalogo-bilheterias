import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS, ROTULOS, filtrarFilmes, listarServicos } from '../site/filtros.js';

const netflix = { id: 8, nome: 'Netflix', logo: '/n.jpg' };
const apple = { id: 2, nome: 'Apple TV', logo: '/a.jpg' };
const filme = (posicao, tmdbId, { assinatura = [], aluguel = [], compra = [] } = {}) =>
  ({ posicao, tmdbId, titulo: `F${tmdbId}`, assinatura, aluguel, compra });
const [A, B, C] = [10, 20, 30];
const filmes = [filme(1, A, { assinatura: [netflix] }), filme(2, B, { aluguel: [apple] }), filme(3, C)];

const filtrar = ({ tipos = TIPOS, servico = null, mostrarIndisponiveis = false }) =>
  filtrarFilmes(filmes, { tipos: new Set(tipos), servico, mostrarIndisponiveis });

test('TIPOS e ROTULOS', () => {
  assert.deepEqual(TIPOS, ['assinatura', 'aluguel', 'compra']);
  assert.deepEqual(ROTULOS, { assinatura: 'Assinatura', aluguel: 'Aluguel', compra: 'Compra' });
});

test('todos os tipos ligados escondem indisponíveis', () => {
  assert.deepEqual(filtrar({}).map((r) => r.filme.tmdbId), [A, B]);
  assert.deepEqual(filtrar({})[0].linhas, [{ tipo: 'assinatura', servicos: [netflix] }]);
});

test('só assinatura: B some; com indisponíveis volta apagado', () => {
  assert.deepEqual(filtrar({ tipos: ['assinatura'] }).map((r) => r.filme.tmdbId), [A]);
  const r = filtrar({ tipos: ['assinatura'], mostrarIndisponiveis: true });
  assert.deepEqual(r.map((x) => [x.filme.tmdbId, x.disponivel]), [[A, true], [B, false], [C, false]]);
  assert.deepEqual(r[1].linhas, []);
});

test('serviço específico filtra por tipos ligados', () => {
  assert.deepEqual(filtrar({ servico: 2 }).map((r) => r.filme.tmdbId), [B]);
  assert.deepEqual(filtrar({ servico: 2, tipos: ['assinatura'] }), []);
});

test('listarServicos únicos e ordenados', () => {
  const comRepetido = [...filmes, filme(4, 40, { compra: [apple] })];
  assert.deepEqual(listarServicos(comRepetido).map((s) => s.nome), ['Apple TV', 'Netflix']);
});

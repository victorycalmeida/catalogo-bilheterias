import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coletarIds, transformarFilme, montarDados } from '../scripts/transformar.js';

const carregar = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const avatar = carregar('detalhes-avatar.json');
const semBr = carregar('detalhes-sem-br.json');

test('transformarFilme mapeia tipos BR e ignora ads', () => {
  assert.deepEqual(transformarFilme(avatar), {
    tmdbId: 19995, titulo: 'Avatar', tituloOriginal: 'Avatar', ano: 2009,
    bilheteria: 2923706026, poster: '/avatar.jpg',
    link: 'https://www.themoviedb.org/movie/19995/watch?locale=BR',
    assinatura: [{ id: 337, nome: 'Disney Plus', logo: '/d.jpg' }],
    aluguel: [{ id: 2, nome: 'Apple TV', logo: '/a.jpg' }],
    compra: [{ id: 2, nome: 'Apple TV', logo: '/a.jpg' }],
  });
});

test('transformarFilme sem BR: listas vazias, link TMDB, ano e poster nulos', () => {
  const f = transformarFilme(semBr);
  assert.equal(f.link, 'https://www.themoviedb.org/movie/1');
  assert.deepEqual([f.assinatura, f.aluguel, f.compra], [[], [], []]);
  assert.equal(f.ano, null);
  assert.equal(f.poster, null);
});

test('transformarFilme sem a chave watch/providers não quebra', () => {
  const { ['watch/providers']: _, ...semChave } = avatar;
  const f = transformarFilme(semChave);
  assert.deepEqual(f.assinatura, []);
  assert.equal(f.link, 'https://www.themoviedb.org/movie/19995');
});

test('coletarIds remove duplicados mantendo a ordem', () => {
  assert.deepEqual(coletarIds([{ results: [{ id: 3 }, { id: 1 }] }, { results: [{ id: 1 }, { id: 2 }] }]), [3, 1, 2]);
});

test('montarDados ordena por revenue e numera posicao', () => {
  const d = montarDados([semBr, avatar], new Date('2026-11-19T09:00:00Z'));
  assert.equal(d.atualizadoEm, '2026-11-19T09:00:00.000Z');
  assert.equal(d.regiao, 'BR');
  assert.deepEqual(d.filmes.map((f) => [f.posicao, f.tmdbId]), [[1, 19995], [2, 1]]);
});

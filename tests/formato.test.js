import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarBilheteria, formatarAtualizado, estaDesatualizado } from '../site/formato.js';

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

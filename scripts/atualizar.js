// Gera site/dados.json: top 200 bilheterias (TMDB) + disponibilidade no Brasil.
// Uso: TMDB_TOKEN=... node scripts/atualizar.js

import { rename, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { criarCliente } from './tmdb.js';
import { coletarIds, montarDados } from './transformar.js';

const TOTAL = 200;

export async function buscarRanking(cliente, total = TOTAL) {
  const paginas = [];
  for (let page = 1; ; page++) {
    const resposta = await cliente.get('/discover/movie', { sort_by: 'revenue.desc', include_adult: false, page });
    paginas.push(resposta);
    const ids = coletarIds(paginas);
    if (ids.length >= total) return ids.slice(0, total);
    if (page >= (resposta.total_pages ?? 0)) throw new Error(`Ranking incompleto: ${ids.length} de ${total}`);
  }
}

export async function buscarDetalhes(cliente, ids, concorrencia = 8) {
  const resultados = new Array(ids.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < ids.length) {
      const i = proximo++;
      resultados[i] = await cliente.get(`/movie/${ids[i]}`, { language: 'pt-BR', append_to_response: 'watch/providers' });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concorrencia, ids.length) }, trabalhador));
  return resultados;
}

export async function executar({ cliente, caminhoSaida, agora }) {
  const ids = await buscarRanking(cliente);
  const detalhes = await buscarDetalhes(cliente, ids);
  const dados = montarDados(detalhes, agora);
  if (dados.filmes.length !== TOTAL) throw new Error(`Esperava ${TOTAL} filmes, veio ${dados.filmes.length}`);

  // Grava num temporário e renomeia: o arquivo anterior só é trocado se tudo deu certo.
  const temporario = `${caminhoSaida}.tmp`;
  await writeFile(temporario, JSON.stringify(dados, null, 2) + '\n', 'utf8');
  await rename(temporario, caminhoSaida);
  return dados;
}

async function main() {
  const token = process.env.TMDB_TOKEN;
  if (!token) {
    console.error('TMDB_TOKEN não definido');
    process.exit(1);
  }
  const caminhoSaida = fileURLToPath(new URL('../site/dados.json', import.meta.url));
  try {
    const dados = await executar({ cliente: criarCliente({ token }), caminhoSaida, agora: new Date() });
    const [primeiro] = dados.filmes;
    console.log(`OK: ${dados.filmes.length} filmes gravados em ${caminhoSaida} (#1: ${primeiro.titulo})`);
  } catch (erro) {
    console.error(`Falha na atualização: ${erro.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

// Funções puras: respostas do TMDB → registros do dados.json.

const TIPOS_TMDB = { assinatura: 'flatrate', aluguel: 'rent', compra: 'buy' };

/** IDs na ordem em que aparecem nas páginas do /discover, sem duplicados. */
export function coletarIds(paginas) {
  const ids = [];
  const vistos = new Set();
  for (const pagina of paginas) {
    for (const { id } of pagina.results ?? []) {
      if (!vistos.has(id)) {
        vistos.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

const paraServico = (p) => ({ id: p.provider_id, nome: p.provider_name, logo: p.logo_path ?? null });

/** Detalhes de /movie/{id}?append_to_response=watch/providers → Filme (sem posicao). */
export function transformarFilme(detalhes) {
  const br = detalhes['watch/providers']?.results?.BR ?? {};
  const ano = detalhes.release_date ? Number(detalhes.release_date.slice(0, 4)) : null;
  const filme = {
    tmdbId: detalhes.id,
    titulo: detalhes.title,
    tituloOriginal: detalhes.original_title,
    ano: Number.isFinite(ano) ? ano : null,
    bilheteria: detalhes.revenue ?? 0,
    poster: detalhes.poster_path ?? null,
    link: br.link ?? `https://www.themoviedb.org/movie/${detalhes.id}`,
  };
  for (const [tipo, chave] of Object.entries(TIPOS_TMDB)) {
    filme[tipo] = (br[chave] ?? []).map(paraServico);
  }
  return filme;
}

/** Monta o conteúdo do dados.json, ordenado por bilheteria (empate mantém a ordem de entrada). */
export function montarDados(detalhesLista, agora) {
  const filmes = detalhesLista
    .map(transformarFilme)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f.bilheteria - a.f.bilheteria || a.i - b.i)
    .map(({ f }, i) => ({ posicao: i + 1, ...f }));
  return { atualizadoEm: agora.toISOString(), regiao: 'BR', filmes };
}

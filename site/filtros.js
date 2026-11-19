// Regras de filtro da lista (puras, sem DOM; usadas no navegador e nos testes).

export const TIPOS = ['assinatura', 'aluguel', 'compra'];
export const ROTULOS = { assinatura: 'Assinatura', aluguel: 'Aluguel', compra: 'Compra' };

/** Todos os serviços presentes nos dados, únicos por id, ordenados por nome. */
export function listarServicos(filmes) {
  const porId = new Map();
  for (const filme of filmes) {
    for (const tipo of TIPOS) {
      for (const s of filme[tipo] ?? []) if (!porId.has(s.id)) porId.set(s.id, s);
    }
  }
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * @param filmes Filme[]
 * @param opcoes { tipos: Set<string>, servico: number|null, mostrarIndisponiveis: boolean }
 * @returns Array<{ filme, disponivel, linhas: Array<{ tipo, servicos }> }>, na ordem do ranking
 */
export function filtrarFilmes(filmes, { tipos, servico, mostrarIndisponiveis }) {
  const resultado = [];
  for (const filme of [...filmes].sort((a, b) => a.posicao - b.posicao)) {
    const linhas = TIPOS
      .filter((tipo) => tipos.has(tipo) && (filme[tipo] ?? []).length > 0)
      .map((tipo) => ({ tipo, servicos: filme[tipo] }));
    const disponivel = servico == null
      ? linhas.length > 0
      : linhas.some((l) => l.servicos.some((s) => s.id === servico));
    if (disponivel || mostrarIndisponiveis) resultado.push({ filme, disponivel, linhas });
  }
  return resultado;
}

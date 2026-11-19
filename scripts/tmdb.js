// Cliente HTTP mínimo para a API v3 do TMDB, com novas tentativas em 429/5xx/erro de rede.

const BASE = 'https://api.themoviedb.org/3';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function criarCliente({ token, fetch = globalThis.fetch, maxTentativas = 4, esperaBaseMs = 1000, esperar = dormir }) {
  async function get(caminho, params = {}) {
    const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    const url = BASE + caminho + (query ? `?${query}` : '');
    const opts = { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } };

    for (let tentativa = 1; ; tentativa++) {
      let resposta;
      let falha;
      try {
        resposta = await fetch(url, opts);
      } catch (erro) {
        falha = new Error(`TMDB erro de rede em ${caminho}: ${erro.message}`);
      }

      if (resposta?.ok) return resposta.json();

      const repetivel = !resposta || resposta.status === 429 || resposta.status >= 500;
      if (resposta) falha = new Error(`TMDB ${resposta.status} em ${caminho}`);
      if (!repetivel || tentativa >= maxTentativas) throw falha;

      const retryAfter = Number(resposta?.headers.get('retry-after'));
      await esperar(retryAfter > 0 ? retryAfter * 1000 : esperaBaseMs * 2 ** (tentativa - 1));
    }
  }
  return { get };
}

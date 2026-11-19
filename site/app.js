import { TIPOS, ROTULOS, filtrarFilmes, listarServicos } from './filtros.js';
import { formatarBilheteria, formatarAtualizado, estaDesatualizado } from './formato.js';

const IMG = 'https://image.tmdb.org/t/p';
const CHAVE = 'catalogo-filtros';
const $ = (id) => document.getElementById(id);

function lerFiltros() {
  const padrao = { tipos: new Set(TIPOS), servico: null, mostrarIndisponiveis: false };
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (!salvo) return padrao;
    return {
      tipos: new Set((salvo.tipos ?? TIPOS).filter((t) => TIPOS.includes(t))),
      servico: typeof salvo.servico === 'number' ? salvo.servico : null,
      mostrarIndisponiveis: Boolean(salvo.mostrarIndisponiveis),
    };
  } catch {
    return padrao;
  }
}

function salvarFiltros(f) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ tipos: [...f.tipos], servico: f.servico, mostrarIndisponiveis: f.mostrarIndisponiveis }));
  } catch { /* sem armazenamento: segue sem lembrar */ }
}

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

function poster(filme) {
  const vazio = el('div', 'poster-vazio');
  if (!filme.poster) return vazio;
  const img = el('img', 'poster');
  img.src = `${IMG}/w185${filme.poster}`;
  img.alt = '';
  img.loading = 'lazy';
  img.addEventListener('error', () => img.replaceWith(vazio), { once: true });
  return img;
}

function itemFilme({ filme, disponivel, linhas }) {
  const li = el('li', disponivel ? 'filme' : 'filme indisponivel');
  const a = el('a');
  a.href = filme.link;
  a.target = '_blank';
  a.rel = 'noopener';

  const corpo = el('div');
  const cab = el('div', 'cabecalho-filme');
  cab.append(el('span', 'posicao', `#${filme.posicao}`), el('span', 'titulo', filme.titulo));
  if (filme.ano) cab.append(el('span', 'ano', `(${filme.ano})`));
  corpo.append(cab, el('p', 'bilheteria', formatarBilheteria(filme.bilheteria)));

  if (linhas.length === 0) corpo.append(el('p', 'sem-opcao', 'Indisponível nos tipos selecionados'));
  for (const { tipo, servicos } of linhas) {
    const linha = el('div', 'linha');
    const lista = el('span', 'servicos');
    for (const s of servicos) {
      const item = el('span', 'servico-item');
      if (s.logo) {
        const logo = el('img');
        logo.src = `${IMG}/w45${s.logo}`;
        logo.alt = '';
        logo.loading = 'lazy';
        logo.addEventListener('error', () => logo.remove(), { once: true });
        item.append(logo);
      }
      item.append(document.createTextNode(s.nome));
      lista.append(item);
    }
    linha.append(el('span', 'rotulo', `${ROTULOS[tipo]}:`), lista);
    corpo.append(linha);
  }

  a.append(poster(filme), corpo);
  li.append(a);
  return li;
}

function montarControles(filtros, servicos, aoMudar) {
  const tipos = $('tipos');
  for (const tipo of TIPOS) {
    const b = el('button', 'chip', ROTULOS[tipo]);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(filtros.tipos.has(tipo)));
    b.addEventListener('click', () => {
      filtros.tipos.has(tipo) ? filtros.tipos.delete(tipo) : filtros.tipos.add(tipo);
      b.setAttribute('aria-pressed', String(filtros.tipos.has(tipo)));
      aoMudar();
    });
    tipos.append(b);
  }

  const select = $('servico');
  for (const s of servicos) {
    const op = el('option', null, s.nome);
    op.value = String(s.id);
    select.append(op);
  }
  if (filtros.servico != null && !servicos.some((s) => s.id === filtros.servico)) filtros.servico = null;
  select.value = filtros.servico == null ? '' : String(filtros.servico);
  select.addEventListener('change', () => {
    filtros.servico = select.value === '' ? null : Number(select.value);
    aoMudar();
  });

  const caixa = $('indisponiveis');
  caixa.checked = filtros.mostrarIndisponiveis;
  caixa.addEventListener('change', () => {
    filtros.mostrarIndisponiveis = caixa.checked;
    aoMudar();
  });
}

async function iniciar() {
  let dados;
  try {
    const r = await fetch('dados.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    dados = await r.json();
    if (!Array.isArray(dados.filmes)) throw new Error('formato');
  } catch {
    $('lista').replaceWith(el('p', 'erro', 'Não foi possível carregar os dados.'));
    return;
  }

  $('atualizado').textContent = `Atualizado: ${formatarAtualizado(dados.atualizadoEm)}`;
  if (estaDesatualizado(dados.atualizadoEm)) {
    $('aviso').textContent = 'Dados desatualizados (última atualização há mais de 3 dias).';
    $('aviso').hidden = false;
  }

  const filtros = lerFiltros();
  const render = () => {
    const itens = filtrarFilmes(dados.filmes, filtros);
    $('lista').replaceChildren(...itens.map(itemFilme));
    $('contador').textContent = `${itens.length} ${itens.length === 1 ? 'filme' : 'filmes'}`;
    salvarFiltros(filtros);
  };
  montarControles(filtros, listarServicos(dados.filmes), render);
  render();
}

iniciar();

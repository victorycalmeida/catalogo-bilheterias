// Formatação de valores para a página (pura, sem DOM).

const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;
const bi = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mi = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** 2923706026 → "US$ 2,92 bi"; 949600000 → "US$ 950 mi" */
export function formatarBilheteria(n) {
  return n >= 1e9 ? `US$ ${bi.format(n / 1e9)} bi` : `US$ ${mi.format(n / 1e6)} mi`;
}

/** ISO → "dd/mm HH:mm" no horário de Brasília */
export function formatarAtualizado(iso) {
  const p = Object.fromEntries(dataHora.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

export function estaDesatualizado(iso, agora = new Date()) {
  return agora.getTime() - new Date(iso).getTime() > TRES_DIAS_MS;
}

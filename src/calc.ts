// Cálculo puro: faixas de IR, CDI por ano civil e crescimento composto. Sem DOM.

export type Unidade = 'cdi' | 'aa'
export type UnidadePrazo = 'dias' | 'meses' | 'anos'

/** Último dia de cada faixa do IR regressivo da renda fixa. */
export const FAIXAS = [
  { dias: 180, aliq: 0.225 },
  { dias: 360, aliq: 0.2 },
  { dias: 720, aliq: 0.175 },
  { dias: 721, aliq: 0.15 },
] as const

/** Alíquota de IR para um resgate depois de `dias` corridos (o limite de cada faixa é incluso). */
export function aliquota(dias: number): number {
  return FAIXAS.find(f => dias <= f.dias)?.aliq ?? 0.15
}

/** Lê um número digitado em pt-BR: "10.000" → 10000, "14,15" → 14.15. Vazio ou inválido → 0. */
export function parseNum(texto: string): number {
  let s = texto.trim()
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Meses e anos viram dias corridos, que é como o IR conta. */
export function diasDoPrazo(n: number, un: UnidadePrazo): number {
  return Math.round(n * { dias: 1, meses: 365 / 12, anos: 365 }[un])
}

/**
 * CDI de um ano civil. O ano inicial usa `base`; cada ano seguinte usa o valor
 * simulado mais recente até ele, ou `base` se nenhum foi simulado.
 */
export function cdiAno(ano: number, ano0: number, base: number, simulado: Record<number, number>): number {
  let v = base
  for (let a = ano0 + 1; a <= ano; a++) if (a in simulado) v = simulado[a]
  return v
}

/** Fator de crescimento em `dias` corridos a partir de `inicio`, com a taxa anual de cada ano civil. */
export function fator(taxa: (ano: number) => number, dias: number, inicio: Date): number {
  let f = 1
  let resto = dias
  let d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  while (resto > 0) {
    const fimAno = new Date(d.getFullYear() + 1, 0, 1)
    const n = Math.min(resto, Math.round((fimAno.getTime() - d.getTime()) / 864e5))
    f *= Math.pow(1 + taxa(d.getFullYear()), n / 365)
    resto -= n
    d = fimAno
  }
  return f
}

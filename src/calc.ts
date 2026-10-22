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

/** Maior valor aceito no campo Valor: R$ 10 milhões. */
export const VALOR_MAX = 10_000_000
/** Maior taxa aceita nos campos CDI, CDB e LCI: 1.000%. */
export const TAXA_MAX = 1000

/**
 * Número digitado como na Wise: a parte inteira ganha os pontos de milhar enquanto se digita,
 * e as casas decimais só aparecem se a pessoa digitar a vírgula (até 2).
 * "1000" → "1.000", "1000,5" → "1.000,5", "" → "" (o campo mostra o 0 de exemplo).
 * Um ponto digitado no fim vira vírgula. Se o resultado passar de `max`, volta `anterior`.
 */
export function formatarNumero(texto: string, max: number, anterior = ''): string {
  let s = texto
  if (s.endsWith('.') && !s.includes(',')) s = s.slice(0, -1) + ','
  const virgula = s.indexOf(',')
  const inteiro = (virgula < 0 ? s : s.slice(0, virgula)).replace(/\D/g, '').replace(/^0+/, '')
  const decimais = virgula < 0 ? '' : s.slice(virgula + 1).replace(/\D/g, '').slice(0, 2)
  if (!inteiro && virgula < 0) return ''

  const milhar = (inteiro || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resultado = virgula < 0 ? milhar : `${milhar},${decimais}`
  return parseNum(resultado) > max ? anterior : resultado
}

/** Um número no formato desses campos, com até 2 casas: 10000 → "10.000", 92.5 → "92,5". */
export function numeroParaCampo(v: number, max: number): string {
  if (!(v > 0)) return ''
  const r = Math.round(Math.min(v, max) * 100) / 100
  return formatarNumero(String(r).replace('.', ','), max)
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

import { describe, expect, it } from 'vitest'
import { aliquota, cdiAno, diasDoPrazo, fator, formatarReais, parseNum } from './calc'

describe('aliquota', () => {
  it('inclui o último dia de cada faixa', () => {
    expect(aliquota(180)).toBe(0.225)
    expect(aliquota(181)).toBe(0.2)
    expect(aliquota(360)).toBe(0.2)
    expect(aliquota(361)).toBe(0.175)
    expect(aliquota(720)).toBe(0.175)
    expect(aliquota(721)).toBe(0.15)
    expect(aliquota(5000)).toBe(0.15)
  })
})

describe('parseNum', () => {
  it('lê números em pt-BR', () => {
    expect(parseNum('10.000')).toBe(10000)
    expect(parseNum('14,15')).toBe(14.15)
    expect(parseNum('1.234,5')).toBe(1234.5)
    expect(parseNum('110')).toBe(110)
    expect(parseNum('')).toBe(0)
    expect(parseNum('abc')).toBe(0)
  })
})

describe('formatarReais', () => {
  it('preenche pela direita, em centavos', () => {
    expect(formatarReais('')).toBe('0,00')
    expect(formatarReais('1')).toBe('0,01')
    expect(formatarReais('1000000')).toBe('10.000,00')
    expect(formatarReais('0,012')).toBe('0,12')
    expect(formatarReais('10.000,005')).toBe('100.000,05')
  })

  it('não passa de R$ 10 milhões', () => {
    expect(formatarReais('1000000000')).toBe('10.000.000,00')
    expect(formatarReais('10.000.000,001')).toBe('10.000.000,00')
    expect(formatarReais('1.234.567,891')).toBe('1.234.567,89')
  })
})

describe('diasDoPrazo', () => {
  it('converte em dias corridos', () => {
    expect(diasDoPrazo(180, 'dias')).toBe(180)
    expect(diasDoPrazo(6, 'meses')).toBe(183)
    expect(diasDoPrazo(2, 'anos')).toBe(730)
  })
})

describe('cdiAno', () => {
  it('repete o último ano simulado', () => {
    const sim = { 2028: 0.12 }
    expect(cdiAno(2026, 2026, 0.14, sim)).toBe(0.14)
    expect(cdiAno(2027, 2026, 0.14, sim)).toBe(0.14)
    expect(cdiAno(2028, 2026, 0.14, sim)).toBe(0.12)
    expect(cdiAno(2031, 2026, 0.14, sim)).toBe(0.12)
  })
})

describe('fator', () => {
  const inicio = new Date(2026, 9, 22)

  it('com taxa fixa, é igual à capitalização anual simples', () => {
    expect(fator(() => 0.15, 721, inicio)).toBeCloseTo(Math.pow(1.15, 721 / 365), 12)
  })

  it('aplica a taxa de cada ano só nos dias daquele ano', () => {
    // 22/10/2026 até 01/01/2027 são 71 dias; os outros 29 caem em 2027.
    const f = fator(ano => (ano === 2026 ? 0.1 : 0.2), 100, inicio)
    expect(f).toBeCloseTo(Math.pow(1.1, 71 / 365) * Math.pow(1.2, 29 / 365), 12)
  })
})

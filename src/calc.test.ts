import { describe, expect, it } from 'vitest'
import { TAXA_MAX, VALOR_MAX, aliquota, cdiAno, diasDoPrazo, fator, formatarNumero, numeroParaCampo, parseNum } from './calc'

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
    expect(parseNum('14.15')).toBe(14.15)
    expect(parseNum('92.5')).toBe(92.5)
    expect(parseNum('')).toBe(0)
    expect(parseNum('abc')).toBe(0)
  })
})

describe('formatarNumero', () => {
  const R = (s: string, anterior = '') => formatarNumero(s, VALOR_MAX, anterior)

  it('põe os pontos de milhar e só mostra decimais depois da vírgula', () => {
    expect(R('')).toBe('')
    expect(R('0')).toBe('')
    expect(R('1000')).toBe('1.000')
    expect(R('1.0000')).toBe('10.000')
    expect(R('1.000,')).toBe('1.000,')
    expect(R('1.000,5')).toBe('1.000,5')
    expect(R('1.000,567')).toBe('1.000,56')
    expect(R(',5')).toBe('0,5')
    expect(R('1.000.')).toBe('1.000,')
    expect(R('12,3,4')).toBe('12,34')
    expect(R('1.00')).toBe('100')
  })

  it('não passa do máximo', () => {
    expect(R('10.000.000')).toBe('10.000.000')
    expect(R('10.000.0001', '10.000.000')).toBe('10.000.000')
    expect(R('10.000.000,01', '10.000.000,0')).toBe('10.000.000,0')
    expect(formatarNumero('1.0000', TAXA_MAX, '1.000')).toBe('1.000')
    expect(formatarNumero('14,15', TAXA_MAX)).toBe('14,15')
  })

  it('converte números salvos', () => {
    expect(numeroParaCampo(10000, VALOR_MAX)).toBe('10.000')
    expect(numeroParaCampo(1000.5, VALOR_MAX)).toBe('1.000,5')
    expect(numeroParaCampo(15.565, TAXA_MAX)).toBe('15,57')
    expect(numeroParaCampo(0, TAXA_MAX)).toBe('')
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

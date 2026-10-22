import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { FAIXAS, aliquota, cdiAno, diasDoPrazo, fator, formatarReais, parseNum, reaisDeNumero, type Unidade, type UnidadePrazo } from './calc'

const HOJE = new Date()
const ANO0 = HOJE.getFullYear()
const MAX_BARRAS = 10
const CHAVE = 'cdb-lci:v1'
const CAMPOS = ['cdi', 'valor', 'prazo', 'prazo-un', 'cdb', 'cdb-un', 'lci', 'lci-un'] as const

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const valor = (id: (typeof CAMPOS)[number]) => $<HTMLInputElement | HTMLSelectElement>(id).value

/** CDI simulado de cada ano depois do vigente (o vigente é o campo CDI). */
let simulado: Record<number, number> = {}
/** Barra sendo arrastada: o valor segue o dedo a partir de onde ele tocou (y0, v0), sem pular. */
let arrasto: { ano: number; track: HTMLElement; escala: number; y0: number; v0: number } | null = null

const fmt = (v: number, casas: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const pct = (v: number, casas = 2) => fmt(v * 100, casas) + '%'
const aliqTxt = (a: number) => pct(a, 1).replace(',0%', '%')

// ——— guardar no aparelho ———

function salvar() {
  try {
    const campos = Object.fromEntries(CAMPOS.map(id => [id, valor(id)]))
    localStorage.setItem(CHAVE, JSON.stringify({ campos, simulado }))
  } catch {
    // Sem armazenamento (aba privada): o app funciona, só não lembra.
  }
}

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (!salvo) return
    for (const id of CAMPOS) {
      if (typeof salvo.campos?.[id] === 'string') $<HTMLInputElement | HTMLSelectElement>(id).value = salvo.campos[id]
    }
    if (salvo.simulado && typeof salvo.simulado === 'object') simulado = salvo.simulado
  } catch {
    // Dado salvo ilegível: começa do padrão.
  }
}

// ——— cálculo e tela ———

function calc() {
  const inicial = parseNum(valor('valor'))
  const cdi = parseNum(valor('cdi')) / 100
  const uCdb = valor('cdb-un') as Unidade
  const uLci = valor('lci-un') as Unidade
  const vCdb = parseNum(valor('cdb')) / 100
  const vLci = parseNum(valor('lci')) / 100

  // Equivalentes: no prazo digitado, ou no melhor caso (IR 15%), na unidade do outro lado.
  const nPrazo = parseNum(valor('prazo'))
  const unPrazo = valor('prazo-un') as UnidadePrazo
  const dias = diasDoPrazo(nPrazo, unPrazo)
  const aliq = dias > 0 ? aliquota(dias) : 0.15
  const singular = { dias: 'dia', meses: 'mês', anos: 'ano' }[unPrazo]
  const quando = dias > 0 ? `em ${nPrazo.toLocaleString('pt-BR')} ${nPrazo === 1 ? singular : unPrazo}` : 'após 2 anos'
  const anual = (v: number, u: Unidade) => (u === 'cdi' ? v * cdi : v)
  const naUnidade = (t: number, u: Unidade) =>
    u === 'cdi' ? (cdi > 0 ? pct(t / cdi, 1) + ' CDI' : '–') : pct(t) + ' a.a.'

  $('ir-cdb').textContent = `IR ${aliqTxt(aliq)}`
  const equivalente = (texto: string) => `<span>${texto}</span><span class="quando"><i class="dot"></i>${quando}</span>`
  $('eq-cdb').innerHTML = equivalente(`≈ LCI ${naUnidade(anual(vCdb, uCdb) * (1 - aliq), uLci)}`)
  $('eq-lci').innerHTML = equivalente(`≈ CDB ${naUnidade(anual(vLci, uLci) / (1 - aliq), uCdb)}`)

  // Tabela: o fim de cada faixa de IR e, se houver, o prazo digitado.
  const taxa = (v: number, u: Unidade) => (ano: number) => (u === 'cdi' ? v * cdiAno(ano, ANO0, cdi, simulado) : v)
  const linhas: { dias: number; aliq: number; seu?: boolean }[] = FAIXAS.filter(f => f.dias !== dias).map(f => ({ ...f }))
  if (dias > 0) linhas.push({ dias, aliq, seu: true })
  linhas.sort((a, b) => a.dias - b.dias)

  $('linhas').innerHTML = linhas
    .map(l => {
      const rCdb = (fator(taxa(vCdb, uCdb), l.dias, HOJE) - 1) * (1 - l.aliq)
      const rLci = fator(taxa(vLci, uLci), l.dias, HOJE) - 1
      const win = Math.abs(rCdb - rLci) < 1e-9 ? '' : rCdb > rLci ? 'cdb' : 'lci'
      const dinheiro = (v: number) => fmt(v, v >= 100_000 ? 0 : 2)
      const celula = (k: 'cdb' | 'lci', r: number) => `
        <div class="td ${k}${win === k ? ' win' : ''}" role="cell">
          <span class="v">${dinheiro(inicial * (1 + r))}</span>
          <span class="s">+${pct(r)}</span>
        </div>`
      return `
        <div class="tr${l.seu ? ' seu' : ''}" role="row">
          <div class="td" role="cell">
            <span class="v">${l.dias} dias</span>
            <span class="s">IR ${aliqTxt(l.aliq)}</span>
          </div>
          ${celula('cdb', rCdb)}${celula('lci', rLci)}
          <div class="td dif ${win}" role="cell">
            <span class="v">${win ? dinheiro(Math.abs(inicial * (rCdb - rLci))) : '–'}</span>
            <span class="s">${win ? win.toUpperCase() : 'empate'}</span>
          </div>
        </div>`
    })
    .join('')

  renderCurva(cdi, Math.max(721, dias))
  if (!arrasto) salvar() // durante o arraste, salva só ao soltar
}

// ——— gráfico do CDI por ano ———

function renderCurva(base: number, diasMax: number) {
  const fim = new Date(HOJE.getTime() + diasMax * 864e5).getFullYear()
  const anos: number[] = []
  for (let a = ANO0; a <= fim && anos.length < MAX_BARRAS; a++) anos.push(a)
  const vals = anos.map(a => cdiAno(a, ANO0, base, simulado))
  const escala = arrasto ? arrasto.escala : Math.max(0.2, Math.max(...vals) * 1.2)
  const muitas = anos.length > 6

  const box = $('bars')
  if (box.children.length !== anos.length) {
    box.innerHTML = anos
      .map(
        a => `<div class="bar" data-ano="${a}" role="slider" tabindex="0" aria-label="CDI de ${a}"
          aria-valuemin="0" aria-valuemax="100">
          <div class="track"><div class="fill"></div><span class="bv"></span></div>
          <span class="by"></span>
        </div>`,
      )
      .join('')
  }
  box.classList.toggle('many', muitas)
  Array.from(box.children).forEach((el, i) => {
    const a = anos[i]
    const v = vals[i]
    const h = Math.min(100, (v / escala) * 100)
    el.classList.toggle('set', a === ANO0 || a in simulado)
    el.classList.toggle('ativa', arrasto?.ano === a)
    ;(el.querySelector('.fill') as HTMLElement).style.height = h + '%'
    const bv = el.querySelector('.bv') as HTMLElement
    bv.style.bottom = `calc(${h}% + 5px)`
    bv.textContent = muitas ? fmt(v * 100, 1) : pct(v)
    ;(el.querySelector('.by') as HTMLElement).textContent = muitas ? '’' + String(a).slice(2) : String(a)
    el.setAttribute('aria-valuenow', (v * 100).toFixed(2))
    el.setAttribute('aria-valuetext', pct(v))
  })
  box.dataset.escala = String(escala)

  const temSimulado = Object.keys(simulado).length > 0
  $('curva-reset').hidden = !temSimulado
  $('cdi-sim').hidden = !temSimulado
}

function setCdiAno(ano: number, v: number) {
  v = Math.max(0, Math.round(v * 2000) / 2000) // passos de 0,05%
  if (ano === ANO0) $<HTMLInputElement>('cdi').value = fmt(v * 100, 2)
  else simulado[ano] = v
  calc()
}

const bars = $('bars')

function valorDoPonteiro(y: number) {
  const a = arrasto!
  return a.v0 + ((a.y0 - y) / a.track.getBoundingClientRect().height) * a.escala
}

bars.addEventListener('pointerdown', e => {
  const bar = (e.target as HTMLElement).closest<HTMLElement>('.bar')
  if (!bar) return
  e.preventDefault()
  const ano = Number(bar.dataset.ano)
  arrasto = {
    ano,
    track: bar.querySelector('.track')!,
    escala: Number(bars.dataset.escala),
    y0: e.clientY,
    v0: cdiAno(ano, ANO0, parseNum(valor('cdi')) / 100, simulado),
  }
  bars.setPointerCapture(e.pointerId)
  calc() // destaca a barra tocada já no toque
})

// Um recálculo por quadro, com a última posição do dedo.
let quadro = 0
bars.addEventListener('pointermove', e => {
  if (!arrasto) return
  const y = e.clientY
  cancelAnimationFrame(quadro)
  quadro = requestAnimationFrame(() => {
    if (arrasto) setCdiAno(arrasto.ano, valorDoPonteiro(y))
  })
})

// Soltar, cancelar (o sistema tomou o gesto) ou perder a captura: o arraste sempre termina.
const soltar = (e: PointerEvent) => {
  if (!arrasto) return
  cancelAnimationFrame(quadro)
  if (e.type === 'pointerup') setCdiAno(arrasto.ano, valorDoPonteiro(e.clientY))
  arrasto = null
  calc()
}
bars.addEventListener('pointerup', soltar)
bars.addEventListener('pointercancel', soltar)
bars.addEventListener('lostpointercapture', soltar)
bars.addEventListener('keydown', e => {
  const bar = (e.target as HTMLElement).closest<HTMLElement>('.bar')
  const passo = ({ ArrowUp: 0.0025, ArrowRight: 0.0025, ArrowDown: -0.0025, ArrowLeft: -0.0025 } as Record<string, number>)[e.key]
  if (!bar || !passo) return
  e.preventDefault()
  const ano = Number(bar.dataset.ano)
  setCdiAno(ano, cdiAno(ano, ANO0, parseNum(valor('cdi')) / 100, simulado) + passo)
})

$('cdi-abre').addEventListener('click', e => {
  e.preventDefault() // o botão fica dentro do label do CDI
  const curva = $('curva')
  const abrir = curva.dataset.open !== 'true'
  curva.dataset.open = String(abrir)
  curva.inert = !abrir
  $('cdi-abre').setAttribute('aria-expanded', String(abrir))
})
$('curva-reset').addEventListener('click', () => {
  simulado = {}
  calc()
})

// Ao trocar % CDI ↔ % a.a., converte o número pelo CDI atual para o resultado não mudar.
function trocarUnidade(id: 'cdb' | 'lci') {
  const cdi = parseNum(valor('cdi')) / 100
  const v = parseNum(valor(id)) / 100
  if (cdi > 0 && v > 0) {
    const novo = valor(`${id}-un`) === 'cdi' ? v / cdi : v * cdi
    $<HTMLInputElement>(id).value = (novo * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false })
  }
  calc()
}
$('cdb-un').addEventListener('change', () => trocarUnidade('cdb'))
$('lci-un').addEventListener('change', () => trocarUnidade('lci'))
// Nas taxas e no prazo, um ponto digitado vira vírgula (teclados de outros idiomas mostram ponto).
for (const id of ['cdi', 'prazo', 'cdb', 'lci']) {
  const campo = $<HTMLInputElement>(id)
  campo.addEventListener('input', () => {
    if (!campo.value.includes('.')) return
    const cursor = campo.selectionStart
    campo.value = campo.value.replaceAll('.', ',')
    if (cursor !== null) campo.setSelectionRange(cursor, cursor)
  })
}
for (const id of ['cdi', 'prazo', 'prazo-un', 'cdb', 'lci']) $(id).addEventListener('input', calc)

// Valor como na Wise: pontos de milhar automáticos, centavos só com vírgula, 0 de exemplo
// quando vazio e o cursor sempre no fim (digita e apaga só pela direita).
const campoValor = $<HTMLInputElement>('valor')
let valorAnterior = campoValor.value
// Valores na casa dos milhões usam uma letra menor para caber no card.
const ajustarValor = () => campoValor.classList.toggle('longo', campoValor.value.length >= 10)
const cursorNoFim = () => {
  const fim = campoValor.value.length
  if (campoValor.selectionStart !== fim || campoValor.selectionEnd !== fim) campoValor.setSelectionRange(fim, fim)
}
campoValor.addEventListener('input', () => {
  campoValor.value = formatarReais(campoValor.value, valorAnterior)
  valorAnterior = campoValor.value
  cursorNoFim()
  ajustarValor()
  calc()
})
for (const evento of ['focus', 'click', 'keyup', 'select']) campoValor.addEventListener(evento, cursorNoFim)
document.addEventListener('selectionchange', () => {
  if (document.activeElement === campoValor) cursorNoFim()
})

carregar()
// Valor salvo por versões antigas ("10.000,00") vira o formato atual.
campoValor.value = reaisDeNumero(parseNum(campoValor.value))
valorAnterior = campoValor.value
ajustarValor()
calc()

// Procura versão nova ao abrir e sempre que o app volta para a frente.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (!registro) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update()
    })
  },
})

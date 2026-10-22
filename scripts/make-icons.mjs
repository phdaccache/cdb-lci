// Desenha o ícone do app (duas barras sobre verde) em PNG, sem dependências.
// Rodar: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [36, 138, 61]
const FG = [255, 255, 255]
const FG_2 = [167, 214, 178]

// Barras em coordenadas de 0 a 1: x0, x1, topo, base, raio.
const BARRAS = [
  { x0: 0.27, x1: 0.46, y0: 0.42, y1: 0.74, r: 0.06, cor: FG_2 },
  { x0: 0.54, x1: 0.73, y0: 0.26, y1: 0.74, r: 0.06, cor: FG },
]

function crc32(buf) {
  let c
  const table = crc32.t ??= Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y)
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Ponto dentro de um retângulo de cantos arredondados. */
function dentro(u, v, b) {
  const cx = Math.min(Math.max(u, b.x0 + b.r), b.x1 - b.r)
  const cy = Math.min(Math.max(v, b.y0 + b.r), b.y1 - b.r)
  return Math.hypot(u - cx, v - cy) <= b.r && u >= b.x0 && u <= b.x1 && v >= b.y0 && v <= b.y1
}

function icon(size) {
  return png(size, (x, y) => {
    // 4×4 amostras por pixel para bordas suaves.
    const soma = [0, 0, 0]
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const u = (x + (sx + 0.5) / 4) / size
        const v = (y + (sy + 0.5) / 4) / size
        const cor = BARRAS.find(b => dentro(u, v, b))?.cor ?? BG
        for (let i = 0; i < 3; i++) soma[i] += cor[i]
      }
    }
    return soma.map(c => Math.round(c / 16))
  })
}

const rect = (b, cor) =>
  `<rect x="${b.x0 * 100}" y="${b.y0 * 100}" width="${(b.x1 - b.x0) * 100}" height="${(b.y1 - b.y0) * 100}" rx="${b.r * 100}" fill="rgb(${cor})"/>`

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', icon(192))
writeFileSync('public/icons/icon-512.png', icon(512))
writeFileSync('public/icons/apple-touch-icon.png', icon(180))
writeFileSync('public/icons/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="rgb(${BG})"/>
${BARRAS.map(b => rect(b, b.cor)).join('\n')}
</svg>
`)
console.log('ícones gravados em public/icons')

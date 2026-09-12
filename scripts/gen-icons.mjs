// Génère les icônes PNG de la PWA sans dépendance externe.
// Un cadran d'horloge blanc sur fond dégradé indigo — l'identité de Timer.
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.cwd(), 'public')

function crcTable() {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
}
const TABLE = crcTable()
function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filtre "none"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy)

// Distance d'un point au segment [a,b] — sert à tracer les aiguilles.
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function sampleColor(u, v, S, { maskable }) {
  // u,v dans [0,S]. Retourne [r,g,b,a] ou null (transparent).
  const pad = maskable ? 0 : S * 0.06
  const inner = S - pad * 2
  const x = u - pad
  const y = v - pad
  const radius = maskable ? 0 : inner * 0.235

  if (!maskable) {
    if (x < 0 || y < 0 || x > inner || y > inner) return null
    // Coins arrondis
    const cx = Math.min(Math.max(x, radius), inner - radius)
    const cy = Math.min(Math.max(y, radius), inner - radius)
    if (dist(x, y, cx, cy) > radius) return null
  }

  // Fond : dégradé diagonal indigo
  const t = Math.min(1, Math.max(0, (u / S + v / S) / 2))
  const bg = mix([99, 102, 241], [55, 48, 163], t)

  const ccx = S / 2
  const ccy = S / 2
  const r = dist(u, v, ccx, ccy)

  const ringR = S * 0.30
  const ringW = S * 0.055
  if (Math.abs(r - ringR) < ringW / 2) return [255, 255, 255, 255]

  // Aiguilles : 10h10 stylisé (heure vers le haut-gauche, minute vers le haut)
  const hourLen = S * 0.155
  const minLen = S * 0.215
  const hourA = (-140 * Math.PI) / 180
  const minA = (-70 * Math.PI) / 180
  const hx = ccx + Math.cos(hourA) * hourLen
  const hy = ccy + Math.sin(hourA) * hourLen
  const mx = ccx + Math.cos(minA) * minLen
  const my = ccy + Math.sin(minA) * minLen
  if (distSeg(u, v, ccx, ccy, hx, hy) < S * 0.028) return [255, 255, 255, 255]
  if (distSeg(u, v, ccx, ccy, mx, my) < S * 0.024) return [255, 255, 255, 255]
  if (r < S * 0.035) return [255, 255, 255, 255]

  return [bg[0], bg[1], bg[2], 255]
}

function render(size, opts = {}) {
  const SS = 3 // super-échantillonnage pour lisser les bords
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sampleColor(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size, opts)
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += c[3] }
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      const alpha = a / n
      // Pré-moyenne pondérée par alpha pour éviter les franges sombres
      buf[i] = alpha ? Math.round(r / n / (alpha / 255)) : 0
      buf[i + 1] = alpha ? Math.round(g / n / (alpha / 255)) : 0
      buf[i + 2] = alpha ? Math.round(b / n / (alpha / 255)) : 0
      buf[i + 3] = Math.round(alpha)
    }
  }
  return encodePng(size, size, buf)
}

fs.mkdirSync(OUT, { recursive: true })
const files = [
  ['icon-192.png', render(192)],
  ['icon-512.png', render(512)],
  ['icon-maskable-512.png', render(512, { maskable: true })],
  ['apple-touch-icon.png', render(180, { maskable: true })],
]
for (const [name, data] of files) {
  fs.writeFileSync(path.join(OUT, name), data)
  console.log('✓', name, (data.length / 1024).toFixed(1) + ' Ko')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#3730a3"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="3.5"/>
  <path d="M32 32 L32 19.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M32 32 L22.5 39.5" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="2.4" fill="#fff"/>
</svg>
`
fs.writeFileSync(path.join(OUT, 'favicon.svg'), svg)
console.log('✓ favicon.svg')

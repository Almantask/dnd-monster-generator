import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { monsterSlug } from './importExport.ts'

const SHEET_BACKGROUND = '#f4e4c1'
const PAGE_MARGIN_PT = 28

export async function captureStatblockPng(node: HTMLElement): Promise<string> {
  node.classList.add('is-exporting')
  try {
    if (document.fonts?.ready) await document.fonts.ready
    return await toPng(node, {
      pixelRatio: 2,
      backgroundColor: SHEET_BACKGROUND,
      cacheBust: true,
      filter: (el) => {
        if (!(el instanceof Element)) return true
        return !el.hasAttribute('data-dice-marker') && !el.closest('[data-dice-marker]')
      },
    })
  } finally {
    node.classList.remove('is-exporting')
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export async function exportStatblockPng(node: HTMLElement, name: string) {
  const dataUrl = await captureStatblockPng(node)
  downloadDataUrl(dataUrl, `${monsterSlug(name)}.png`)
}

export function pngSizeFromDataUrl(dataUrl: string): { width: number; height: number } {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const bytes = Uint8Array.from(atob(b64.slice(0, 48)), (c) => c.charCodeAt(0))
  const width = readU32(bytes, 16)
  const height = readU32(bytes, 20)
  if (!width || !height) throw new Error('Could not read PNG size')
  return { width, height }
}

export async function exportStatblockPdf(node: HTMLElement, name: string) {
  const dataUrl = await captureStatblockPng(node)
  const pdf = await pngDataUrlToPdf(dataUrl)
  pdf.save(`${monsterSlug(name)}.pdf`)
}

export async function pngDataUrlToPdf(dataUrl: string) {
  const size = pngSizeFromDataUrl(dataUrl)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const usableW = pageW - PAGE_MARGIN_PT * 2
  const usableH = pageH - PAGE_MARGIN_PT * 2
  const scale = usableW / size.width
  const drawnH = size.height * scale

  if (drawnH <= usableH) {
    pdf.addImage(dataUrl, 'PNG', PAGE_MARGIN_PT, PAGE_MARGIN_PT, usableW, drawnH, 'sheet', 'FAST')
    return pdf
  }

  const pageSlicePx = Math.max(1, Math.floor(usableH / scale))
  let sourceY = 0
  let page = 0
  while (sourceY < size.height) {
    const sliceH = Math.min(pageSlicePx, size.height - sourceY)
    const slice = await slicePng(dataUrl, size.width, sourceY, sliceH)
    if (page > 0) pdf.addPage()
    pdf.addImage(
      slice,
      'PNG',
      PAGE_MARGIN_PT,
      PAGE_MARGIN_PT,
      usableW,
      sliceH * scale,
      `sheet-${page}`,
      'FAST',
    )
    sourceY += sliceH
    page += 1
  }
  return pdf
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0
}

function slicePng(dataUrl: string, width: number, sourceY: number, sliceHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = sliceHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas is unavailable'))
        return
      }
      ctx.drawImage(img, 0, sourceY, width, sliceHeight, 0, 0, width, sliceHeight)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load captured statblock'))
    img.src = dataUrl
  })
}

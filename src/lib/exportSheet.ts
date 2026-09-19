import { toCanvas } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { monsterSlug } from './importExport.ts'

const SHEET_BACKGROUND = '#f4e4c1'
const PAGE_MARGIN_PT = 28
const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function captureOptions(pixelRatio: number) {
  return {
    pixelRatio,
    backgroundColor: SHEET_BACKGROUND,
    cacheBust: false,
    skipFonts: true,
    imagePlaceholder: TRANSPARENT_PIXEL,
    onImageErrorHandler: () => undefined,
  }
}

export async function captureStatblockCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  const { host, clone } = await prepareExportClone(node)
  try {
    if (document.fonts?.ready) await document.fonts.ready
    try {
      return await toCanvas(clone, captureOptions(2))
    } catch {
      return await toCanvas(clone, captureOptions(1))
    }
  } finally {
    host.remove()
  }
}

export async function captureStatblockPng(node: HTMLElement): Promise<string> {
  const canvas = await captureStatblockCanvas(node)
  return canvas.toDataURL('image/png')
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
  const canvas = await captureStatblockCanvas(node)
  const pdf = await canvasToPdf(canvas)
  pdf.save(`${monsterSlug(name)}.pdf`)
}

export async function pngDataUrlToPdf(dataUrl: string) {
  return canvasToPdfFromImage(dataUrl, pngSizeFromDataUrl(dataUrl), 'PNG')
}

async function canvasToPdf(canvas: HTMLCanvasElement) {
  const jpeg = canvas.toDataURL('image/jpeg', 0.92)
  return canvasToPdfFromImage(jpeg, { width: canvas.width, height: canvas.height }, 'JPEG')
}

async function canvasToPdfFromImage(
  dataUrl: string,
  size: { width: number; height: number },
  format: 'PNG' | 'JPEG',
) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const usableW = pageW - PAGE_MARGIN_PT * 2
  const usableH = pageH - PAGE_MARGIN_PT * 2
  const scale = usableW / size.width
  const drawnH = size.height * scale

  if (drawnH <= usableH) {
    pdf.addImage(dataUrl, format, PAGE_MARGIN_PT, PAGE_MARGIN_PT, usableW, drawnH, 'sheet', 'FAST')
    return pdf
  }

  const pageSlicePx = Math.max(1, Math.floor(usableH / scale))
  let sourceY = 0
  let page = 0
  while (sourceY < size.height) {
    const sliceH = Math.min(pageSlicePx, size.height - sourceY)
    const slice = await sliceRaster(dataUrl, size.width, sourceY, sliceH)
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

export async function prepareExportClone(node: HTMLElement) {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;background:' +
    SHEET_BACKGROUND
  const width = Math.max(node.getBoundingClientRect().width || node.offsetWidth, 320)
  host.style.width = `${width}px`

  const clone = node.cloneNode(true) as HTMLElement
  clone.classList.add('is-exporting')
  clone.querySelectorAll('[data-dice-marker]').forEach((el) => el.remove())
  host.append(clone)
  document.body.append(host)
  await inlineRemoteImages(clone)
  return { host, clone }
}

export async function inlineRemoteImages(root: HTMLElement) {
  const images = [...root.querySelectorAll('img')]
  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith('data:')) return
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error(String(res.status))
        img.src = await blobToDataUrl(await res.blob())
        img.removeAttribute('srcset')
      } catch {
        img.src = TRANSPARENT_PIXEL
        img.removeAttribute('srcset')
      }
    }),
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0
}

function sliceRaster(dataUrl: string, width: number, sourceY: number, sliceHeight: number): Promise<string> {
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

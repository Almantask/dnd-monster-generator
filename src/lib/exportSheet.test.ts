/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureStatblockPng,
  exportStatblockPdf,
  exportStatblockPng,
  pngSizeFromDataUrl,
  prepareExportClone,
} from './exportSheet.ts'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const toCanvas = vi.fn(async () => {
  const canvas = document.createElement('canvas')
  canvas.toDataURL = ((type?: string) =>
    type?.includes('jpeg') ? 'data:image/jpeg;base64,xx' : TINY_PNG) as HTMLCanvasElement['toDataURL']
  Object.defineProperty(canvas, 'width', { value: 1 })
  Object.defineProperty(canvas, 'height', { value: 1 })
  return canvas
})
const addImage = vi.fn()
const save = vi.fn()

vi.mock('html-to-image', () => ({
  toCanvas: (node: HTMLElement, options?: unknown) => toCanvas(node, options),
}))

vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 595.28, getHeight: () => 841.89 } }
    addImage = (...args: unknown[]) => addImage(...args)
    addPage = vi.fn()
    save = (filename: string) => save(filename)
  },
}))

describe('exportSheet', () => {
  const downloads: string[] = []

  beforeEach(() => {
    downloads.length = 0
    toCanvas.mockClear()
    addImage.mockClear()
    save.mockClear()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads width and height from a PNG data URL', () => {
    expect(pngSizeFromDataUrl(TINY_PNG)).toEqual({ width: 1, height: 1 })
  })

  it('captures the sheet and downloads a PNG named after the monster', async () => {
    const node = document.createElement('article')
    document.body.append(node)

    await exportStatblockPng(node, 'Ash Fang')

    expect(toCanvas).toHaveBeenCalled()
    expect(toCanvas.mock.calls[0]?.[1]).toMatchObject({ cacheBust: false, skipFonts: true })
    expect(node.classList.contains('is-exporting')).toBe(false)
    expect(downloads).toEqual(['ash-fang.png'])
    node.remove()
  })

  it('does not mutate blob image URLs on the live sheet', async () => {
    const blob = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const node = document.createElement('article')
    const img = document.createElement('img')
    img.src = url
    node.append(img)
    document.body.append(node)

    const { host, clone } = await prepareExportClone(node)
    const clonedImg = clone.querySelector('img')
    expect(clonedImg?.src.startsWith('data:')).toBe(true)
    expect(img.src).toBe(url)
    host.remove()
    node.remove()
    URL.revokeObjectURL(url)
  })

  it('retries at 1x if 2x capture fails', async () => {
    toCanvas.mockRejectedValueOnce(new Error('too big'))
    const node = document.createElement('article')
    document.body.append(node)

    await exportStatblockPng(node, 'Ash Fang')

    expect(toCanvas).toHaveBeenCalledTimes(2)
    expect(toCanvas.mock.calls[0]?.[1]).toMatchObject({ pixelRatio: 2 })
    expect(toCanvas.mock.calls[1]?.[1]).toMatchObject({ pixelRatio: 1 })
    expect(downloads).toEqual(['ash-fang.png'])
    node.remove()
  })

  it('builds a one-page PDF and saves it', async () => {
    const node = document.createElement('article')
    document.body.append(node)

    await exportStatblockPdf(node, 'Ash Fang')

    expect(toCanvas).toHaveBeenCalled()
    expect(addImage).toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith('ash-fang.pdf')
    node.remove()
  })

  it('removes the offscreen clone if capture fails', async () => {
    toCanvas.mockRejectedValueOnce(new Error('capture failed'))
    toCanvas.mockRejectedValueOnce(new Error('capture failed'))
    const node = document.createElement('article')
    document.body.append(node)

    await expect(captureStatblockPng(node)).rejects.toThrow('capture failed')
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull()
    node.remove()
  })
})

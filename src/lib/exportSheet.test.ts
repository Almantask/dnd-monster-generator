/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureStatblockPng, exportStatblockPdf, exportStatblockPng, pngSizeFromDataUrl } from './exportSheet.ts'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const toPng = vi.fn(async () => TINY_PNG)
const addImage = vi.fn()
const save = vi.fn()

vi.mock('html-to-image', () => ({
  toPng: (node: HTMLElement, options?: unknown) => toPng(node, options),
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
    toPng.mockClear()
    toPng.mockResolvedValue(TINY_PNG)
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

    expect(toPng).toHaveBeenCalledTimes(1)
    expect(node.classList.contains('is-exporting')).toBe(false)
    expect(downloads).toEqual(['ash-fang.png'])
    node.remove()
  })

  it('builds a one-page PDF and saves it', async () => {
    const node = document.createElement('article')
    document.body.append(node)

    await exportStatblockPdf(node, 'Ash Fang')

    expect(toPng).toHaveBeenCalledTimes(1)
    expect(addImage).toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith('ash-fang.pdf')
    node.remove()
  })

  it('clears the exporting class if capture fails', async () => {
    toPng.mockRejectedValueOnce(new Error('capture failed'))
    const node = document.createElement('article')
    document.body.append(node)

    await expect(captureStatblockPng(node)).rejects.toThrow('capture failed')
    expect(node.classList.contains('is-exporting')).toBe(false)
    node.remove()
  })
})

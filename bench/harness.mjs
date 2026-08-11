import { JSDOM } from 'jsdom'

/**
 * React needs a DOM before `react-dom/client` is imported, so every module that
 * touches React is imported lazily, after this runs.
 */
export const installDom = () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true
  })

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Element = dom.window.Element
  globalThis.Node = dom.window.Node
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  // `navigator` is a read-only accessor on modern Node.
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true
  })

  return dom
}

export const formatOps = (hz) => {
  if (!Number.isFinite(hz)) return 'n/a'
  if (hz >= 1000) return `${Math.round(hz).toLocaleString('en-US')}`
  return hz.toFixed(hz >= 100 ? 0 : 1)
}

export const formatMs = (ms) => {
  if (!Number.isFinite(ms)) return 'n/a'
  if (ms >= 1) return `${ms.toFixed(2)} ms`
  if (ms >= 0.001) return `${(ms * 1000).toFixed(2)} µs`
  return `${Math.round(ms * 1e6)} ns`
}

/** Renders a markdown table from a header row and an array of rows. */
export const table = (headers, rows) => {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length))
  )

  const line = (cells) =>
    `| ${cells.map((cell, index) => String(cell).padEnd(widths[index])).join(' | ')} |`

  return [
    line(headers),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map(line)
  ].join('\n')
}

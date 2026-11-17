/**
 * 64-11 (MED-27 / MED-30 / MED-31) — the brush library's five sections.
 *
 * Laws pinned here:
 *   five always-expanded sections in the fixed order Watercolor, Gouache,
 *   Chalk, Graphite, Acrylic — each keeping its own two-column card grid
 *   every preset card appears under exactly one section, membership matching
 *   the classification table
 *   a group with no member renders no element (proved through the SAME pure
 *   helper the component maps)
 *   the texture strip and the import row stay above the first section and are
 *   never inside a section
 *   no category filter, no search field, no collapse control, no per-section
 *   count
 *   a response card click path calls only pickAquarelleBrush — never a texture
 *   function; a texture chip writes only aquarelleSelectedTextureId
 *
 * Assertion style follows the sibling library test: scalar predicates over the
 * materialized vnode tree (no DOM environment).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BRUSH_PRESETS,
  brushGroupLabels,
  brushGroupOrder,
  brushSections,
} from '@efxlab/efx-watercolor'
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes'
import {
  aquarelleActiveTool,
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  setAquarelleSelectedTextureId,
} from './aquarelleRecordState'
import { setAquarelleSelectMode } from './aquarelleStrokeSelection'
import { clearStrokeThumbCache } from './watercolorStrokeThumb'
import {
  WatercolorBrushLibrary,
  watercolorBrushImportFailure,
  watercolorBrushImporting,
} from './WatercolorBrushLibrary'

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>()
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, () => {}],
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
  }
})

interface TestVNode {
  type: unknown
  props: Record<string, unknown> & { children?: unknown }
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children
  if (children === null || children === undefined || typeof children === 'boolean') return []
  return Array.isArray(children) ? children : [children]
}

function materialize(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node
  if (Array.isArray(node)) return node.map(materialize)
  if (typeof node !== 'object') return node
  const vnode = node as TestVNode
  if (typeof vnode.type === 'function') {
    try {
      return materialize((vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props))
    } catch {
      return vnode
    }
  }
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: childrenOf(vnode).map(materialize),
    },
  } as TestVNode
}

function* walk(node: unknown): Generator<TestVNode> {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child)
    return
  }
  if (typeof node !== 'object') return
  const vnode = node as TestVNode
  yield vnode
  for (const child of childrenOf(vnode)) yield* walk(child)
}

function textContent(node: unknown): string {
  const parts: string[] = []
  const walkText = (current: unknown) => {
    if (typeof current === 'string' || typeof current === 'number') {
      parts.push(String(current))
      return
    }
    if (current === null || current === undefined || typeof current === 'boolean') return
    if (Array.isArray(current)) {
      for (const child of current) walkText(child)
      return
    }
    if (typeof current === 'object') {
      const vnode = current as TestVNode
      if (typeof vnode.type === 'function') {
        try {
          walkText((vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props))
        } catch {
          /* keep walking */
        }
        return
      }
      walkText(vnode.props?.children)
    }
  }
  walkText(node)
  return parts.join(' ')
}

function renderLibrary(): TestVNode {
  return materialize(WatercolorBrushLibrary()) as TestVNode
}

function testIdOf(node: TestVNode): string {
  return String(node.props?.['data-testid'] ?? '')
}

function sectionNodes(tree: TestVNode): TestVNode[] {
  return [...walk(tree)].filter((n) => testIdOf(n).startsWith('watercolor-brush-section-'))
}

function cardNodes(node: unknown): TestVNode[] {
  return [...walk(node)].filter((n) => testIdOf(n).startsWith('watercolor-brush-card-'))
}

function cardIdOf(node: TestVNode): string {
  return testIdOf(node).replace('watercolor-brush-card-', '')
}

/** The section's first child is the title div; the second is its card grid. */
function titleOf(section: TestVNode): string {
  return textContent(childrenOf(section)[0])
}

function gridOf(section: TestVNode): TestVNode {
  return childrenOf(section)[1] as TestVNode
}

function indexOfTestId(tree: TestVNode, testId: string): number {
  return [...walk(tree)].findIndex((n) => testIdOf(n) === testId)
}

const EXPECTED_SECTION_IDS = [
  'watercolor-brush-section-watercolor',
  'watercolor-brush-section-gouache',
  'watercolor-brush-section-pastel',
  'watercolor-brush-section-graphite',
  'watercolor-brush-section-acrylic',
]

const EXPECTED_TITLES = ['Watercolor', 'Gouache', 'Chalk', 'Graphite', 'Acrylic']

// The classification table, restated as counts per section.
const EXPECTED_COUNTS = [11, 2, 6, 2, 2]

/** A minimal canvas stub so getStrokeThumb can paint under node (no DOM). */
function makeStubCanvas(): Record<string, unknown> {
  return {
    width: 0,
    height: 0,
    dataset: {},
    clientWidth: 0,
    clientHeight: 0,
    getContext: () => ({
      setTransform() {},
      clearRect() {},
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData() {},
      drawImage() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      globalAlpha: 1,
    }),
    toDataURL: () => 'data:,',
  }
}

let originalDocument: typeof globalThis.document

function resetSelection(): void {
  aquarelleSelectedTipId.value = null
  aquarelleSelectedTextureId.value = null
  aquarelleActiveTool.value = 'brush'
  aquarelleToolOverrides.value = { ...NEUTRAL_TOOL_OVERRIDES }
  watercolorBrushImporting.value = false
  watercolorBrushImportFailure.value = false
  clearStrokeThumbCache()
  Object.assign(globalThis, {
    document: { createElement: () => makeStubCanvas() },
  })
}

describe('brush library sections (64-11 MED-27)', () => {
  beforeEach(() => {
    originalDocument = globalThis.document
    resetSelection()
  })

  afterEach(() => {
    Object.assign(globalThis, { document: originalDocument })
    setAquarelleSelectMode(false)
  })

  it('renders the five sections in the fixed order', () => {
    const tree = renderLibrary()
    expect(sectionNodes(tree).map(testIdOf)).toEqual(EXPECTED_SECTION_IDS)
  })

  it('titles each section with the D-18 short name', () => {
    const tree = renderLibrary()
    expect(sectionNodes(tree).map(titleOf)).toEqual(EXPECTED_TITLES)
    for (const group of brushGroupOrder) {
      expect(brushGroupLabels[group], `label for ${group}`).toMatch(/\S/)
    }
  })

  it('gives every section its own two-column card grid', () => {
    for (const section of sectionNodes(renderLibrary())) {
      const grid = gridOf(section)
      const style = grid.props?.['style'] as Record<string, unknown> | undefined
      expect(String(style?.['gridTemplateColumns']), `${testIdOf(section)} grid`).toMatch(
        /1fr\s+1fr|repeat\(\s*2\s*,/,
      )
    }
  })

  it('places each preset card under exactly one section, per the classification', () => {
    const tree = renderLibrary()
    const sections = sectionNodes(tree)
    expect(sections.map((section) => cardNodes(section).length)).toEqual(EXPECTED_COUNTS)
    for (let i = 0; i < sections.length; i++) {
      const group = brushGroupOrder[i]!
      const expected = brushSections(BRUSH_PRESETS)[i]!.presets.map((preset) => preset.id)
      expect(cardNodes(sections[i]!).map(cardIdOf), `${group} members`).toEqual(expected)
    }
  })

  it('renders every preset id exactly once across the tree', () => {
    const rendered = cardNodes(renderLibrary()).map(cardIdOf)
    expect(rendered).toHaveLength(BRUSH_PRESETS.length)
    expect(new Set(rendered).size).toBe(BRUSH_PRESETS.length)
    expect([...rendered].sort()).toEqual(BRUSH_PRESETS.map((preset) => preset.id).sort())
  })

  it('omits an empty group through the same pure helper the component maps', () => {
    // Synthetic list exercising the rule without touching the real table.
    const onlyWatercolor = [{ ...BRUSH_PRESETS.find((p) => p.id === 'round')!, group: 'watercolor' as const }]
    expect(brushSections(onlyWatercolor).map((section) => section.group)).toEqual(['watercolor'])
    const noGraphite = BRUSH_PRESETS.filter((preset) => preset.group !== 'graphite')
    expect(brushSections(noGraphite).map((section) => section.group)).toEqual([
      'watercolor',
      'gouache',
      'pastel',
      'acrylic',
    ])
  })

  it('keeps the texture row above the first section and never inside a section', () => {
    const tree = renderLibrary()
    const firstSection = EXPECTED_SECTION_IDS[0]!
    const stripIndex = indexOfTestId(tree, 'watercolor-texture-strip')
    const importRowIndex = indexOfTestId(tree, 'watercolor-brush-import-row')
    const sectionIndex = indexOfTestId(tree, firstSection)
    expect(stripIndex, 'texture strip renders').toBeGreaterThanOrEqual(0)
    expect(importRowIndex, 'import row renders').toBeGreaterThanOrEqual(0)
    expect(stripIndex, 'texture strip above the first section').toBeLessThan(sectionIndex)
    expect(importRowIndex, 'import row above the first section').toBeLessThan(sectionIndex)
    for (const section of sectionNodes(tree)) {
      const ids = [...walk(section)].map(testIdOf)
      expect(ids, `${testIdOf(section)} has no texture strip`).not.toContain('watercolor-texture-strip')
      expect(ids, `${testIdOf(section)} has no import row`).not.toContain(
        'watercolor-brush-import-row',
      )
    }
  })

  it('renders no filter, search, collapse control or per-section count', () => {
    const tree = renderLibrary()
    const nodes = [...walk(tree)]
    expect(nodes.filter((n) => n.type === 'select')).toHaveLength(0)
    expect(
      nodes.filter((n) => n.type === 'input' && n.props?.['type'] === 'search'),
    ).toHaveLength(0)
    for (const node of nodes) {
      expect('aria-expanded' in (node.props ?? {}), 'no collapse control').toBe(false)
      expect(testIdOf(node), 'no collapse element').not.toMatch(/collapse|accordion/i)
    }
    for (const section of sectionNodes(tree)) {
      const title = titleOf(section)
      expect(title, 'a section title carries no count').not.toMatch(/\d/)
    }
  })

  it('pins the texture axis in both directions at the source level', () => {
    const library = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8')
    expect(library, 'the library maps the pure section helper').toMatch(
      /brushSections\(BRUSH_PRESETS\)/,
    )
    expect(library, 'the card pick is the one brush-pick seam').toMatch(
      /void pickAquarelleBrush\(props\.id\)/,
    )
    const pickAt = library.indexOf('void pickAquarelleBrush(props.id)')
    const pickRegion = library.slice(Math.max(0, pickAt - 250), pickAt + 250)
    expect(pickRegion, 'a response pick never touches a texture').not.toMatch(
      /Texture|setAquarelleSelectedTextureId/,
    )

    const strip = readFileSync(resolve(__dirname, 'WatercolorTextureStrip.tsx'), 'utf8')
    expect(strip, 'a texture chip writes the texture id').toContain(
      'setAquarelleSelectedTextureId(',
    )
    expect(strip, 'a texture chip never selects a response').not.toMatch(
      /selectAquarelleTip|pickAquarelleBrush/,
    )
    expect(strip, 'a texture never carries a group').not.toMatch(/brushGroup|\.group\b/)
  })

  it('a texture pick changes neither the selected response nor its group', () => {
    aquarelleSelectedTipId.value = 'flat'
    setAquarelleSelectedTextureId('wc/synthetic-texture')
    expect(aquarelleSelectedTipId.value, 'the response is untouched').toBe('flat')
    expect(brushSections(BRUSH_PRESETS).find((s) => s.presets.some((p) => p.id === 'flat'))!.group).toBe(
      'watercolor',
    )
  })
})

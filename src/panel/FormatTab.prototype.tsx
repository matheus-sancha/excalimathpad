/**
 * PROTOTYPE — throwaway, delete when wayfinder ticket #121 is resolved.
 *
 * Question: how should the Sheet panel's Format tab lay out its controls for an
 * open math line, comment line or title, at the panel's 384 px width?
 * Three variants on the real panel, switched by `?variant=A|B|C`; the open
 * thing is switched by `?target=math|comment|title|none`. Presses change local
 * state only: nothing is written to the sheet.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { ColourDots } from '../overlay/MathElementView.tsx'
import type { FormatColor, TextColor } from '../math/lineForm.ts'
import './FormatTab.prototype.css'

type Target = 'math' | 'comment' | 'title' | 'none'
type Size = 'S' | 'M' | 'L' | 'XL'
type Align = 'left' | 'centre' | 'right'

interface Fmt {
  bold: boolean
  italic: boolean
  underline: boolean
  size: Size
  align: Align
  text: TextColor | null
  highlight: FormatColor | null
}

const DEFAULTS: Record<Exclude<Target, 'none'>, Fmt> = {
  math: { bold: false, italic: false, underline: false, size: 'M', align: 'left', text: null, highlight: null },
  comment: { bold: false, italic: true, underline: false, size: 'M', align: 'left', text: null, highlight: null },
  title: { bold: true, italic: false, underline: false, size: 'M', align: 'left', text: null, highlight: null },
}

const NAMES: Record<Exclude<Target, 'none'>, { where: string; kind: string; source: string }> = {
  math: { where: 'Pipe flow, line 3', kind: 'Math line', source: 'v = Q / A' },
  comment: { where: 'Pipe flow, line 1', kind: 'Comment line', source: '# Pumps and pipes' },
  title: { where: 'Pipe flow', kind: 'Title', source: 'Pipe flow' },
}

const VARIANTS = [
  ['A', 'Labelled rows'],
  ['B', 'The bar, moved as is'],
  ['C', 'Sections with headings'],
] as const

const TARGETS: Target[] = ['math', 'comment', 'title', 'none']

function param(name: string, fallback: string) {
  return new URLSearchParams(window.location.search).get(name) ?? fallback
}

function setParam(name: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(name, value)
  window.history.replaceState(null, '', url)
}

function useParam(name: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => param(name, fallback))
  useEffect(() => {
    const on = () => setValue(param(name, fallback))
    window.addEventListener('prototype-param', on)
    return () => window.removeEventListener('prototype-param', on)
  }, [name, fallback])
  return [
    value,
    (v) => {
      setParam(name, v)
      window.dispatchEvent(new Event('prototype-param'))
    },
  ]
}

/** The tab's content: what the Sheet panel shows under "Format". */
export function FormatTabPrototype() {
  const [variant] = useParam('variant', 'A')
  const [target] = useParam('target', 'math')
  const [formats, setFormats] = useState(DEFAULTS)
  const t = target as Target
  if (t === 'none') return <NothingOpen variant={variant} />
  const fmt = formats[t]
  const set = (next: Partial<Fmt>) => setFormats((all) => ({ ...all, [t]: { ...all[t], ...next } }))
  const props = { target: t, fmt, set }
  return (
    <div className="sheet-panel proto-format">
      {variant === 'A' && <VariantA {...props} />}
      {variant === 'B' && <VariantB {...props} />}
      {variant === 'C' && <VariantC {...props} />}
    </div>
  )
}

interface VariantProps {
  target: Exclude<Target, 'none'>
  fmt: Fmt
  set: (next: Partial<Fmt>) => void
}

function Btn({
  label,
  pressed,
  onClick,
  className = '',
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`math-format-bar__button proto-btn ${className}`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function styleButtons(target: VariantProps['target'], fmt: Fmt, set: VariantProps['set']) {
  return (
    <>
      <Btn label="Bold (Ctrl+B)" pressed={fmt.bold} onClick={() => set({ bold: !fmt.bold })} className="is-bold">
        B
      </Btn>
      {target !== 'math' && (
        <Btn label="Italic (Ctrl+I)" pressed={fmt.italic} onClick={() => set({ italic: !fmt.italic })} className="is-italic">
          I
        </Btn>
      )}
      <Btn
        label="Underline (Ctrl+U)"
        pressed={fmt.underline}
        onClick={() => set({ underline: !fmt.underline })}
        className="is-underline"
      >
        U
      </Btn>
    </>
  )
}

function sizeButtons(fmt: Fmt, set: VariantProps['set']) {
  return (['S', 'M', 'L', 'XL'] as const).map((size) => (
    <Btn key={size} label={`Size ${size}`} pressed={fmt.size === size} onClick={() => set({ size })} className="is-size">
      {size}
    </Btn>
  ))
}

function alignButtons(fmt: Fmt, set: VariantProps['set']) {
  return (
    [
      ['left', 'Align left', '⇤'],
      ['centre', 'Centre', '↔'],
      ['right', 'Align right', '⇥'],
    ] as const
  ).map(([align, label, text]) => (
    <Btn key={align} label={label} pressed={fmt.align === align} onClick={() => set({ align })}>
      {text}
    </Btn>
  ))
}

function dotRow(kind: 'text' | 'highlight', fmt: Fmt, set: VariantProps['set']) {
  // ColourDots draws both rows; each variant hides the one it doesn't want here.
  return (
    <span className={`proto-dots is-only-${kind}`}>
      <ColourDots
        text={fmt.text}
        highlight={fmt.highlight}
        onText={(text) => set({ text })}
        onHighlight={(highlight) => set({ highlight })}
      />
    </span>
  )
}

/** The open thing, drawn with its format: a stand-in for how it reads on the sheet. */
function Sample({ target, fmt }: { target: VariantProps['target']; fmt: Fmt }) {
  const px = target === 'comment' ? { S: 13, M: 15, L: 20, XL: 26 } : { S: 13, M: 16, L: 20, XL: 26 }
  return (
    <div
      className={`proto-sample is-${target} ${fmt.highlight ? `is-hl-${fmt.highlight}` : ''}`}
      style={{
        fontWeight: fmt.bold ? 700 : 400,
        fontStyle: fmt.italic ? 'italic' : 'normal',
        textDecoration: fmt.underline ? 'underline' : 'none',
        fontSize: target === 'math' ? 15 : px[fmt.size],
        textAlign: target === 'title' ? (fmt.align === 'centre' ? 'center' : fmt.align) : 'left',
      }}
      data-text={fmt.text ?? 'default'}
    >
      {NAMES[target].source}
    </div>
  )
}

/** A: one labelled row per property; rows that don't apply are left out. */
function VariantA({ target, fmt, set }: VariantProps) {
  const row = (label: string, controls: ReactNode) => (
    <div className="proto-a__row">
      <span className="proto-a__label">{label}</span>
      <span className="proto-a__controls">{controls}</span>
    </div>
  )
  return (
    <>
      <div className="proto-a__head">
        <span className="proto-a__kind">{NAMES[target].kind}</span>
        <span className="proto-a__where">{NAMES[target].where}</span>
      </div>
      {row('Style', styleButtons(target, fmt, set))}
      {target !== 'math' && row('Size', sizeButtons(fmt, set))}
      {target === 'title' && row('Align', alignButtons(fmt, set))}
      {row('Text', dotRow('text', fmt, set))}
      {row('Highlight', dotRow('highlight', fmt, set))}
      {target === 'math' && <div className="proto-placeholder">Rules (ticket 123) would go here</div>}
    </>
  )
}

/** B: today's floating bar, pinned at the top of the tab, unchanged in size. */
function VariantB({ target, fmt, set }: VariantProps) {
  return (
    <>
      <div className="proto-b__caption">
        {NAMES[target].where} · {NAMES[target].kind.toLowerCase()}
      </div>
      <span className="math-format-bar proto-b__bar">
        <span className="math-format-bar__column">
          <span className="math-format-bar__dot-row">
            {styleButtons(target, fmt, set)}
            {target === 'title' && (
              <>
                <span className="math-format-bar__rule" aria-hidden="true" />
                {alignButtons(fmt, set)}
              </>
            )}
            {target !== 'math' && (
              <>
                <span className="math-format-bar__rule" aria-hidden="true" />
                {sizeButtons(fmt, set)}
              </>
            )}
          </span>
          <ColourDots
            text={fmt.text}
            highlight={fmt.highlight}
            onText={(text) => set({ text })}
            onHighlight={(highlight) => set({ highlight })}
          />
        </span>
      </span>
      {target === 'math' && <div className="proto-placeholder">Rules (ticket 123) would go here</div>}
    </>
  )
}

/** C: a live sample of the open thing on top, then headed sections with large controls. */
function VariantC({ target, fmt, set }: VariantProps) {
  return (
    <>
      <div className="proto-c__preview">
        <div className="proto-c__where">
          {NAMES[target].kind} — {NAMES[target].where}
        </div>
        <Sample target={target} fmt={fmt} />
      </div>
      <section className="proto-c__section">
        <h3>Text style</h3>
        <div className="proto-c__big">
          {styleButtons(target, fmt, set)}
          {target === 'title' && (
            <>
              <span className="proto-c__gap" />
              {alignButtons(fmt, set)}
            </>
          )}
        </div>
        {target !== 'math' && <div className="proto-c__big">{sizeButtons(fmt, set)}</div>}
      </section>
      <section className="proto-c__section">
        <h3>Colours</h3>
        <div className="proto-c__colour">
          <span>Text</span>
          {dotRow('text', fmt, set)}
        </div>
        <div className="proto-c__colour">
          <span>Highlight</span>
          {dotRow('highlight', fmt, set)}
        </div>
      </section>
      {target === 'math' && (
        <section className="proto-c__section">
          <h3>Rules</h3>
          <div className="proto-placeholder">Rules (ticket 123) would go here</div>
        </section>
      )}
    </>
  )
}

function NothingOpen({ variant }: { variant: string }) {
  return (
    <div className="sheet-panel proto-format">
      <p className="sheet-panel__empty">
        {variant === 'B'
          ? 'Nothing to format.'
          : 'Open a line or a title to format it: double-click it, or select its element and press Enter.'}
      </p>
    </div>
  )
}

/** The prototype's own bar, bottom centre: variant ← →, and which thing is open. */
export function PrototypeSwitcher() {
  const [variant, setVariant] = useParam('variant', 'A')
  const [target, setTarget] = useParam('target', 'math')
  const index = Math.max(
    0,
    VARIANTS.findIndex(([key]) => key === variant),
  )
  const step = (d: number) => setVariant(VARIANTS[(index + d + VARIANTS.length) % VARIANTS.length][0])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return
      if (!e.altKey) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })
  if (!import.meta.env.DEV) return null
  return (
    <div className="proto-switcher" onMouseDown={(e) => e.preventDefault()}>
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="proto-switcher__label">
        {VARIANTS[index][0]} — {VARIANTS[index][1]}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
      <span className="proto-switcher__sep" />
      {TARGETS.map((t) => (
        <button key={t} type="button" aria-pressed={t === target} onClick={() => setTarget(t)}>
          {t}
        </button>
      ))}
    </div>
  )
}

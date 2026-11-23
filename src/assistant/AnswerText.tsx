import { Fragment, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useWords } from '../text/words.ts'
import { readAnswer, type Block, type Inline } from './markdown.ts'

/**
 * An answer as the chat draws it (docs/spec-v1.md section 8, Math assistant, An answer): the
 * small Markdown's parts (`markdown.ts`), each as text inside the chat's own elements. Nothing
 * here takes an address, a style or markup from the answer, so no image is loaded, no link can
 * be clicked and no frame or style is made, whatever it says (`AnswerText.test.tsx`).
 *
 * A reference is drawn by `reference`, which the chat gives: a chip, or the label as text.
 * A code block is suggested lines: "not run by the app", with a Copy on each line until the
 * paste of several lines ships (section 8, While editing a line).
 */
export interface AnswerTextProps {
  text: string
  /** Still being written: what may yet turn into something else waits (`readAnswer`). */
  arriving: boolean
  reference: (label: string) => ReactNode
}

/** A chat button: never takes the keyboard, so a line stays open under it. */
const keep = (event: MouseEvent) => event.preventDefault()

export function AnswerText({ text, arriving, reference }: AnswerTextProps) {
  const blocks = useMemo(() => readAnswer(text, arriving), [text, arriving])
  return (
    <div className="assistant-answer">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} reference={reference} />
      ))}
    </div>
  )
}

function BlockView({ block, reference }: { block: Block; reference: (label: string) => ReactNode }) {
  const w = useWords().assistant
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="assistant-answer__paragraph">
          <Lines lines={block.lines} reference={reference} />
        </p>
      )
    case 'list': {
      const items = block.items.map((lines, index) => (
        <li key={index}>
          <Lines lines={lines} reference={reference} />
        </li>
      ))
      return block.ordered ? (
        <ol className="assistant-answer__list" start={block.start === 1 ? undefined : block.start}>
          {items}
        </ol>
      ) : (
        <ul className="assistant-answer__list">{items}</ul>
      )
    }
    case 'code':
      return (
        <div className="assistant-code" data-testid="assistant-code">
          <p className="assistant-code__mark">{w.notRun}</p>
          {block.lines.map((line, index) => (
            <div key={index} className="assistant-code__line">
              {/* A line scrolls sideways inside its block; nothing is cut. */}
              <code className="assistant-code__source">{line || ' '}</code>
              {line.trim() !== '' && <CopyLine line={line} />}
            </div>
          ))}
        </div>
      )
  }
}

function Lines({ lines, reference }: { lines: readonly Inline[][]; reference: (label: string) => ReactNode }) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      <Parts parts={line} reference={reference} />
    </Fragment>
  ))
}

function Parts({ parts, reference }: { parts: readonly Inline[]; reference: (label: string) => ReactNode }) {
  return parts.map((part, index) => {
    switch (part.kind) {
      case 'text':
        return <Fragment key={index}>{part.text}</Fragment>
      case 'bold':
        return (
          <strong key={index}>
            <Parts parts={part.parts} reference={reference} />
          </strong>
        )
      case 'code':
        return (
          <code key={index} className="assistant-answer__code">
            {part.text}
          </code>
        )
      case 'ref':
        return <Fragment key={index}>{reference(part.label)}</Fragment>
    }
  })
}

/** How long a Copy says "Copied". */
const COPIED_MS = 1500

/** One suggested line's Copy: the line as written, onto the clipboard of the button's own window. */
function CopyLine({ line }: { line: string }) {
  const w = useWords().assistant
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      className="assistant-code__copy"
      tabIndex={-1}
      onMouseDown={keep}
      onClick={(event) => {
        // In an Obsidian pop-out the button's window isn't the code's.
        const clipboard = event.currentTarget.ownerDocument.defaultView?.navigator.clipboard
        // Where the clipboard refuses, the line stays there to select by hand.
        clipboard?.writeText(line).then(
          () => setCopied(true),
          () => {},
        )
      }}
    >
      {copied ? w.copied : w.copy}
    </button>
  )
}

import { useState } from 'react'
import { STATBLOCK_GENERATOR_PROMPT } from '@shared/importAdapter.ts'

interface PromptGuideProps {
  onFillExample?: () => void
}

export function PromptGuide({ onFillExample }: PromptGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(STATBLOCK_GENERATOR_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API fails
      setCopied(false)
    }
  }

  return (
    <div className="rounded border border-oxblood/30 bg-parchment/60 p-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-oxblood hover:text-oxblood-dark focus:outline-none"
          aria-expanded={isOpen}
        >
          <span
            className={`inline-block transform transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          >
            ▶
          </span>
          <span>Instructions: Statblock Generator Prompt</span>
        </button>

        <div className="flex items-center gap-2">
          {onFillExample ? (
            <button
              type="button"
              onClick={onFillExample}
              className="rounded border border-oxblood/40 bg-statblock px-2.5 py-1 text-xs font-display uppercase text-oxblood hover:bg-oxblood/10"
              title="Insert the example Samogitian Knight JSON into the editor"
            >
              Insert Example JSON
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded bg-oxblood px-3 py-1 text-xs font-display uppercase tracking-wider text-parchment transition hover:bg-oxblood-dark"
          >
            {copied ? '✓ Copied!' : '📋 Copy Prompt'}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="mt-3 space-y-3 border-t border-oxblood/20 pt-3">
          <p className="text-xs italic text-ink/75">
            Copy and paste this prompt into your preferred AI (ChatGPT, Claude, Gemini, etc.) with your creature
            description, then copy the resulting JSON output below.
          </p>
          <div className="relative">
            <pre className="max-h-96 overflow-auto rounded border border-oxblood/20 bg-statblock p-3 font-mono text-xs text-ink/90 whitespace-pre-wrap select-all">
              {STATBLOCK_GENERATOR_PROMPT}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}

import { useState } from 'react'
import { Check, ChevronRight, Copy, FileJson } from 'lucide-react'
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
    <div className="panel-inset p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-oxblood hover:text-oxblood-dark"
          aria-expanded={isOpen}
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
          <span>Instructions: Statblock Generator Prompt</span>
        </button>

        <div className="flex items-center gap-2">
          {onFillExample ? (
            <button
              type="button"
              onClick={onFillExample}
              className="btn btn-outline btn-sm"
              title="Insert the example Samogitian Knight JSON into the editor"
            >
              <FileJson className="size-3.5" aria-hidden="true" />
              Insert Example JSON
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-primary btn-sm"
          >
            {copied ? (
              <Check className="anim-pop size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="anim-fade mt-3 space-y-3 border-t border-oxblood/20 pt-3">
          <p className="text-xs italic text-ink/75">
            Copy and paste this prompt into your preferred AI (ChatGPT, Claude, Gemini, etc.) with your creature
            description, then copy the resulting JSON output below.
          </p>
          <div className="relative">
            <pre className="max-h-96 overflow-auto rounded-md border border-oxblood/20 bg-statblock p-3 font-mono text-xs text-ink/90 whitespace-pre-wrap select-all">
              {STATBLOCK_GENERATOR_PROMPT}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}

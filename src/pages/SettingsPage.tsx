import { useEffect, useState, type ReactNode } from 'react'
import { CircleAlert, Save, Settings as SettingsIcon } from 'lucide-react'
import { fetchStatus } from '@/lib/api.ts'
import { getApiUrl, getPassphrase, setApiUrl, setPassphrase } from '@/lib/settings.ts'

type Tone = 'ok' | 'warn' | 'off'

const DOT: Record<Tone, string> = {
  ok: 'bg-verdigris',
  warn: 'bg-gold',
  off: 'bg-ink/25',
}

function StatusRow({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <span aria-hidden="true" className={`status-dot ${DOT[tone]}`} />
      <span>{children}</span>
    </li>
  )
}

export function SettingsPage() {
  const [apiUrl, setApiUrlState] = useState(getApiUrl())
  const [passphrase, setPassphraseState] = useState(getPassphrase())
  const [status, setStatus] = useState<{
    gemini: boolean
    geminiQuotaExceeded?: boolean
    geminiQuotaResetInMs?: number
    openrouter: boolean
    cloudflare: boolean
    pollinations: boolean
    passphraseRequired: boolean
  } | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchStatus()
      .then(setStatus)
      .catch(() => setError('Could not reach the Cloud Run API. Set the API URL below.'))
  }, [])

  return (
    <form
      className="panel mx-auto max-w-xl space-y-5 p-6"
      onSubmit={(e) => {
        e.preventDefault()
        setApiUrl(apiUrl)
        setPassphrase(passphrase)
        setSaved(true)
      }}
    >
      <div>
        <h2 className="section-heading flex items-center gap-2 text-2xl">
          <SettingsIcon className="text-oxblood/70 size-5" aria-hidden="true" />
          Settings
        </h2>
        <hr className="stat-rule mt-2" />
      </div>
      <p className="text-ink/75 text-sm italic">
        API keys live on Cloud Run, not in this browser. You only need a passphrase if the server was
        deployed with <code>GENERATION_PASSPHRASE</code>.
      </p>
      <label className="block">
        <span className="field-label mb-1">Cloud Run API URL</span>
        <input
          className="field"
          value={apiUrl}
          onChange={(e) => setApiUrlState(e.target.value)}
          placeholder="https://bestiary-xxxxx.run.app"
        />
      </label>
      <label className="block">
        <span className="field-label mb-1">Generation passphrase</span>
        <input
          type="password"
          className="field"
          value={passphrase}
          onChange={(e) => setPassphraseState(e.target.value)}
        />
      </label>
      {status ? (
        <div className="panel-inset anim-fade px-4 py-2">
          <p className="field-label pt-1 pb-1">Provider status</p>
          <ul className="divide-oxblood/10 divide-y text-sm">
            <StatusRow tone={status.gemini ? (status.geminiQuotaExceeded ? 'warn' : 'ok') : 'off'}>
              Google AI Studio (Gemini Flash + Gemini images):{' '}
              {status.gemini
                ? status.geminiQuotaExceeded
                  ? 'quota exceeded (using fallback)'
                  : 'configured'
                : 'not set'}
            </StatusRow>
            <StatusRow tone={status.openrouter ? 'ok' : 'off'}>
              OpenRouter (fallback): {status.openrouter ? 'configured' : 'not set'}
            </StatusRow>
            <StatusRow tone={status.cloudflare ? 'ok' : 'off'}>
              Cloudflare Workers AI (free FLUX): {status.cloudflare ? 'configured' : 'not set'}
            </StatusRow>
            <StatusRow tone={status.pollinations ? 'ok' : 'warn'}>
              Pollinations (FLUX fallback):{' '}
              {status.pollinations ? 'secret key (gen API)' : 'anonymous (legacy endpoint)'}
            </StatusRow>
            <StatusRow tone={status.passphraseRequired ? 'warn' : 'off'}>
              Passphrase required: {status.passphraseRequired ? 'yes' : 'no'}
            </StatusRow>
          </ul>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="anim-pop border-oxblood/50 bg-oxblood/10 text-oxblood-dark flex items-center gap-2 rounded border p-3 text-sm"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary">
          <Save className="size-4" aria-hidden="true" />
          Save
        </button>
        {saved ? (
          <p role="status" className="anim-fade text-verdigris text-sm italic">
            Saved in this browser.
          </p>
        ) : null}
      </div>
    </form>
  )
}

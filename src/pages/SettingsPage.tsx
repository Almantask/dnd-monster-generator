import { useEffect, useState } from 'react'
import { fetchStatus } from '@/lib/api.ts'
import { getApiUrl, getPassphrase, setApiUrl, setPassphrase } from '@/lib/settings.ts'

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
      className="mx-auto max-w-xl space-y-4 rounded border border-oxblood/40 bg-statblock p-6"
      onSubmit={(e) => {
        e.preventDefault()
        setApiUrl(apiUrl)
        setPassphrase(passphrase)
        setSaved(true)
      }}
    >
      <h2 className="font-display text-2xl text-oxblood uppercase">Settings</h2>
      <p className="text-sm italic">
        API keys live on Cloud Run, not in this browser. You only need a passphrase if the server was
        deployed with <code>GENERATION_PASSPHRASE</code>.
      </p>
      <label className="block">
        <span className="font-display text-sm uppercase text-oxblood">Cloud Run API URL</span>
        <input
          className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
          value={apiUrl}
          onChange={(e) => setApiUrlState(e.target.value)}
          placeholder="https://bestiary-xxxxx.run.app"
        />
      </label>
      <label className="block">
        <span className="font-display text-sm uppercase text-oxblood">Generation passphrase</span>
        <input
          type="password"
          className="mt-1 w-full rounded border border-oxblood/40 bg-parchment px-3 py-2"
          value={passphrase}
          onChange={(e) => setPassphraseState(e.target.value)}
        />
      </label>
      {status ? (
        <ul className="text-sm">
          <li>
            Google AI Studio (Gemini Flash + Gemini images):{' '}
            {status.gemini
              ? status.geminiQuotaExceeded
                ? 'quota exceeded (using fallback)'
                : 'configured'
              : 'not set'}
          </li>
          <li>OpenRouter (fallback): {status.openrouter ? 'configured' : 'not set'}</li>
          <li>Cloudflare Workers AI (free FLUX): {status.cloudflare ? 'configured' : 'not set'}</li>
          <li>Pollinations (FLUX fallback): {status.pollinations ? 'secret key (gen API)' : 'anonymous (legacy endpoint)'}</li>
          <li>Passphrase required: {status.passphraseRequired ? 'yes' : 'no'}</li>
        </ul>
      ) : null}
      {error ? <p className="text-oxblood">{error}</p> : null}
      {saved ? <p>Saved in this browser.</p> : null}
      <button type="submit" className="rounded bg-oxblood px-4 py-2 font-display text-parchment uppercase">
        Save
      </button>
    </form>
  )
}

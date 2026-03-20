import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { completeSetup, testService } from '../lib/api'

type FormState = {
  lidarr: { url: string; apiKey: string; skipTlsVerify: boolean }
  listenbrainz: { username: string; token: string }
  lastfm: { username: string; apiKey: string }
  ai: { provider: string; model: string; apiKey: string; baseUrl: string }
}

type TestResults = {
  lidarr: boolean | null
  listenbrainz: boolean | null
  lastfm: boolean | null
  ai: boolean | null
}

type TestingState = {
  lidarr: boolean
  listenbrainz: boolean
  lastfm: boolean
  ai: boolean
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current

        return (
          <div key={step} className="flex items-center">
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border',
                active
                  ? 'bg-accent text-bg border-accent'
                  : done
                    ? 'bg-approve text-bg border-approve'
                    : 'bg-surface text-muted border-border',
              ].join(' ')}
            >
              {done ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-label="Step complete"
                  role="img"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step
              )}
            </div>
            {i < total - 1 && (
              <div className={['h-px w-12', done ? 'bg-approve' : 'bg-border'].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

function StepLidarr({
  form,
  onFormChange,
  testing,
  onTest,
}: {
  form: FormState['lidarr']
  onFormChange: (v: FormState['lidarr']) => void
  testing: boolean
  onTest: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">Connect Lidarr</h2>
        <p className="text-sm text-muted mt-1">
          Lidarr manages your music library. This is required.
        </p>
      </div>
      <Field label="Lidarr URL" id="lidarr-url">
        <Input
          id="lidarr-url"
          type="url"
          placeholder="http://localhost:8686"
          value={form.url}
          onChange={(e) => onFormChange({ ...form, url: e.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={form.skipTlsVerify}
          onChange={(e) => onFormChange({ ...form, skipTlsVerify: e.target.checked })}
          className="rounded border-border"
        />
        Skip TLS verification
      </label>
      <Field label="API Key" id="lidarr-apikey">
        <Input
          id="lidarr-apikey"
          type="password"
          placeholder="Your Lidarr API key"
          value={form.apiKey}
          onChange={(e) => onFormChange({ ...form, apiKey: e.target.value })}
        />
      </Field>
      <Button onClick={onTest} disabled={!form.url || !form.apiKey || testing} className="w-full">
        {testing ? 'Testing...' : 'Test & Continue'}
      </Button>
    </div>
  )
}

function StepSources({
  form,
  onFormChange,
  testing,
  results,
  onTestListenbrainz,
  onTestLastfm,
  onContinue,
}: {
  form: FormState
  onFormChange: (
    key: 'listenbrainz' | 'lastfm',
    v: FormState['listenbrainz'] | FormState['lastfm'],
  ) => void
  testing: TestingState
  results: TestResults
  onTestListenbrainz: () => void
  onTestLastfm: () => void
  onContinue: () => void
}) {
  const canContinue = results.listenbrainz === true || results.lastfm === true

  function sourceStatus(key: 'listenbrainz' | 'lastfm') {
    if (testing[key]) return 'Testing...'
    if (results[key] === true) return 'Connected'
    if (results[key] === false) return 'Failed'
    return null
  }

  const lbStatus = sourceStatus('listenbrainz')
  const lfStatus = sourceStatus('lastfm')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Listening Sources</h2>
        <p className="text-sm text-muted mt-1">
          At least one source is required to track your music history.
        </p>
      </div>

      {/* ListenBrainz */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">ListenBrainz</span>
          <a
            href="https://listenbrainz.org/settings/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Get your token
          </a>
          {lbStatus && (
            <span
              className={`text-xs ${results.listenbrainz === true ? 'text-approve' : testing.listenbrainz ? 'text-muted' : 'text-reject'}`}
            >
              {lbStatus}
            </span>
          )}
        </div>
        <Field label="Username" id="lb-username">
          <Input
            id="lb-username"
            placeholder="your-username"
            value={form.listenbrainz.username}
            onChange={(e) =>
              onFormChange('listenbrainz', { ...form.listenbrainz, username: e.target.value })
            }
          />
        </Field>
        <Field label="User Token" id="lb-token">
          <Input
            id="lb-token"
            type="password"
            placeholder="ListenBrainz user token"
            value={form.listenbrainz.token}
            onChange={(e) =>
              onFormChange('listenbrainz', { ...form.listenbrainz, token: e.target.value })
            }
          />
        </Field>
        <Button
          variant="outline"
          size="sm"
          onClick={onTestListenbrainz}
          disabled={!form.listenbrainz.username || !form.listenbrainz.token || testing.listenbrainz}
        >
          {testing.listenbrainz ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>

      {/* Last.fm */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Last.fm</span>
          <a
            href="https://www.last.fm/api/account/create"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Create API account
          </a>
          {lfStatus && (
            <span
              className={`text-xs ${results.lastfm === true ? 'text-approve' : testing.lastfm ? 'text-muted' : 'text-reject'}`}
            >
              {lfStatus}
            </span>
          )}
        </div>
        <Field label="Username" id="lfm-username">
          <Input
            id="lfm-username"
            placeholder="your-username"
            value={form.lastfm.username}
            onChange={(e) => onFormChange('lastfm', { ...form.lastfm, username: e.target.value })}
          />
        </Field>
        <Field label="API Key" id="lfm-apikey">
          <Input
            id="lfm-apikey"
            type="password"
            placeholder="Last.fm API key"
            value={form.lastfm.apiKey}
            onChange={(e) => onFormChange('lastfm', { ...form.lastfm, apiKey: e.target.value })}
          />
        </Field>
        <Button
          variant="outline"
          size="sm"
          onClick={onTestLastfm}
          disabled={!form.lastfm.username || !form.lastfm.apiKey || testing.lastfm}
        >
          {testing.lastfm ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>

      <Button onClick={onContinue} disabled={!canContinue} className="w-full">
        Continue
      </Button>
    </div>
  )
}

function StepAi({
  form,
  onFormChange,
  testing,
  onTest,
}: {
  form: FormState['ai']
  onFormChange: (v: FormState['ai']) => void
  testing: boolean
  onTest: () => void
}) {
  const needsApiKey = form.provider !== 'ollama' && form.provider !== 'openai-compatible'
  const apiKeyOptional = form.provider === 'openai-compatible'
  const needsBaseUrl = form.provider === 'ollama' || form.provider === 'openai-compatible'

  const modelOptions: Record<string, Array<{ value: string; label: string }>> = {
    anthropic: [
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast, cheapest)' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
      { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most capable)' },
    ],
    openai: [
      { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (fast, cheapest)' },
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (balanced)' },
      { value: 'gpt-5.4', label: 'GPT-5.4 (most capable)' },
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (fast, cheapest)' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (most capable)' },
    ],
    ollama: [],
  }

  const apiKeyLinks: Record<string, { url: string; label: string }> = {
    anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Get API key' },
    openai: { url: 'https://platform.openai.com/api-keys', label: 'Get API key' },
    gemini: { url: 'https://aistudio.google.com/app/apikey', label: 'Get API key' },
  }

  const link = apiKeyLinks[form.provider]
  const models = modelOptions[form.provider] ?? []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">AI Provider</h2>
        <p className="text-sm text-muted mt-1">Used to generate music recommendations. Required.</p>
      </div>
      <Field label="Provider" id="ai-provider">
        <Select
          id="ai-provider"
          value={form.provider}
          onChange={(e) => onFormChange({ ...form, provider: e.target.value, model: '' })}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="gemini">Google Gemini</option>
          <option value="ollama">Ollama (local)</option>
          <option value="openai-compatible">OpenAI-Compatible</option>
        </Select>
      </Field>
      <Field label="Model" id="ai-model">
        {models.length > 0 ? (
          <Select
            id="ai-model"
            value={form.model}
            onChange={(e) => onFormChange({ ...form, model: e.target.value })}
          >
            <option value="">Select a model</option>
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="ai-model"
            placeholder="llama4"
            value={form.model}
            onChange={(e) => onFormChange({ ...form, model: e.target.value })}
          />
        )}
      </Field>
      {(needsApiKey || apiKeyOptional) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="ai-apikey" className="text-sm text-muted">
              {apiKeyOptional ? 'API Key (optional)' : 'API Key'}
            </label>
            {link && (
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                {link.label}
              </a>
            )}
          </div>
          <Input
            id="ai-apikey"
            type="password"
            placeholder={form.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            value={form.apiKey}
            onChange={(e) => onFormChange({ ...form, apiKey: e.target.value })}
          />
        </div>
      )}
      {needsBaseUrl && (
        <Field label="Base URL" id="ai-baseurl">
          <Input
            id="ai-baseurl"
            type="url"
            placeholder={
              form.provider === 'openai-compatible'
                ? 'http://localhost:8080'
                : 'http://localhost:11434'
            }
            value={form.baseUrl}
            onChange={(e) => onFormChange({ ...form, baseUrl: e.target.value })}
          />
        </Field>
      )}
      {form.provider === 'openai-compatible' && (
        <p className="text-xs text-muted">
          Works with Groq, OpenRouter, LiteLLM, LocalAI, and any OpenAI-compatible endpoint. API key
          is optional for local services.
        </p>
      )}
      <Button
        onClick={onTest}
        disabled={
          !form.model || (needsApiKey && !form.apiKey) || (needsBaseUrl && !form.baseUrl) || testing
        }
        className="w-full"
      >
        {testing ? 'Testing...' : 'Test & Continue'}
      </Button>
    </div>
  )
}

function StepDone({
  form,
  results,
  onStart,
  starting,
}: {
  form: FormState
  results: TestResults
  onStart: () => void
  starting: boolean
}) {
  const sources: string[] = []
  if (results.listenbrainz === true) sources.push('ListenBrainz')
  if (results.lastfm === true) sources.push('Last.fm')

  const rows: { label: string; value: string }[] = [
    { label: 'Lidarr', value: form.lidarr.url },
    { label: 'Listening Sources', value: sources.join(', ') || 'None' },
    {
      label: 'AI Provider',
      value: `${form.ai.provider}${form.ai.model ? ` / ${form.ai.model}` : ''}`,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Ready to go</h2>
        <p className="text-sm text-muted mt-1">Here's what you've configured:</p>
      </div>
      <div className="rounded-lg border border-border bg-surface divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">{row.label}</span>
            <span className="text-sm text-text font-medium">{row.value}</span>
          </div>
        ))}
      </div>
      <Button onClick={onStart} disabled={starting} className="w-full" size="lg">
        {starting ? 'Starting...' : 'Start Digging'}
      </Button>
    </div>
  )
}

const DEFAULT_FORM: FormState = {
  lidarr: { url: '', apiKey: '', skipTlsVerify: false },
  listenbrainz: { username: '', token: '' },
  lastfm: { username: '', apiKey: '' },
  ai: { provider: 'anthropic', model: '', apiKey: '', baseUrl: '' },
}

const DEFAULT_RESULTS: TestResults = {
  lidarr: null,
  listenbrainz: null,
  lastfm: null,
  ai: null,
}

const DEFAULT_TESTING: TestingState = {
  lidarr: false,
  listenbrainz: false,
  lastfm: false,
  ai: false,
}

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [results, setResults] = useState<TestResults>(DEFAULT_RESULTS)
  const [testing, setTesting] = useState<TestingState>(DEFAULT_TESTING)
  const [starting, setStarting] = useState(false)

  function setTestingKey(key: keyof TestingState, val: boolean) {
    setTesting((prev) => ({ ...prev, [key]: val }))
  }

  function setResultKey(key: keyof TestResults, val: boolean | null) {
    setResults((prev) => ({ ...prev, [key]: val }))
  }

  async function testLidarr() {
    setTestingKey('lidarr', true)
    try {
      const res = await testService('lidarr', {
        url: form.lidarr.url,
        apiKey: form.lidarr.apiKey,
        skipTlsVerify: form.lidarr.skipTlsVerify,
      })
      if (res.success) {
        setResultKey('lidarr', true)
        toast.success('Lidarr connected successfully')
        setStep(2)
      } else {
        setResultKey('lidarr', false)
        toast.error(res.message || 'Lidarr connection failed')
      }
    } catch {
      setResultKey('lidarr', false)
      toast.error('Could not reach Lidarr')
    } finally {
      setTestingKey('lidarr', false)
    }
  }

  async function testListenbrainz() {
    setTestingKey('listenbrainz', true)
    try {
      const res = await testService('listenbrainz', {
        username: form.listenbrainz.username,
        token: form.listenbrainz.token,
      })
      if (res.success) {
        setResultKey('listenbrainz', true)
        toast.success('ListenBrainz connected')
      } else {
        setResultKey('listenbrainz', false)
        toast.error(res.message || 'ListenBrainz connection failed')
      }
    } catch {
      setResultKey('listenbrainz', false)
      toast.error('Could not reach ListenBrainz')
    } finally {
      setTestingKey('listenbrainz', false)
    }
  }

  async function testLastfm() {
    setTestingKey('lastfm', true)
    try {
      const res = await testService('lastfm', {
        username: form.lastfm.username,
        apiKey: form.lastfm.apiKey,
      })
      if (res.success) {
        setResultKey('lastfm', true)
        toast.success('Last.fm connected')
      } else {
        setResultKey('lastfm', false)
        toast.error(res.message || 'Last.fm connection failed')
      }
    } catch {
      setResultKey('lastfm', false)
      toast.error('Could not reach Last.fm')
    } finally {
      setTestingKey('lastfm', false)
    }
  }

  async function testAi() {
    setTestingKey('ai', true)
    const config: Record<string, string> = {
      provider: form.ai.provider,
      model: form.ai.model,
    }
    if (form.ai.provider !== 'ollama' && form.ai.provider !== 'openai-compatible')
      config.apiKey = form.ai.apiKey
    if (form.ai.provider === 'openai-compatible' && form.ai.apiKey) config.apiKey = form.ai.apiKey
    if (form.ai.provider === 'ollama' || form.ai.provider === 'openai-compatible')
      config.baseUrl = form.ai.baseUrl
    try {
      const res = await testService('ai', config)
      if (res.success) {
        setResultKey('ai', true)
        toast.success('AI provider connected')
        setStep(4)
      } else {
        setResultKey('ai', false)
        toast.error(res.message || 'AI provider connection failed')
      }
    } catch {
      setResultKey('ai', false)
      toast.error('Could not reach AI provider')
    } finally {
      setTestingKey('ai', false)
    }
  }

  async function handleStart() {
    setStarting(true)
    const config: Record<string, unknown> = {
      lidarrUrl: form.lidarr.url,
      lidarrApiKey: form.lidarr.apiKey,
      skipTlsVerify: form.lidarr.skipTlsVerify,
      aiProvider: form.ai.provider,
      aiModel: form.ai.model,
      aiApiKey: form.ai.apiKey || null,
      aiBaseUrl: form.ai.baseUrl || null,
    }
    if (results.listenbrainz === true) {
      config.listenbrainzUsername = form.listenbrainz.username
      config.listenbrainzToken = form.listenbrainz.token
    }
    if (results.lastfm === true) {
      config.lastfmUsername = form.lastfm.username
      config.lastfmApiKey = form.lastfm.apiKey
    }
    try {
      await completeSetup(config)
      onComplete()
    } catch {
      toast.error('Setup failed -- please try again')
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-3xl font-bold text-accent">digarr</span>
          <p className="text-muted text-sm mt-1">Initial setup</p>
        </div>

        <StepIndicator current={step} total={4} />

        <div className="rounded-lg border border-border bg-surface p-6">
          {step === 1 && (
            <StepLidarr
              form={form.lidarr}
              onFormChange={(v) => setForm((f) => ({ ...f, lidarr: v }))}
              testing={testing.lidarr}
              onTest={testLidarr}
            />
          )}
          {step === 2 && (
            <StepSources
              form={form}
              onFormChange={(key, v) => setForm((f) => ({ ...f, [key]: v }))}
              testing={testing}
              results={results}
              onTestListenbrainz={testListenbrainz}
              onTestLastfm={testLastfm}
              onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepAi
              form={form.ai}
              onFormChange={(v) => setForm((f) => ({ ...f, ai: v }))}
              testing={testing.ai}
              onTest={testAi}
            />
          )}
          {step === 4 && (
            <StepDone form={form} results={results} onStart={handleStart} starting={starting} />
          )}
        </div>

        {step > 1 && step < 4 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="mt-4 text-sm text-muted hover:text-text"
          >
            &larr; Back
          </button>
        )}
      </div>
    </div>
  )
}

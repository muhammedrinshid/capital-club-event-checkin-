import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, ApiError, publicApi } from '../api.js'
import { useAuth } from '../auth.jsx'

const field = 'w-full rounded-xl border border-navy/15 bg-white px-4 py-3.5 text-navy outline-none transition focus:border-sky focus:ring-4 focus:ring-sky/30'
const primary = 'w-full rounded-xl bg-navy py-3.5 font-medium text-white transition hover:bg-deep active:scale-[.99] disabled:opacity-60'

export default function Login() {
  const { signIn } = useAuth()
  const [step, setStep] = useState('credentials') // credentials | otp | setup
  const [form, setForm] = useState({ email: '', password: '' })
  const [mfaToken, setMfaToken] = useState('')
  const [pending, setPending] = useState(null) // login payload while admin must enrol
  const [setupUrl, setSetupUrl] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = (fn) => async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { await fn() } catch (err) {
      setError(err instanceof ApiError ? (err.data?.detail || 'Please check your details and try again.') : 'Cannot reach the server.')
    } finally { setBusy(false) }
  }

  const submitCredentials = run(async () => {
    const data = await publicApi('/auth/login/', form)
    if (data.mfa_required) { setMfaToken(data.mfa_token); setStep('otp'); return }
    if (data.mfa_setup_required) {
      const res = await api('/auth/2fa/setup/', { method: 'POST', token: data.access })
      setPending(data); setSetupUrl(res.config_url); setStep('setup'); return
    }
    signIn(data)
  })

  const submitOtp = run(async () => {
    signIn(await publicApi('/auth/login/otp/', { mfa_token: mfaToken, code }))
  })

  const submitSetup = run(async () => {
    const data = await api('/auth/2fa/confirm/', { method: 'POST', body: { code }, token: pending.access })
    signIn({ ...data, user: data.user })
  })

  const back = () => { setStep('credentials'); setCode(''); setError('') }

  return (
    <main className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy p-14 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-32 -top-32 size-[34rem] rounded-full bg-sky/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-sky/10 blur-3xl" />
        <p className="relative font-display text-2xl tracking-wide">Capital Club Dubai</p>
        <div className="relative max-w-lg">
          <h1 className="font-display text-6xl leading-[1.05]">Every guest, welcomed by name.</h1>
          <p className="mt-6 text-lg text-white/70">Manage events, guest lists and reception check-in for the club.</p>
        </div>
        <p className="relative text-sm text-white/50">DIFC, Dubai</p>
      </section>

      <section className="grid place-items-center bg-mist px-6 py-12 text-navy">
        <div className="w-full max-w-sm anim-rise" key={step}>
          <p className="mb-8 font-display text-2xl lg:hidden">Capital Club Dubai</p>

          {step === 'credentials' && (
            <form onSubmit={submitCredentials} className="space-y-5">
              <div>
                <h2 className="font-display text-4xl">Sign in</h2>
                <p className="mt-2 text-navy/65">Use the email and password the club gave you.</p>
              </div>
              <label className="block space-y-1.5 text-sm font-medium">Email
                <input className={field} type="email" autoComplete="username" required autoFocus
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">Password
                <input className={field} type="password" autoComplete="current-password" required
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
              <Error text={error} />
              <button className={primary} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={submitOtp} className="space-y-5">
              <div>
                <h2 className="font-display text-4xl">Enter your code</h2>
                <p className="mt-2 text-navy/65">Open your authenticator app and type the 6-digit code for Capital Club.</p>
              </div>
              <CodeInput value={code} onChange={setCode} />
              <Error text={error} />
              <button className={primary} disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Verify and sign in'}</button>
              <button type="button" onClick={back} className="w-full text-sm text-navy/60 transition hover:text-navy">Use a different account</button>
            </form>
          )}

          {step === 'setup' && (
            <form onSubmit={submitSetup} className="space-y-5">
              <div>
                <h2 className="font-display text-4xl">Secure your account</h2>
                <p className="mt-2 text-navy/65">Scan this code with an authenticator app, then enter the 6-digit code it shows.</p>
              </div>
              <div className="grid place-items-center rounded-2xl bg-white p-5"><QRCodeSVG value={setupUrl} size={176} /></div>
              <CodeInput value={code} onChange={setCode} />
              <Error text={error} />
              <button className={primary} disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Turn on and sign in'}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

function CodeInput({ value, onChange }) {
  return (
    <input className={`${field} text-center font-mono text-3xl tracking-[.5em]`} inputMode="numeric"
      autoComplete="one-time-code" maxLength={6} autoFocus aria-label="6-digit code" value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} />
  )
}

function Error({ text }) {
  return text ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{text}</p> : null
}

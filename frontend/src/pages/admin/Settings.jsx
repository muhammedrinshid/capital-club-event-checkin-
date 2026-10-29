import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { Badge, btn, btnDanger, btnGhost, Errors, Field, flatErrors, input, PageHeader } from '../../components/ui.jsx'

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`

export default function Settings() {
  const [s, setS] = useState(null)
  const [msg, setMsg] = useState('')
  const [errors, setErrors] = useState([])
  const [files, setFiles] = useState(null)
  const loadFiles = () => api('/media/').then(setFiles)
  useEffect(() => { api('/settings/').then(setS); loadFiles() }, [])

  async function save(e) {
    e.preventDefault(); setErrors([]); setMsg('')
    try { setS(await api('/settings/', { method: 'PATCH', body: s })); setMsg('Saved.') } catch (x) { setErrors(flatErrors(x.data)) }
  }
  if (!s) return null
  const num = (k, label, hint) => <Field label={label} hint={hint}><input type="number" min="0" className={input} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>

  return (
    <>
      <PageHeader title="Settings and files" />
      <form onSubmit={save} className="mb-10 grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Club name"><input className={input} value={s.club_name} onChange={(e) => setS({ ...s, club_name: e.target.value })} /></Field></div>
        {num('default_checkin_minutes', 'Default check-in opening (minutes before start)', 'Used for new events. Each event can override it.')}
        {num('undo_grace_seconds', 'Guest undo window (seconds)', 'How long a guest can undo their own check-in on the kiosk.')}
        {num('reception_unlock_minutes', 'Reception mode lasts (minutes)', 'After this the kiosk returns to guest mode.')}
        <div className="flex items-end gap-3 sm:col-span-2"><button className={btn}>Save settings</button>{msg && <span className="text-sm text-navy/60">{msg}</span>}</div>
        <div className="sm:col-span-2"><Errors list={errors} /></div>
      </form>

      <PageHeader title="Uploaded files" subtitle={files ? `${files.files.length} files, ${mb(files.total_bytes)} in total. ${mb(files.unused_bytes)} is not used by any event.` : ''}>
        <button className={btnGhost} disabled={!files?.unused_bytes} onClick={async () => { if (confirm('Delete every file that no event uses?')) { await api('/media/', { method: 'POST' }); loadFiles() } }}>Clear unused files</button>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {files?.files.map((f) => (
          <div key={f.path} className="overflow-hidden rounded-2xl bg-white">
            <img src={f.url} alt="" className="aspect-video w-full object-cover" loading="lazy" />
            <div className="space-y-2 p-3 text-sm">
              <p className="truncate text-navy/70" title={f.path}>{f.path.split('/').pop()}</p>
              <div className="flex items-center justify-between"><span>{mb(f.size)}</span>{f.in_use ? <Badge>In use</Badge> : <button className={btnDanger} onClick={async () => { await api(`/media/?path=${encodeURIComponent(f.path)}`, { method: 'DELETE' }); loadFiles() }}>Delete</button>}</div>
            </div>
          </div>
        ))}
      </div>
      {files && !files.files.length && <p className="text-navy/55">No uploaded files yet.</p>}
    </>
  )
}

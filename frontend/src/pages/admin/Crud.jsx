import { useEffect, useState } from 'react'
import { api, ApiError } from '../../api.js'
import { Badge, btn, btnDanger, btnGhost, Errors, Field, flatErrors, input, Modal, PageHeader, Table, useList } from '../../components/ui.jsx'

/** One page for list + add/edit + archive (+ optional CSV import). Used by members, rooms, kiosks, users. */
export default function Crud({ title, subtitle, path, columns, fields, importPath, removeLabel = 'Archive', activeKey = 'is_active' }) {
  const [search, setSearch] = useState('')
  const { rows, loading, reload } = useList(path, { search })
  const [modal, setModal] = useState(null) // {row}
  const [importing, setImporting] = useState(false)

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}>
        <input className={`${input} w-56`} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
        {importPath && <button className={btnGhost} onClick={() => setImporting(true)}>Import CSV</button>}
        <button className={btn} onClick={() => setModal({ row: null })}>Add new</button>
      </PageHeader>
      <Table head={[...columns.map((c) => c.label), '']} empty={!loading && !rows.length ? 'Nothing here yet.' : null}>
        {rows.map((r) => (
          <tr key={r.id} className={r[activeKey] === false ? 'opacity-50' : ''}>
            {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(r) : r[c.key] || ''}</td>)}
            <td className="whitespace-nowrap px-4 py-3 text-right">
              <button className={btnGhost} onClick={() => setModal({ row: r })}>Edit</button>
              {r[activeKey] !== false && (
                <button className={btnDanger} onClick={async () => { if (confirm(`${removeLabel} "${r.name || r.full_name || r.label || r.email}"?`)) { await api(`${path}${r.id}/`, { method: 'DELETE' }); reload() } }}>{removeLabel}</button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {modal && <FormModal title={`${modal.row ? 'Edit' : 'Add'} ${title.toLowerCase().replace(/s$/, '')}`} path={path} fields={fields} row={modal.row}
        onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />}
      {importing && <ImportModal path={importPath} onClose={() => { setImporting(false); reload() }} />}
    </>
  )
}

export function FormModal({ title, path, fields, row, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((f) => [f.name, row?.[f.name] ?? (f.type === 'check' ? true : '')])))
  const [options, setOptions] = useState({})
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)

useEffect(() => {
  let isMounted = true;

  async function loadOptions() {
    const selectFields = fields.filter((f) => f.optionsPath);
    const newOptions = {};

    for (const f of selectFields) {
      try {
        const data = await api(f.optionsPath);
        if (isMounted) {
          newOptions[f.name] = data.filter(f.filter || (() => true));
        }
      } catch (err) {
        console.error(`Failed to load options for ${f.name}:`, err);
      }
    }

    if (isMounted) {
      setOptions(newOptions);
    }
  }

  loadOptions();

  return () => {
    isMounted = false;
  };
}, [fields]);
  async function save(e) {
    e.preventDefault(); setBusy(true); setErrors([])
    const body = { ...form }
    fields.forEach((f) => {
      if (f.type === 'password' && !body[f.name]) delete body[f.name]
      if (['select', 'number'].includes(f.type) && body[f.name] === '') body[f.name] = null
    })
    try {
      await api(row ? `${path}${row.id}/` : path, { method: row ? 'PATCH' : 'POST', body })
      onSaved()
    } catch (err) { setErrors(flatErrors(err instanceof ApiError ? err.data : null)) } finally { setBusy(false) }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {fields.filter((f) => !(f.createOnly && row)).map((f) => (
          f.type === 'check' ? (
            <label key={f.name} className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-5 accent-navy" checked={!!form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })} />{f.label}</label>
          ) : (
            <Field key={f.name} label={f.label} hint={f.type === 'password' && row ? 'Leave empty to keep the current password.' : f.hint}>
              {f.type === 'select' ? (
                <select className={input} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} required={f.required}>
                  <option value="">{f.empty || 'None'}</option>
                  {(f.options || options[f.name] || []).map((o) => <option key={o.value ?? o.id} value={o.value ?? o.id}>{o.label ?? o.name ?? o.full_name}</option>)}
                </select>
              ) : (
                <input className={input} type={f.type || 'text'} value={form[f.name] ?? ''} required={f.required && !(f.type === 'password' && row)}
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              )}
            </Field>
          )
        ))}
        <Errors list={errors} />
        <div className="flex justify-end gap-2 pt-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btn} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  )
}

export function ImportModal({ path, onClose, hint = 'full_name, email, phone, company, membership_number', dryRun }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)

  async function run(preview) {
    setBusy(true); setErrors([])
    const fd = new FormData(); fd.append('file', file); if (dryRun) fd.append('dry_run', preview ? 'true' : 'false')
    try { setResult({ ...(await api(path, { method: 'POST', body: fd })), preview }) } catch (e) { setErrors(flatErrors(e.data)) } finally { setBusy(false) }
  }
  const done = result && !result.preview

  return (
    <Modal title="Import from CSV" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-navy/70">Use a CSV with a header row. Columns: <span className="font-medium">{hint}</span>.</p>
        <input type="file" accept=".csv,text/csv" className={input} onChange={(e) => { setFile(e.target.files[0]); setResult(null) }} />
        <Errors list={errors} />
        {result && (
          <div className="space-y-2 rounded-lg bg-white p-4 text-sm">
            <p className="font-medium">{result.preview ? 'Preview: ' : 'Done: '}{result.created} added{result.updated != null ? `, ${result.updated} updated` : ''}, {result.skipped?.length || 0} skipped, {result.errors.length} with errors.</p>
            {[...(result.skipped || []).map((s) => `Row ${s.row}: ${s.name} (${s.reason})`), ...result.errors.map((e) => `Row ${e.row}: ${e.error}`)].slice(0, 8).map((m, i) => <p key={i} className="text-navy/65">{m}</p>)}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
          {dryRun && !done && <button className={btnGhost} disabled={!file || busy} onClick={() => run(true)}>Preview</button>}
          {!done && <button className={btn} disabled={!file || busy} onClick={() => run(false)}>{busy ? 'Working…' : 'Import'}</button>}
        </div>
      </div>
    </Modal>
  )
}

export const Members = () => (
  <Crud title="Members" subtitle="Club members who can host events." path="/members/" importPath="/members/import/" removeLabel="Archive"
    columns={[{ key: 'full_name', label: 'Name' }, { key: 'membership_number', label: 'Number' }, { key: 'company', label: 'Company' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }]}
    fields={[{ name: 'full_name', label: 'Full name', required: true }, { name: 'membership_number', label: 'Membership number' }, { name: 'company', label: 'Company' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }]} />
)

export const Rooms = () => (
  <Crud title="Rooms" subtitle="Rooms available for events." path="/rooms/"
    columns={[{ key: 'name', label: 'Room' }, { key: 'floor', label: 'Floor' }, { key: 'capacity', label: 'Capacity' }, { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'sky' : 'grey'}>{r.is_active ? 'Active' : 'Archived'}</Badge> }]}
    fields={[{ name: 'name', label: 'Room name', required: true }, { name: 'floor', label: 'Floor' }, { name: 'capacity', label: 'Capacity', type: 'number' }, { name: 'is_active', label: 'Active', type: 'check' }]} />
)

export const Kiosks = () => (
  <Crud title="Kiosks" subtitle="Each tablet has its own login. The same password unlocks reception mode." path="/kiosk/devices/" removeLabel="Deactivate"
    columns={[{ key: 'label', label: 'Tablet' }, { key: 'email', label: 'Login email' }, { key: 'room', label: 'Room', render: (r) => r.room ?? 'All rooms' },
      { key: 'last_seen_at', label: 'Last seen', render: (r) => (r.last_seen_at ? new Date(r.last_seen_at).toLocaleString('en-GB') : 'Never') },
      { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'sky' : 'grey'}>{r.is_active ? 'Active' : 'Off'}</Badge> }]}
    fields={[{ name: 'label', label: 'Tablet name', required: true, hint: 'For example: Main lobby tablet' }, { name: 'email', label: 'Login email', type: 'email', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true }, { name: 'room', label: 'Only show events in room', type: 'select', optionsPath: '/rooms/', empty: 'All rooms', hint: 'Leave on all rooms to show every open event.' },
      { name: 'is_active', label: 'Active', type: 'check' }]} />
)

export const Users = () => (
  <Crud title="Users" subtitle="Admins and event coordinators. Kiosk logins are under Kiosks." path="/auth/users/" removeLabel="Deactivate"
    columns={[{ key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role', render: (r) => (r.role === 'kiosk' ? 'Kiosk' : r.role === 'admin' ? 'Club admin' : 'Coordinator') },
      { key: 'is_active', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'sky' : 'grey'}>{r.is_active ? 'Active' : 'Off'}</Badge> }]}
    fields={[{ name: 'full_name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'password', label: 'Password', type: 'password', required: true },
      { name: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'coordinator', label: 'Event coordinator' }, { value: 'admin', label: 'Club admin' }] }, { name: 'is_active', label: 'Active', type: 'check' }]} />
)

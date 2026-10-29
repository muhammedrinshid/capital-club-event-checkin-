import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { Badge, btn, btnDanger, btnGhost, Errors, Field, flatErrors, fmtDate, input, Modal, PageHeader, saveBlob, t5, Table, useList } from '../../components/ui.jsx'

export default function Events() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [f, setF] = useState({ date_from: '', date_to: '', room: '', host: '', coordinator: '', status: '' })
  const { rows, loading, reload } = useList('/events/', f)
  const rooms = useList('/rooms/'), members = useList('/members/', { is_active: true }), users = useList(isAdmin ? '/auth/users/' : '/rooms/', {})
  const [edit, setEdit] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <>
      <PageHeader title={isAdmin ? 'Events' : 'My events'} subtitle="Pick an event to manage its guests and attendance.">
        {isAdmin && <button className={btn} onClick={() => setEdit({})}>Create event</button>}
      </PageHeader>

      <div className="mb-5 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="From"><input type="date" className={input} value={f.date_from} onChange={set('date_from')} /></Field>
        <Field label="To"><input type="date" className={input} value={f.date_to} onChange={set('date_to')} /></Field>
        <Field label="Room"><select className={input} value={f.room} onChange={set('room')}><option value="">All</option>{rooms.rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        {isAdmin && <>
          <Field label="Host"><select className={input} value={f.host} onChange={set('host')}><option value="">All</option>{members.rows.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></Field>
          <Field label="Coordinator"><select className={input} value={f.coordinator} onChange={set('coordinator')}><option value="">All</option>{users.rows.filter((u) => u.role && u.role !== 'kiosk').map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
        </>}
        <Field label="Status"><select className={input} value={f.status} onChange={set('status')}><option value="">All</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></select></Field>
      </div>

      <Table head={['Event', 'When', 'Room', 'Host', 'Coordinator', 'Attendance', '']} empty={!loading && !rows.length ? 'No events match these filters.' : null}>
        {rows.map((e) => (
          <tr key={e.id} className={e.status === 'cancelled' ? 'opacity-50' : ''}>
            <td className="px-4 py-3 font-medium"><Link className="underline-offset-4 hover:underline" to={`/admin/events/${e.id}`}>{e.name}</Link> {e.status === 'cancelled' && <Badge tone="red">Cancelled</Badge>}</td>
            <td className="whitespace-nowrap px-4 py-3">{fmtDate(e.date)}<br /><span className="text-navy/60">{t5(e.start_time)} to {t5(e.end_time)}</span></td>
            <td className="px-4 py-3">{e.room_name}</td>
            <td className="px-4 py-3">{e.host_name || ''}</td>
            <td className="px-4 py-3">{e.coordinator_name || ''}</td>
            <td className="px-4 py-3">{e.checked_in_count} of {e.guest_count}{e.walk_in_count > 0 && <span className="text-navy/55"> ({e.walk_in_count} walk-in)</span>}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              <Link className={btnGhost} to={`/admin/events/${e.id}`}>Guests</Link>
              {isAdmin && e.status === 'scheduled' && <>
                <button className={`${btnGhost} ml-1`} onClick={() => setEdit(e)}>Edit</button>
                <button className={btnDanger} onClick={async () => { if (confirm(`Cancel "${e.name}"? It will leave the kiosk.`)) { await api(`/events/${e.id}/cancel/`, { method: 'POST' }); reload() } }}>Cancel</button>
              </>}
            </td>
          </tr>
        ))}
      </Table>
      {edit && <EventForm event={edit.id ? edit : null} rooms={rooms.rows.filter((r) => r.is_active)} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
    </>
  )
}

const DISPLAY = [['company', 'Company'], ['title', 'Job title'], ['email', 'Email'], ['phone', 'Phone']]

function EventForm({ event, rooms, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: event?.name || '', description: event?.description || '', room: event?.room || '', date: event?.date || '',
    start_time: t5(event?.start_time), end_time: t5(event?.end_time), host: event?.host || '', coordinator: event?.coordinator || '',
    checkin_minutes_before: event?.checkin_minutes_before ?? 60, show_guest_list: event?.show_guest_list || false,
    kiosk_display_fields: event?.kiosk_display_fields || [],
  })
  const [poster, setPoster] = useState(null)
  const [members, setMembers] = useState([])
  const [coordinators, setCoordinators] = useState([])
  const [newHost, setNewHost] = useState(null) // string while typing a new member
  const [conflict, setConflict] = useState(null)
  const [errors, setErrors] = useState([])
  const [suggest, setSuggest] = useState([])
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    api('/members/?is_active=true').then(setMembers)
    api('/auth/users/?is_active=true').then((u) => setCoordinators(u.filter((x) => x.role !== 'kiosk')))
    if (!event) api('/settings/').then((s) => set('checkin_minutes_before', s.default_checkin_minutes))
  }, [])

  // live room clash check with free-room suggestions
  useEffect(() => {
    const { room, date, start_time, end_time } = form
    if (!room || !date || !start_time || !end_time || end_time <= start_time) { setConflict(null); return }
    const t = setTimeout(async () => {
      const q = new URLSearchParams({ room, date, start_time, end_time, ...(event ? { exclude: event.id } : {}) })
      try { setConflict(await api(`/events/check-conflict/?${q}`)) } catch { setConflict(null) }
    }, 400)
    return () => clearTimeout(t)
  }, [form.room, form.date, form.start_time, form.end_time])

  async function addHost() {
    if (!newHost?.trim()) return
    const m = await api('/members/', { method: 'POST', body: { full_name: newHost.trim() } })
    setMembers((x) => [...x, m]); set('host', m.id); setNewHost(null)
  }

  async function save(e) {
    e.preventDefault(); setBusy(true); setErrors([]); setSuggest([])
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, k === 'kiosk_display_fields' ? JSON.stringify(v) : v ?? ''))
    if (poster) fd.append('poster', poster)
    try { await api(event ? `/events/${event.id}/` : '/events/', { method: event ? 'PATCH' : 'POST', body: fd }); onSaved() }
    catch (err) { setErrors(flatErrors(err instanceof ApiError ? err.data : null)); setSuggest(err.data?.suggested_rooms || []) }
    finally { setBusy(false) }
  }

  const toggle = (k) => set('kiosk_display_fields', form.kiosk_display_fields.includes(k) ? form.kiosk_display_fields.filter((x) => x !== k) : [...form.kiosk_display_fields, k])
  const free = (conflict?.has_conflict ? conflict.free_rooms : suggest) || []

  return (
    <Modal title={event ? 'Edit event' : 'Create event'} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Event name"><input className={input} required value={form.name} onChange={(e) => set('name', e.target.value)} /></Field></div>
        <Field label="Date"><input type="date" className={input} required value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Room"><select className={input} required value={form.room} onChange={(e) => set('room', e.target.value)}><option value="">Choose a room</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        <Field label="Starts"><input type="time" className={input} required value={form.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
        <Field label="Ends"><input type="time" className={input} required value={form.end_time} onChange={(e) => set('end_time', e.target.value)} /></Field>

        {(conflict?.has_conflict || suggest.length > 0) && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
            <p className="font-medium">{conflict?.has_conflict ? `This room is booked by ${conflict.conflicts.map((c) => `${c.name} (${t5(c.start_time)} to ${t5(c.end_time)})`).join(', ')}.` : 'This room is already booked at that time.'}</p>
            {free.length > 0 ? <p className="mt-2 flex flex-wrap items-center gap-2">Free rooms: {free.map((r) => <button type="button" key={r.id} onClick={() => { set('room', r.id); setSuggest([]) }} className="rounded-full bg-white px-3 py-1 transition hover:bg-sky/30">{r.name}</button>)}</p> : <p className="mt-1">No other room is free then. Try a different time.</p>}
          </div>
        )}

        <Field label="Host (club member)">
          {newHost === null ? (
            <div className="flex gap-2">
              <select className={input} value={form.host} onChange={(e) => set('host', e.target.value)}><option value="">No host</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
              <button type="button" className={btnGhost} onClick={() => setNewHost('')}>New</button>
            </div>
          ) : (
            <div className="flex gap-2"><input autoFocus className={input} placeholder="Member's full name" value={newHost} onChange={(e) => setNewHost(e.target.value)} /><button type="button" className={btn} onClick={addHost}>Add</button><button type="button" className={btnGhost} onClick={() => setNewHost(null)}>✕</button></div>
          )}
        </Field>
        <Field label="Coordinator"><select className={input} value={form.coordinator} onChange={(e) => set('coordinator', e.target.value)}><option value="">No coordinator</option>{coordinators.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
        <Field label="Check-in opens (minutes before start)" hint="Check-in stays open until the event ends."><input type="number" min="0" max="1440" className={input} value={form.checkin_minutes_before} onChange={(e) => set('checkin_minutes_before', e.target.value)} /></Field>
        <Field label="Poster or logo" hint={event?.poster ? 'Choose a file to replace the current one. Max 5 MB.' : 'Shown on the kiosk. Max 5 MB.'}><input type="file" accept="image/*" className={input} onChange={(e) => setPoster(e.target.files[0])} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea rows={2} className={input} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field></div>

        <fieldset className="space-y-3 rounded-lg bg-white p-4 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">Kiosk privacy</legend>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-navy" checked={form.show_guest_list} onChange={(e) => set('show_guest_list', e.target.checked)} />Show the full guest list on the kiosk. Otherwise names appear only when searched.</label>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="text-navy/65">Show beside each name:</span>{DISPLAY.map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-navy" checked={form.kiosk_display_fields.includes(k)} onChange={() => toggle(k)} />{l}</label>)}</div>
        </fieldset>

        <div className="space-y-3 sm:col-span-2"><Errors list={errors} />
          <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btn} disabled={busy}>{busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}</button></div></div>
      </form>
    </Modal>
  )
}

const BASE = import.meta.env.VITE_API_URL
const KEY = 'cc_session'

export const session = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } },
  set: (s) => localStorage.setItem(KEY, JSON.stringify(s)),
  clear: () => localStorage.removeItem(KEY),
}

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.detail || 'Something went wrong')
    this.status = status
    this.data = data
  }
}

async function send(path, { method = 'GET', body, token, blob } = {}) {
  const isForm = body instanceof FormData
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  if (blob && res.ok) return res.blob()
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

let refreshing = null
async function refresh() {
  const s = session.get()
  if (!s?.refresh) throw new ApiError(401)
  refreshing ??= send('/auth/refresh/', { method: 'POST', body: { refresh: s.refresh } })
    .then((r) => { session.set({ ...s, access: r.access, refresh: r.refresh || s.refresh }); return r.access })
    .finally(() => { refreshing = null })
  return refreshing
}

/** Authenticated call. `token` overrides the stored access token (used for reception mode). */
export async function api(path, opts = {}) {
  const s = session.get()
  try {
    return await send(path, { ...opts, token: opts.token || s?.access })
  } catch (e) {
    if (e.status !== 401 || opts.token || !s?.refresh) throw e
    try {
      return await send(path, { ...opts, token: await refresh() })
    } catch (e2) {
      if (e2.status === 401) { session.clear(); window.location.assign('/login') }
      throw e2
    }
  }
}

export const publicApi = (path, body) => send(path, { method: 'POST', body })

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export interface ApiError extends Error {
  status: number
  data: any
}

export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(json?.error || res.statusText) as ApiError
    err.status = res.status
    err.data = json
    throw err
  }
  return json
}

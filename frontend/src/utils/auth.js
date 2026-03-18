export const EDUCAST_ACCESS = 'educast_access'
export const EDUCAST_REFRESH = 'educast_refresh'
export const EDUCAST_USER = 'educast_user'

export function saveAuth(data) {
  // Backend DRF + SimpleJWT trả access/refresh
  if (data?.access) {
    localStorage.setItem(EDUCAST_ACCESS, data.access)
  }

  if (data?.refresh) {
    localStorage.setItem(EDUCAST_REFRESH, data.refresh)
  }

  if (data?.user) {
    localStorage.setItem(EDUCAST_USER, JSON.stringify(data.user))
  }
}

export function getToken() {
  return localStorage.getItem(EDUCAST_ACCESS)
}

export function getRefreshToken() {
  return localStorage.getItem(EDUCAST_REFRESH)
}

export function getCurrentUser() {
  const raw = localStorage.getItem(EDUCAST_USER)

  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(EDUCAST_ACCESS)
  localStorage.removeItem(EDUCAST_REFRESH)
  localStorage.removeItem(EDUCAST_USER)
}

export function isLoggedIn() {
  return Boolean(getToken())
}
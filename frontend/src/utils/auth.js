export const EDUCAST_ACCESS = 'educast_access'
export const EDUCAST_REFRESH = 'educast_refresh'
export const EDUCAST_USER = 'educast_user'
export const EDUCAST_REMEMBER_ME = 'educast_remember_me'
import i18n from './i18n'
export const AUTH_FORCE_LOGOUT_EVENT = 'educast_force_logout'
export const LOGIN_PATH = '/'

function getItemFromBothStorage(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key)
}

export function saveAuth(data, rememberMe = false) {
  clearAuth()

  const storage = rememberMe ? localStorage : sessionStorage

  if (data?.access) {
    storage.setItem(EDUCAST_ACCESS, data.access)
  }

  if (data?.refresh) {
    storage.setItem(EDUCAST_REFRESH, data.refresh)
  }

  if (data?.user) {
    storage.setItem(EDUCAST_USER, JSON.stringify(data.user))
  }

  localStorage.setItem(EDUCAST_REMEMBER_ME, rememberMe ? 'true' : 'false')
}

export function getToken() {
  return getItemFromBothStorage(EDUCAST_ACCESS)
}

export function getRefreshToken() {
  return getItemFromBothStorage(EDUCAST_REFRESH)
}

export function getCurrentUser() {
  const raw = getItemFromBothStorage(EDUCAST_USER)

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
  localStorage.removeItem(EDUCAST_REMEMBER_ME)

  sessionStorage.removeItem(EDUCAST_ACCESS)
  sessionStorage.removeItem(EDUCAST_REFRESH)
  sessionStorage.removeItem(EDUCAST_USER)
}

export function isLoggedIn() {
  return Boolean(getToken())
}

export function forceLogoutToLogin(reason = i18n.t('authUtils.sessionEnded')) {
  clearAuth()

  window.dispatchEvent(
    new CustomEvent(AUTH_FORCE_LOGOUT_EVENT, {
      detail: { reason },
    })
  )

  if (window.location.pathname !== LOGIN_PATH) {
    window.location.replace(LOGIN_PATH)
  }
}
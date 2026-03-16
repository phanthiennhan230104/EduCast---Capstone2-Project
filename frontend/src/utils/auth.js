export function saveAuth(data) {
  if (data?.token) {
    localStorage.setItem('educast_token', data.token)
  }

  if (data?.user) {
    localStorage.setItem('educast_user', JSON.stringify(data.user))
  }
}

export function getCurrentUser() {
  const raw = localStorage.getItem('educast_user')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem('educast_token')
  localStorage.removeItem('educast_user')
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem('educast_token'))
}
/**
 * Một quy tắc thống nhất cho UI: ưu tiên họ tên (display_name), không có thì username.
 */
export function publicDisplayName(user) {
  if (!user) return ''
  const dn = user.display_name
  if (typeof dn === 'string' && dn.trim()) return dn.trim()
  const un = user.username
  if (typeof un === 'string' && un.trim()) return un.trim()
  return String(user.user_id || '').trim()
}

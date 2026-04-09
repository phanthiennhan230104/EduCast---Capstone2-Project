export function getInitials(user) {
  if (!user) return 'A'

  let name = ''

  if (typeof user === 'string') {
    name = user
  } else if (user.username && user.username.trim()) {
    name = user.username
  } else if (user.display_name && user.display_name.trim()) {
    name = user.display_name
  } else if (user.name && user.name.trim()) {
    name = user.name
  } else {
    name = user.user_id || 'A'
  }

  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

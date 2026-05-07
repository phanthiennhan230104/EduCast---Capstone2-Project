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

  // Nếu name chỉ có 1 ký tự, return luôn
  if (name.length === 1) {
    return name.toUpperCase()
  }

  // Tách theo khoảng trắng để lấy initials
  const parts = name.trim().split(/\s+/)
  
  if (parts.length === 1) {
    // Nếu chỉ có 1 từ, lấy 2 ký tự đầu
    return name.substring(0, 2).toUpperCase()
  }
  
  // Nếu có nhiều từ, lấy chữ cái đầu của 2 từ đầu tiên
  return parts
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

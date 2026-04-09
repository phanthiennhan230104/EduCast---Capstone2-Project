import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { showCancelConfirm } from '../components/create-audio/CancelAudioConfirmModal'

export function useBlockNavigation(shouldBlock) {
  const navigate = useNavigate()

  useEffect(() => {
    let navigateBlocked = false

    // Bắt sự kiện popstate (khi user click back button hoặc thay đổi URL)
    const handlePopState = (e) => {
      if (shouldBlock && !navigateBlocked) {
        e.preventDefault()
        navigateBlocked = true
        
        showCancelConfirm(() => {
          navigateBlocked = false
          window.history.back()
        })
        
        // Đẩy state trở lại để ngăn chặn việc quay lại ngay lập tức
        window.history.pushState(null, '', window.location.href)
      }
    }

    if (shouldBlock) {
      window.history.pushState(null, '', window.location.href)
      window.addEventListener('popstate', handlePopState)
    }

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [shouldBlock])
}

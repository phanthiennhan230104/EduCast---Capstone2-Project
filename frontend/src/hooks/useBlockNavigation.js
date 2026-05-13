import { useEffect } from 'react'
import { showCancelConfirm } from '../components/create-audio/CancelAudioConfirmModal'

export function useBlockNavigation(shouldBlock, onConfirmLeave) {
  useEffect(() => {
    if (!shouldBlock) return

    const handleDocumentClick = (e) => {
      const anchor = e.target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      const target = anchor.getAttribute('target')

      if (!href || href.startsWith('http') || target === '_blank') return

      e.preventDefault()
      e.stopPropagation()

      showCancelConfirm(() => {
        onConfirmLeave?.()
        window.location.href = href
      })
    }

    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [shouldBlock, onConfirmLeave])
}
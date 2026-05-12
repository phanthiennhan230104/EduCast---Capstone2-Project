import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'

export function showCancelConfirm(onConfirm) {
  const t = i18n.t.bind(i18n)

  Modal.confirm({
    title: t('createAudio.cancelConfirm.title'),
    content: t('createAudio.cancelConfirm.content'),
    okText: t('createAudio.cancelConfirm.okText'),
    cancelText: t('createAudio.cancelConfirm.cancelText'),
    okButtonProps: { danger: true },
    onOk() {
      onConfirm?.()
    },
  })
}

export default function CreateAudioModal({ open, onClose, vm }) {
  const handleRequestClose = () => {
    if (vm.genState === 'processing') {
      showCancelConfirm(() => {
        vm.cancelGenerate?.()
        onClose?.()
      })
      return
    }

    onClose?.()
  }

  return (
    <Modal
      open={open}
      onCancel={handleRequestClose}
      footer={null}
      destroyOnClose={false}
      maskClosable
      keyboard
    >
      {/* content */}
    </Modal>
  )
}
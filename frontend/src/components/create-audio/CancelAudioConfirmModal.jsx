import { Modal } from 'antd'
import i18n from '../../utils/i18n'

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
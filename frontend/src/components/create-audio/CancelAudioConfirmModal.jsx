import { Modal } from 'antd'

export function showCancelConfirm(onConfirm) {
  Modal.confirm({
    title: 'Dừng tạo Podcast',
    content: 'Bạn có chắc chắn muốn dừng quá trình tạo Podcast không? Tiến độ sẽ bị mất.',
    okText: 'Có, dừng',
    cancelText: 'Không, tiếp tục',
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
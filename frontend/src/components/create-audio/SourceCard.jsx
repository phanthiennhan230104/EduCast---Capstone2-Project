import {
  Button,
  Card,
  Input,
  Segmented,
  Space,
  Tabs,
  Typography,
  Upload,
} from 'antd'
import {
  DeleteOutlined,
  FileAddOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import styles from '../../style/create-audio/SourceCard.module.css'
import { showCancelConfirm } from './CancelAudioConfirmModal'

const { TextArea } = Input
const { Text } = Typography

export default function SourceCard({ vm }) {
  const tabItems = vm.sourceTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
  }))

  const handleSourceTabChange = (nextTab) => {
    if (nextTab === vm.sourceTab) return

    if (vm.genState === 'processing') {
      showCancelConfirm(() => {
        vm.cancelGenerate?.()
        vm.setSourceTab(nextTab)
      })
      return
    }

    vm.setSourceTab(nextTab)
  }

  return (
    <Card
      className={styles.card}
      title="Nguồn nội dung"
      variant="borderless"
      styles={{
        header: { color: '#fff' },
        body: { paddingTop: 8 },
      }}
    >
      <Tabs activeKey={vm.sourceTab} onChange={handleSourceTabChange} items={tabItems} />

      {vm.sourceTab === 'text' && (
        <Space orientation="vertical" size={16} className={styles.block}>
          <Segmented
            block
            value={vm.aiMode}
            onChange={(value) => {
              if (vm.genState === 'processing') {
                return
              }
              vm.setAiMode(value)
            }}
            disabled={vm.genState === 'processing'}
            options={vm.aiModes.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
          />

          <TextArea
            value={vm.text}
            onChange={(e) => {
              if (vm.genState === 'processing') {
                return
              }
              vm.setText(e.target.value)
            }}
            rows={10}
            disabled={vm.genState === 'processing'}
            placeholder="Dán văn bản, bài giảng, ghi chú hoặc nội dung bất kỳ vào đây..."
            status={vm.textError ? 'error' : ''}
          />

          <Space wrap className={styles.counterRow}>
            <Space wrap>
              <Button 
                icon={<DeleteOutlined />} 
                onClick={vm.clearText}
                disabled={vm.genState === 'processing'}
              >
                Xóa
              </Button>
              <Button 
                icon={<FileAddOutlined />} 
                onClick={vm.fillDemoText}
                disabled={vm.genState === 'processing'}
              >
                Dán văn bản mẫu
              </Button>
            </Space>

            <Text className={styles.helperText}>
              {(vm.text || '').length.toLocaleString()} ký tự · Ước tính: {vm.estLabel}
            </Text>
          </Space>
        </Space>
      )}

      {vm.sourceTab === 'upload' && (
        <Space orientation="vertical" size={16} className={styles.block}>
          <Upload.Dragger
            beforeUpload={(file) => {
              if (vm.genState === 'processing') {
                return false
              }
              vm.handleFile(file)
              return false
            }}
            multiple={false}
            showUploadList={false}
            accept=".pdf,.doc,.docx,.txt,"
            disabled={vm.genState === 'processing'}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Kéo thả hoặc bấm để tải file lên</p>
            <p className="ant-upload-hint">
              Hỗ trợ PDF, DOCX, TXT. Tối đa 25MB.
            </p>
          </Upload.Dragger>

          {vm.file && (
            <Card size="small" className={styles.filePreview}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space orientation="vertical" size={2}>
                  <Text strong className={styles.fileName}>
                    {vm.file.name}
                  </Text>
                  <Text
                    className={
                      vm.fileReady ? styles.fileMetaReady : styles.fileMetaLoading
                    }
                  >
                    {(vm.file.size / 1024 / 1024).toFixed(2)} MB ·{' '}
                    {vm.isUploadingFile
                      ? 'Đang tải và phân tích...'
                      : vm.fileReady
                        ? 'Đã phân tích xong'
                        : 'Chưa sẵn sàng'}
                  </Text>
                </Space>

                <Button 
                  danger 
                  type="text" 
                  onClick={vm.removeFile}
                  disabled={vm.genState === 'processing'}
                >
                  Xóa
                </Button>
              </Space>
            </Card>
          )}
        </Space>
      )}
    </Card>
  )
}
import { ToastContainer } from 'react-toastify'
import 'antd/dist/reset.css'
import 'react-toastify/dist/ReactToastify.css'
import { useEffect } from 'react'
import { Modal } from 'antd'

import MainLayout from '../../components/layout/MainLayout/MainLayout'

import CreateAudioHeader from '../../components/create-audio/CreateAudioHeader'
import SourceCard from '../../components/create-audio/SourceCard'
import VoiceConfigCard from '../../components/create-audio/VoiceConfigCard'
import AllDraftsPanel from '../../components/create-audio/AllDraftsPanel'
import SessionSummaryCard from '../../components/create-audio/SessionSummaryCard'
import GenerateSection from '../../components/create-audio/GenerateSection'
import RecentHistoryCard from '../../components/create-audio/RecentHistoryCard'

import { useCreateAudio } from '../../hooks/useCreateAudio'
import { useBlockNavigation } from '../../hooks/useBlockNavigation'
import styles from '../../style/pages/CreateAudioPage/CreateAudioPage.module.css'

export default function CreateAudioPage() {
  const vm = useCreateAudio()

  // Ngăn chặn người dùng rời khỏi trang khi đang tạo audio với confirmation
  useBlockNavigation(vm.genState === 'processing')

  // Ngăn chặn người dùng rời khỏi tab/cửa sổ khi đang tạo audio
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (vm.genState === 'processing') {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [vm.genState])

  return (
    <>
      <ToastContainer position="top-right" autoClose={2200} theme="dark" />
      <MainLayout rightPanel={null}>
        <div className={styles.container}>
          <div className={styles.contentWrapper}>
            <div className={styles.createAudioHeaderWrapper}>
              <CreateAudioHeader step={vm.step} />
            </div>

            <div className={styles.contentGrid}>
              <div className={styles.leftCol}>
                <SourceCard vm={vm} />
                <VoiceConfigCard vm={vm} />
                <AllDraftsPanel vm={vm} />
              </div>

              <div className={styles.rightCol}>
                <SessionSummaryCard vm={vm} />
                <GenerateSection vm={vm} />
                <RecentHistoryCard vm={vm} />
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </>
  )
}
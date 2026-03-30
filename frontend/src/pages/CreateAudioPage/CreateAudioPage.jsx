import { ToastContainer } from 'react-toastify'
import 'antd/dist/reset.css'
import 'react-toastify/dist/ReactToastify.css'

import MainLayout from '../../components/layout/MainLayout/MainLayout'

import CreateAudioHeader from '../../components/create-audio/CreateAudioHeader'
import SourceCard from '../../components/create-audio/SourceCard'
import VoiceConfigCard from '../../components/create-audio/VoiceConfigCard'
import SessionSummaryCard from '../../components/create-audio/SessionSummaryCard'
import GenerateSection from '../../components/create-audio/GenerateSection'
import RecentHistoryCard from '../../components/create-audio/RecentHistoryCard'

import { useCreateAudio } from '../../hooks/useCreateAudio'
import styles from '../../style/pages/user/CreateAudioPage.module.css'

export default function CreateAudioPage() {
  const vm = useCreateAudio()

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
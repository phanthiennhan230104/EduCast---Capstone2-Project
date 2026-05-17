import { useState } from 'react'
import HeroSection from '../../components/sections/HeroSection'
import PageHeader from '../../components/common/PageHeader'
import FeaturesSection from '../../components/sections/FeaturesSection'
import TestimonialsSection from '../../components/sections/TestimonialsSection'
import MarqueeSection from '../../components/sections/MarqueeSection'
import CtaSection from '../../components/sections/CtaSection'
import Footer from '../../components/layout/Footer/Footer'
import AuthModal from '../../components/authentication/AuthModal'
import styles from '../../style/pages/HomePage/HomePage.module.css'

export default function HomePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  const openLogin = () => {
    setAuthMode('login')
    setIsAuthOpen(true)
  }

  const openSignup = () => {
    setAuthMode('signup')
    setIsAuthOpen(true)
  }

  return (
    <div className={styles.home}>
      <PageHeader onOpenLogin={openLogin} onOpenSignup={openSignup} />

      <main className={styles.main}>
        <HeroSection onOpenLogin={openLogin} />
        <MarqueeSection id="topics" onOpenLogin={openLogin} />
        <FeaturesSection id="community" />
        <TestimonialsSection id="ranking" />
        <CtaSection onOpenSignup={openSignup} onOpenLogin={openLogin} />
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        mode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onChangeMode={setAuthMode}
      />
    </div>
  )
}
import HeroSection from '../../components/sections/HeroSection'
import PageHeader from '../../components/common/PageHeader'
import FeaturesSection from '../../components/sections/FeaturesSection'
import TestimonialsSection from '../../components/sections/TestimonialsSection'
import PopularSection from '../../components/sections/PopularSection'
import QuestionSection from '../../components/sections/QuestionSection'
import Footer from '../../components/layout/Footer/Footer'
import styles from '../../style/pages/HomePage/HomePage.module.css'

export default function HomePage() {
  return (
    <div className={styles.home}>
      <PageHeader />
      <div className={styles.container}>
        <HeroSection />
        <FeaturesSection />
        <TestimonialsSection />
        <PopularSection />
        <QuestionSection />
      </div>
      <Footer />
    </div>
  )
}

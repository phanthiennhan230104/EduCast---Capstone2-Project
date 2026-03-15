import { ArrowRight } from 'lucide-react'
import TestimonialCard from '../cards/TestimonialCard'
import styles from '../../style/sections/TestimonialsSection.module.css'

const TESTIMONIALS = [
  {
    avatar: 'https://i.pravatar.cc/48?img=1',
    name: 'Nguyễn Minh Quân',
    role: 'Kỹ sư phần mềm',
    quote: 'EduCast thay đổi cách tôi học hỏi. Lúc đi xe buýt giờ tôi có thể nghe những bài học tuyệt vời.',
    rating: 5
  },
  {
    avatar: 'https://i.pravatar.cc/48?img=2',
    name: 'Trần Hà My',
    role: 'Chủ kinh doanh',
    quote: 'Podcast về kinh doanh này rất giúp ích cho tôi. Chất lượng nội dung cực tốt!',
    rating: 5
  },
  {
    avatar: 'https://i.pravatar.cc/48?img=3',
    name: 'Lê Hoàng Anh',
    role: 'Sinh viên',
    quote: 'Ứng dụng rất dễ dùng, giao diện đẹp. Tôi yêu thích tính năng tải xuống offline.',
    rating: 5
  }
]

export default function TestimonialsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <ArrowRight size={24} className={styles.icon} />
        <h2 className={styles.title}>NGƯỜI DÙNG NÓI GÌ</h2>
      </div>
      <p className={styles.subtitle}>ĐƯỢC YÊU THÍCH BỞI <span className={styles.highlight}>200+ NGƯỜI DÙNG</span></p>
      <div className={styles.grid}>
        {TESTIMONIALS.map((testimonial, i) => (
          <TestimonialCard key={i} {...testimonial} />
        ))}
      </div>
    </section>
  )
}

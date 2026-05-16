import { Link } from 'react-router-dom'
import styles from '../../../style/layout/Footer.module.css'
import logoImage from '../../../assets/images/educast-logo.png'

export default function Footer() {
  const handleScroll = (e, id) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <img
              src={logoImage}
              alt="EduCast Logo"
              className={styles.logoImage}
            />
          </Link>
          <p className={styles.brandDesc}>
            Nền tảng podcast học thuật kết nối tri thức và cộng đồng.
          </p>
        </div>

        <div className={styles.footerContent}>
          <div className={styles.footerCol} id="about">
            <h4 className={styles.colTitle}>Giới thiệu</h4>
            <p>EduCast biến podcast thành hành trình học tập cộng đồng, nơi bạn lắng nghe, chia sẻ và kết nối với tri thức nhân loại mọi lúc mọi nơi.</p>
          </div>

          <div className={styles.footerCol} id="terms">
            <h4 className={styles.colTitle}>Điều khoản</h4>
            <ul className={styles.colList}>
              <li><a href="#privacy">Chính sách bảo mật</a></li>
              <li><a href="#rules">Quy định cộng đồng</a></li>
              <li><a href="#copyright">Bản quyền nội dung</a></li>
            </ul>
          </div>

          <div className={styles.footerCol} id="contact">
            <h4 className={styles.colTitle}>Liên hệ</h4>
            <ul className={styles.colList}>
              <li>C2SE.30 Team</li>
              <li>Hotline: 0944068045</li>
              <li>Địa chỉ: TP. Đà Nẵng</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>

        <div className={styles.copyright}>
          <p>© 2026 EduCast. Cách học mới của bạn.</p>
        </div>
      </div>
    </footer>
  )
}

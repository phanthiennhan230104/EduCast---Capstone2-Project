import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Music, User, AtSign, Mail, Lock, Eye, Chrome, Facebook } from 'lucide-react'
import styles from '../../style/authentication/AuthModal.module.css'
import { apiRequest } from '../../utils/api'
import { saveAuth } from '../../utils/auth'

export default function AuthModal({ isOpen, mode, onClose, onChangeMode }) {
  const navigate = useNavigate()

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })

  const [signupData, setSignupData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const resetMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target
    setLoginData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSignupChange = (e) => {
    const { name, value, type, checked } = e.target
    setSignupData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!loginData.email.trim() || !loginData.password.trim()) {
      setErrorMessage('Vui lòng nhập email/username và mật khẩu.')
      return
    }

    try {
      setLoading(true)

      const data = await apiRequest('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({
          identifier: loginData.email,
          password: loginData.password,
        }),
      })

      saveAuth(data)
      setSuccessMessage('Đăng nhập thành công.')

      onClose()
      navigate('/feed')
    } catch (error) {
      setErrorMessage(error.message || 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!signupData.fullName.trim()) {
      setErrorMessage('Vui lòng nhập họ tên.')
      return
    }

    if (!signupData.username.trim()) {
      setErrorMessage('Vui lòng nhập username.')
      return
    }

    if (!signupData.email.trim()) {
      setErrorMessage('Vui lòng nhập email.')
      return
    }

    if (!signupData.password.trim()) {
      setErrorMessage('Vui lòng nhập mật khẩu.')
      return
    }

    if (signupData.password.length < 6) {
      setErrorMessage('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    if (signupData.password !== signupData.confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.')
      return
    }

    if (!signupData.agreeTerms) {
      setErrorMessage('Bạn cần đồng ý Điều khoản dịch vụ.')
      return
    }

    try {
      setLoading(true)

      const data = await apiRequest('/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          full_name: signupData.fullName,
          username: signupData.username,
          email: signupData.email,
          password: signupData.password,
          confirm_password: signupData.confirmPassword,
        }),
      })

      saveAuth(data)
      setSuccessMessage('Đăng ký thành công.')

      onClose()
      navigate('/feed')
    } catch (error) {
      setErrorMessage(error.message || 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} type="button">
          <X size={18} />
        </button>

        <div className={styles.leftPanel}>
          <div className={styles.brandIcon}>
            <Music size={30} />
          </div>

          <h2 className={styles.brandTitle}>EduCast</h2>
          <p className={styles.brandSub}>AI-Powered</p>
          <p className={styles.brandDesc}>Social Audio Learning</p>

          <div className={styles.brandStats}>
            Join 50,000+ learners <br />
            worldwide
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'login' ? styles.activeTab : ''}`}
              onClick={() => {
                resetMessages()
                onChangeMode('login')
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${mode === 'signup' ? styles.activeTab : ''}`}
              onClick={() => {
                resetMessages()
                onChangeMode('signup')
              }}
            >
              Sign Up
            </button>
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#ffe5e5',
                color: '#b42318',
                fontSize: '14px',
              }}
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#e8fff1',
                color: '#027a48',
                fontSize: '14px',
              }}
            >
              {successMessage}
            </div>
          )}

          {mode === 'login' ? (
            <form className={styles.form} onSubmit={handleLoginSubmit}>
              <label className={styles.signupLabel} style={{ marginTop: '20px' }}>
                EMAIL OR USERNAME
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    name="email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    placeholder="your@email.com"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <label className={styles.signupLabel}>
                PASSWORD
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    placeholder="••••••••"
                    className={`${styles.input} ${styles.inputWithIcon} ${styles.inputWithRightIcon}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.inputRightIcon}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </label>

              <label className={styles.rememberRow}>
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={loginData.rememberMe}
                  onChange={handleLoginChange}
                />
                <span>Remember me</span>
              </label>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className={styles.divider}>
                <span>Or continue with</span>
              </div>

              <div className={styles.socialRow}>
                <button type="button" className={styles.socialBtn}>
                  <Chrome size={16} />
                  <span>Google</span>
                </button>
                <button type="button" className={styles.socialBtn}>
                  <Facebook size={16} />
                  <span>Facebook</span>
                </button>
              </div>

              <p className={styles.switchText}>
                Don't have an account?{' '}
                <button
                  type="button"
                  className={styles.switchBtn}
                  onClick={() => {
                    resetMessages()
                    onChangeMode('signup')
                  }}
                >
                  Sign up instead
                </button>
              </p>
            </form>
          ) : (
            <form className={styles.form} onSubmit={handleSignupSubmit}>

              <label className={styles.signupLabel}>
                FULL NAME
                <div className={styles.inputWrap}>
                  <User size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    name="fullName"
                    value={signupData.fullName}
                    onChange={handleSignupChange}
                    placeholder="Minh Hoàng"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <div className={styles.twoCols}>
                <label className={styles.signupLabel}>
                  USERNAME
                  <div className={styles.inputWrap}>
                    <AtSign size={16} className={styles.inputIcon} />
                    <input
                      type="text"
                      name="username"
                      value={signupData.username}
                      onChange={handleSignupChange}
                      placeholder="minhhoang"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                    />
                  </div>
                </label>

                <label className={styles.signupLabel}>
                  EMAIL
                  <div className={styles.inputWrap}>
                    <Mail size={16} className={styles.inputIcon} />
                    <input
                      type="email"
                      name="email"
                      value={signupData.email}
                      onChange={handleSignupChange}
                      placeholder="mh@example.com"
                      className={`${styles.input} ${styles.inputWithIcon}`}
                    />
                  </div>
                </label>
              </div>

              <label className={styles.signupLabel}>
                PASSWORD
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={signupData.password}
                    onChange={handleSignupChange}
                    placeholder="••••••••"
                    className={`${styles.input} ${styles.inputWithIcon} ${styles.inputWithRightIcon}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.inputRightIcon}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </label>

              <label className={styles.signupLabel}>
                CONFIRM PASSWORD
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={signupData.confirmPassword}
                    onChange={handleSignupChange}
                    placeholder="••••••••"
                    className={`${styles.input} ${styles.inputWithIcon} ${styles.inputWithRightIcon}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={styles.inputRightIcon}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </label>

              <label className={styles.agreeRow}>
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={signupData.agreeTerms}
                  onChange={handleSignupChange}
                />
                <span>
                  I agree to the <a href="/">Terms of Service</a> and <a href="/">Privacy Policy</a>.
                </span>
              </label>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <p className={styles.switchText}>
                Already have an account?{' '}
                <button
                  type="button"
                  className={styles.switchBtn}
                  onClick={() => {
                    resetMessages()
                    onChangeMode('login')
                  }}
                >
                  Log in instead
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
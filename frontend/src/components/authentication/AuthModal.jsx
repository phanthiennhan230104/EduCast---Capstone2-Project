import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Music, User, AtSign, Mail, Lock, Eye, Chrome } from 'lucide-react'
import styles from '../../style/authentication/AuthModal.module.css'
import { apiRequest } from '../../utils/api'
import { saveAuth } from '../../utils/auth'
import { useAuth } from '../contexts/AuthContext'
// import ForgotPasswordModal from './ForgotPassword'

const ForgotPasswordModal = () => null;

export default function AuthModal({ isOpen, mode, onClose, onChangeMode }) {
  const navigate = useNavigate()
  const { login } = useAuth()
  const googleAppId = import.meta.env.VITE_GG_APP_ID
  const googleButtonRef = useRef(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  // -----------------------------
  // State cho form đăng nhập
  // -----------------------------
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })

  // -----------------------------
  // State cho form đăng ký
  // -----------------------------
  const [signupData, setSignupData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  // -----------------------------
  // State cho popup OTP
  // showOtpPopup = true thì hiện form nhập OTP
  // otpData.email lấy từ email vừa đăng ký
  // -----------------------------
  const [showOtpPopup, setShowOtpPopup] = useState(false)
  const [otpData, setOtpData] = useState({
    email: '',
    otp: '',
  })

  // -----------------------------
  // State UI
  // -----------------------------
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Xóa message cũ trước mỗi action
  const resetMessages = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  // Handle input login
  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target
    setLoginData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Handle input signup
  const handleSignupChange = (e) => {
    const { name, value, type, checked } = e.target
    setSignupData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Handle input OTP
  const handleOtpChange = (e) => {
    const { name, value } = e.target
    setOtpData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // ==========================================================
  // SUBMIT ĐĂNG NHẬP
  // 1) Gọi /auth/login/
  // 2) Nếu thành công => lưu token + user
  // 3) Cập nhật AuthContext
  // 4) Chuyển sang /feed
  // ==========================================================
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
          remember_me: loginData.rememberMe,
        }),
      })

      saveAuth(data, loginData.rememberMe)
      login(data.user)

      setSuccessMessage('Đăng nhập thành công.')
      onClose()

      if (data?.user?.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/feed')
      }
    } catch (error) {
      setErrorMessage(error.message || 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // SUBMIT ĐĂNG KÝ
  // 1) Validate dữ liệu ở frontend
  // 2) Gọi /auth/register/
  // 3) Nếu thành công => KHÔNG login ngay
  // 4) Mở popup OTP để user nhập mã
  // ==========================================================
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

      // Lưu email vừa đăng ký để dùng cho bước verify OTP
      setOtpData({
        email: data.email || signupData.email,
        otp: '',
      })

      setSuccessMessage(data.message || 'Đăng ký thành công. OTP đã được gửi về email.')

      // Mở popup OTP ngay sau khi signup thành công
      setShowOtpPopup(true)
    } catch (error) {
      setErrorMessage(error.message || 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  // ==========================================================
  // SUBMIT XÁC THỰC OTP
  // 1) Gọi /auth/verify-otp/
  // 2) Backend trả access + refresh + user
  // 3) Frontend lưu auth
  // 4) Login luôn
  // 5) Chuyển sang /feed
  // ==========================================================
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!otpData.otp.trim()) {
      setErrorMessage('Vui lòng nhập mã OTP.')
      return
    }

    try {
      setLoading(true)

      const data = await apiRequest('/auth/verify-otp/', {
        method: 'POST',
        body: JSON.stringify({
          email: otpData.email,
          otp: otpData.otp,
          remember_me: loginData.rememberMe,
        }),
      })

      saveAuth(data, loginData.rememberMe)
      login(data.user)

      setSuccessMessage('Xác thực OTP thành công.')
      setShowOtpPopup(false)
      onClose()

      if (data?.user?.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/feed')
      }
    } catch (error) {
      setErrorMessage(error.message || 'Xác thực OTP thất bại.')
    } finally {
      setLoading(false)
    }
  }

  //DANG NHAP BANG GOOGLE
  const handleGoogleLoginSuccess = async (googleResponse) => {
    resetMessages()

    try {
      setLoading(true)

      const idToken = googleResponse?.credential || ''

      if (!idToken) {
        throw new Error('Không lấy được Google id_token.')
      }

      const data = await apiRequest('/auth/login/google/', {
        method: 'POST',
        body: JSON.stringify({
          id_token: idToken,
        }),
      })

      saveAuth(data, true)
      login(data.user)

      setSuccessMessage('Đăng nhập Google thành công.')
      onClose()

      if (data?.user?.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/feed')
      }
    } catch (error) {
      setErrorMessage(error.message || 'Đăng nhập Google thất bại.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLoginFail = () => {
    setErrorMessage('Đăng nhập Google thất bại.')
  }
  useEffect(() => {
    if (!isOpen || mode !== 'login') return
    if (!googleAppId) return

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return

      googleButtonRef.current.innerHTML = ''

      window.google.accounts.id.initialize({
        client_id: googleAppId,
        callback: async (response) => {
          try {
            await handleGoogleLoginSuccess(response)
          } catch {
            setErrorMessage('Đăng nhập Google thất bại.')
          }
        },
      })

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 260,
      })
    }

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    )

    if (existingScript) {
      renderGoogleButton()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderGoogleButton
    document.body.appendChild(script)

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
    }
  }, [isOpen, mode, googleAppId])
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
                setShowOtpPopup(false)
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
                setShowOtpPopup(false)
                onChangeMode('signup')
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Hiển thị lỗi */}
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

          {/* Hiển thị thành công */}
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

          {/* Nếu đang ở bước OTP thì render form OTP */}
          {showOtpPopup ? (
            <form className={styles.form} onSubmit={handleVerifyOtpSubmit}>
              <label className={styles.signupLabel} style={{ marginTop: '20px' }}>
                EMAIL
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    name="email"
                    value={otpData.email}
                    readOnly
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <label className={styles.signupLabel}>
                OTP CODE
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    name="otp"
                    value={otpData.otp}
                    onChange={handleOtpChange}
                    placeholder="Nhập mã OTP 6 số"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <p className={styles.switchText}>
                Chưa nhận được mã? Kiểm tra email hoặc đăng ký lại.
              </p>
            </form>
          ) : mode === 'login' ? (
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

                <button
  type="button"
  className={styles.forgotBtn}
  onClick={() => {
    resetMessages()
    setShowForgotPassword(true)
  }}
>
  Forgot password?
</button>
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
                {googleAppId ? (
                  <div ref={googleButtonRef} className={styles.googleButtonWrap}></div>
                ) : (
                  <button type="button" className={styles.socialBtn} disabled>
                    <Chrome size={16} />
                    <span>Thiếu VITE_GG_APP_ID</span>
                  </button>
                )}
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
                  Login instead
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
      <ForgotPasswordModal
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        defaultEmail={loginData.email}
        onSuccess={(email) => {
          setShowForgotPassword(false)
          setLoginData((prev) => ({
            ...prev,
            email,
            password: '',
          }))
          resetMessages()
          setSuccessMessage('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')
        }}
      />
    </div>
  )
}
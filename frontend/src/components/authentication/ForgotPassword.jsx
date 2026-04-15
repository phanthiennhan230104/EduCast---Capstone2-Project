import { useEffect, useMemo, useState } from 'react'
import { Mail, Lock, ShieldCheck, X, Eye, EyeOff } from 'lucide-react'
import notify from '../../utils/toast'
import styles from '../../style/authentication/ForgotPassword.module.css'
import { apiRequest } from '../../utils/api'

const RESEND_SECONDS = 30

export default function ForgotPasswordModal({
  open,
  onClose,
  defaultEmail = '',
  onSuccess
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetToken, setResetToken] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    new_password: '',
    confirm_password: ''
  })

  const isResendDisabled = useMemo(() => resendTimer > 0 || loading, [resendTimer, loading])

  useEffect(() => {
    if (open) {
      setStep(1)
      setLoading(false)
      setResendTimer(0)
      setShowPassword(false)
      setShowConfirmPassword(false)
      setResetToken('')
      setFormData({
        email: defaultEmail || '',
        otp: '',
        new_password: '',
        confirm_password: ''
      })
    }
  }, [open, defaultEmail])

  useEffect(() => {
    if (resendTimer <= 0) return

    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [resendTimer])

  if (!open) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const normalizedEmail = formData.email.trim().toLowerCase()
  const normalizedOtp = formData.otp.trim()

  const sendOtp = async () => {
    if (!normalizedEmail) {
      notify.error('Vui lòng nhập email của bạn.')
      return
    }

    try {
      setLoading(true)
      await apiRequest('/auth/forgot-password/', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail
        })
      })

      setFormData((prev) => ({ ...prev, email: normalizedEmail, otp: '' }))
      setResetToken('')
      setStep(2)
      setResendTimer(RESEND_SECONDS)
      notify.success('Mã OTP đã được gửi đến email của bạn.')
    } catch (error) {
      notify.error(error.message || 'Không thể gửi mã OTP.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (!normalizedOtp) {
      notify.error('Vui lòng nhập mã OTP.')
      return
    }

    try {
      setLoading(true)
      const data = await apiRequest('/auth/verify-reset-otp/', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          otp: normalizedOtp
        })
      })

      setResetToken(data.reset_token || '')
      setFormData((prev) => ({ ...prev, email: normalizedEmail, otp: normalizedOtp }))
      setStep(3)
      notify.success(data.message || 'Mã OTP đã được xác minh thành công.')
    } catch (error) {
      notify.error(error.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    if (!formData.new_password || !formData.confirm_password) {
      notify.error('Hãy nhập mật khẩu mới.')
      return
    }

    if (formData.new_password !== formData.confirm_password) {
      notify.error('Mật khẩu xác nhận không khớp.')
      return
    }

    if (!resetToken) {
      notify.error('Phiên đặt lại mật khẩu đã hết hạn. Vui lòng xác minh OTP lại.')
      setStep(2)
      return
    }

    try {
      setLoading(true)
      await apiRequest('/auth/reset-password/', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          reset_token: resetToken,
          password1: formData.new_password,
          password2: formData.confirm_password
        })
      })

      notify.success('Password reset successfully.')

      if (onSuccess) {
        onSuccess(normalizedEmail)
      } else {
        onClose()
      }
    } catch (error) {
      notify.error(error.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (isResendDisabled) return
    await sendOtp()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <div className={styles.header}>
          <h2>Quên Mật Khẩu</h2>
          <p>
            {step === 1 && 'Nhập email của bạn để nhận mã OTP.'}
            {step === 2 && 'Kiểm tra email của bạn và nhập mã OTP.'}
            {step === 3 && 'Tạo mật khẩu mới cho tài khoản của bạn.'}
          </p>
        </div>

        <div className={styles.stepper}>
          <div className={`${styles.stepItem} ${step >= 1 ? styles.activeStep : ''}`}>1</div>
          <div className={styles.stepLine} />
          <div className={`${styles.stepItem} ${step >= 2 ? styles.activeStep : ''}`}>2</div>
          <div className={styles.stepLine} />
          <div className={`${styles.stepItem} ${step >= 3 ? styles.activeStep : ''}`}>3</div>
        </div>

        <div className={styles.form}>
          {step === 1 && (
            <>
              <label className={styles.label}>
                EMAIL
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <button type="button" className={styles.primaryBtn} onClick={sendOtp} disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi OTP'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <label className={styles.label}>
                EMAIL
                <div className={styles.inputWrap}>
                  <Mail size={16} className={styles.inputIcon} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <label className={styles.label}>
                OTP CODE
                <div className={styles.inputWrap}>
                  <ShieldCheck size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    name="otp"
                    value={formData.otp}
                    onChange={handleChange}
                    placeholder="Nhập OTP"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                  />
                </div>
              </label>

              <button type="button" className={styles.primaryBtn} onClick={verifyOtp} disabled={loading}>
                {loading ? 'Đang xác thực...' : 'Xác Thực OTP'}
              </button>

              <div className={styles.resendWrap}>
                <button
                  type="button"
                  className={styles.resendBtn}
                  onClick={handleResendOtp}
                  disabled={isResendDisabled}
                >
                  {resendTimer > 0 ? `Gửi lại OTP trong ${resendTimer}s` : 'Gửi lại OTP'}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label className={styles.label}>
                MẬT KHẨU MỚI
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="new_password"
                    value={formData.new_password}
                    onChange={handleChange}
                    placeholder="Nhập mật khẩu mới"
                    className={`${styles.input} ${styles.inputWithIcon} ${styles.inputWithAction}`}
                  />
                  <button
                    type="button"
                    className={styles.inputAction}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className={styles.label}>
                XÁC NHẬN MẬT KHẨU
                <div className={styles.inputWrap}>
                  <Lock size={16} className={styles.inputIcon} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="Xác nhận mật khẩu mới"
                    className={`${styles.input} ${styles.inputWithIcon} ${styles.inputWithAction}`}
                  />
                  <button
                    type="button"
                    className={styles.inputAction}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <button type="button" className={styles.primaryBtn} onClick={resetPassword} disabled={loading}>
                {loading ? 'Updating...' : 'Reset Password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
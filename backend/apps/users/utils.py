import random
import threading
import logging
import string

from django.core.cache import cache
from django.core.mail import get_connection, EmailMessage

logger = logging.getLogger(__name__)


# =========================
# TẠO OTP NGẪU NHIÊN 6 SỐ
# =========================
def generate_otp():
    # random.randint(100000, 999999) sẽ sinh số từ 100000 đến 999999
    # ép sang str để lưu và so sánh dễ hơn
    return f"{random.randint(100000, 999999)}"


# ===========================================
# GỬI EMAIL ASYNC ĐỂ KHÔNG CHẶN REQUEST CHÍNH
# ===========================================
def send_email_async(subject, message, recipient_email):
    try:
        # get_connection() dùng connection mail của Django trong settings.py
        with get_connection() as connection:
            email = EmailMessage(
                subject=subject,
                body=message,
                from_email=None,  # dùng DEFAULT_FROM_EMAIL trong settings nếu có
                to=[recipient_email],
                connection=connection,
            )
            email.send(fail_silently=False)

        logger.info(f"Đã gửi email OTP tới {recipient_email}")
    except Exception as e:
        logger.error(f"Lỗi gửi email OTP tới {recipient_email}: {e}")


# ===========================================
# LƯU OTP VÀO CACHE (GIỐNG DNF)
# timeout mặc định 5 phút = 300 giây
# ===========================================
def save_otp(email, otp, timeout=300):
    # key cache theo email để mỗi email có OTP riêng
    cache.set(f"otp_{email}", otp, timeout)


# ===========================================
# KIỂM TRA OTP
# Trả về tuple: (True/False, message lỗi hoặc None)
# ===========================================
def verify_otp(email, otp):
    stored_otp = cache.get(f"otp_{email}")

    if not stored_otp:
        return False, "OTP không tồn tại hoặc đã hết hạn."

    if stored_otp != otp:
        return False, "OTP không hợp lệ."

    return True, None


# ===========================================
# GỬI OTP XÁC THỰC ĐĂNG KÝ
# ===========================================
def send_register_otp_email(user):
    otp_code = generate_otp()

    # Lưu OTP vào cache để verify sau
    save_otp(user.email, otp_code)

    subject = "Xác thực tài khoản EduCast - Mã OTP"
    message = (
        f"Xin chào {user.email},\n\n"
        f"Mã OTP xác thực tài khoản của bạn là: {otp_code}\n"
        "Mã này có hiệu lực trong 5 phút.\n\n"
        "Trân trọng,\nĐội ngũ EduCast."
    )

    # Gửi email ở thread riêng để response nhanh hơn
    threading.Thread(
        target=send_email_async,
        args=(subject, message, user.email),
        daemon=True,
    ).start()

    return otp_code


# ===========================================
# GỬI OTP CHO QUÊN MẬT KHẨU
# ===========================================
def send_forgot_password_otp_email(email):
    otp_code = generate_otp()
    save_otp(email, otp_code)

    subject = "EduCast - Mã OTP đặt lại mật khẩu"
    message = (
        f"Xin chào,\n\n"
        f"Mã OTP đặt lại mật khẩu của bạn là: {otp_code}\n"
        "Mã này có hiệu lực trong 5 phút.\n\n"
        "Trân trọng,\nĐội ngũ EduCast."
    )

    threading.Thread(
        target=send_email_async,
        args=(subject, message, email),
        daemon=True,
    ).start()

    return otp_code


# ===========================================
# LƯU RESET TOKEN SAU KHI VERIFY OTP RESET
# timeout mặc định 15 phút = 900 giây
# ===========================================
def save_reset_token(email, token, timeout=900):
    cache.set(f"reset_{email}", token, timeout)


# ===========================================
# KIỂM TRA RESET TOKEN
# ===========================================
def verify_reset_token(email, token):
    stored_token = cache.get(f"reset_{email}")

    if not stored_token:
        return False, "Reset token không tồn tại hoặc đã hết hạn."

    if stored_token != token:
        return False, "Reset token không hợp lệ."

    return True, None


def generate_random_password(length=12):
    chars = string.ascii_letters + string.digits + "@#$%&*!?"
    return "".join(random.choice(chars) for _ in range(length))

def send_google_password_email(email, raw_password):
    subject = "EduCast - Mật khẩu tạm cho tài khoản Google"
    message = (
        f"Xin chào {email},\n\n"
        "Tài khoản EduCast của bạn đã được tạo bằng Google Login.\n"
        f"Mật khẩu tạm thời của bạn là: {raw_password}\n\n"
        "Vui lòng đăng nhập và đổi mật khẩu sớm để đảm bảo an toàn.\n\n"
        "Trân trọng,\nĐội ngũ EduCast."
    )

    threading.Thread(
        target=send_email_async,
        args=(subject, message, email),
        daemon=True,
    ).start()
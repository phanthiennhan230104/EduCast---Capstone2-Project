import random
import threading
import logging
import string

from django.core.cache import cache
from django.core.mail import get_connection, EmailMessage
from django.db import transaction
from django.utils import timezone

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
# LƯU DỮ LIỆU ĐĂNG KÝ TẠM VÀO CACHE
# Dữ liệu sẽ được xóa sau 15 phút nếu không verify OTP
# ===========================================
def save_signup_temp_data(email, signup_data, timeout=900):
    # key format: signup_temp_{email}
    cache.set(f"signup_temp_{email}", signup_data, timeout)


# ===========================================
# LẤY DỮ LIỆU ĐĂNG KÝ TỪ CACHE
# ===========================================
def get_signup_temp_data(email):
    return cache.get(f"signup_temp_{email}")


# ===========================================
# XÓA DỮ LIỆU ĐĂNG KÝ TỪ CACHE (SAU KHI VERIFY OTP THÀNH CÔNG)
# ===========================================
def delete_signup_temp_data(email):
    cache.delete(f"signup_temp_{email}")


# ===========================================
# GỬI OTP XÁC THỰC ĐĂNG KÝ
# ===========================================
def send_register_otp_email(email):
    otp_code = generate_otp()

    # Lưu OTP vào cache để verify sau
    save_otp(email, otp_code)

    subject = "Xác thực tài khoản EduCast - Mã OTP"
    message = (
        f"Xin chào,\n\n"
        f"Mã OTP xác thực tài khoản của bạn là: {otp_code}\n"
        "Mã này có hiệu lực trong 5 phút.\n\n"
        "Trân trọng,\nĐội ngũ EduCast."
    )

    # Gửi email ở thread riêng để response nhanh hơn
    threading.Thread(
        target=send_email_async,
        args=(subject, message, email),
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


def format_lock_until(dt):
    if not dt:
        return "vĩnh viễn"
    local_dt = timezone.localtime(dt)
    return local_dt.strftime("%H:%M %d/%m/%Y")


def get_active_lock(user):
    return user.lock_logs.filter(unlocked_at__isnull=True).order_by("-locked_at").first()


def sync_user_lock_status(user):
    active_lock = get_active_lock(user)

    if active_lock and user.status != "locked":
        user.status = "locked"
        user.save(update_fields=["status", "updated_at"])
        return user

    if not active_lock and user.status == "locked":
        user.status = "active"
        user.save(update_fields=["status", "updated_at"])

    return user


def build_locked_message(user):
    from .models import UserLockLog

    active_log = UserLockLog.objects.filter(user=user, unlocked_at__isnull=True).order_by("-locked_at").first()

    if not active_log:
        return "Tài khoản của bạn không bị khóa."

    reason = active_log.reason or "Không có lý do cụ thể."

    if active_log.lock_type == "permanent":
        return f"Tài khoản của bạn đã bị khóa vĩnh viễn. Lý do: {reason}"

    if active_log.locked_until:
        return (
            f"Tài khoản của bạn đang bị khóa đến {format_lock_until(active_log.locked_until)}. "
            f"Lý do: {reason}"
        )

    return f"Tài khoản của bạn hiện đang bị khóa. Lý do: {reason}"

def send_lock_notification_email(user, reason, lock_type, locked_until=None):
    until_text = format_lock_until(locked_until) if locked_until else "vĩnh viễn"
    subject = "EduCast - Thông báo khóa tài khoản"
    message = (
        f"Xin chào {user.username},\n\n"
        "Tài khoản EduCast của bạn đã bị khóa.\n"
        f"Lý do: {reason}\n"
        f"Hình thức khóa: {'Tạm thời' if lock_type == 'temporary' else 'Vĩnh viễn'}\n"
        f"Thời gian khóa: {until_text}\n\n"
        "Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ quản trị viên.\n\n"
        "Trân trọng,\nĐội ngũ EduCast."
    )
    send_email_in_background(subject, message, user.email)


def send_unlock_notification_email(user, unlock_reason=None):
    subject = "EduCast - Tài khoản đã được mở khóa"
    message = (
        f"Xin chào {user.username},\n\n"
        "Tài khoản EduCast của bạn đã được mở khóa và có thể đăng nhập lại.\n"
        f"Lý do mở khóa: {unlock_reason or 'Đã hết thời gian khóa hoặc được admin mở khóa.'}\n\n"
        "Trân trọng,\nĐội ngũ EduCast."
    )
    send_email_in_background(subject, message, user.email)


def unlock_user_account(user, unlocked_by=None, unlock_reason=None):
    from .models import UserLockLog

    now = timezone.now()
    with transaction.atomic():
        lock_log = (
            UserLockLog.objects.select_for_update()
            .filter(user=user, unlocked_at__isnull=True)
            .order_by("-locked_at")
            .first()
        )

        if lock_log:
            lock_log.unlocked_at = now
            lock_log.unlocked_by = unlocked_by
            lock_log.unlock_reason = unlock_reason or "Đã hết thời gian khóa."
            lock_log.save(update_fields=["unlocked_at", "unlocked_by", "unlock_reason", "updated_at"])

        if user.status == "locked":
            user.status = "active"
            user.save(update_fields=["status", "updated_at"])

    return user


def lock_user_account(user, locked_by, reason, lock_type, locked_until=None):
    from .models import UserLockLog

    now = timezone.now()
    with transaction.atomic():
        UserLockLog.objects.create(
            user=user,
            locked_by=locked_by,
            reason=reason,
            lock_type=lock_type,
            locked_at=now,
            locked_until=locked_until,
        )

        if user.status != "locked":
            user.status = "locked"
            user.save(update_fields=["status", "updated_at"])

    return user

def unlock_expired_locks():
    from .models import UserLockLog

    now = timezone.now()
    expired_logs = UserLockLog.objects.filter(
        lock_type="temporary",
        locked_until__isnull=False,
        locked_until__lte=now,
        unlocked_at__isnull=True,
    ).select_related("user")

    unlocked_count = 0
    for log in expired_logs:
        unlock_user_account(log.user, unlock_reason="Tự động mở khóa do đã hết thời gian khóa.")
        send_unlock_notification_email(log.user, "Tự động mở khóa do đã hết thời gian khóa.")
        unlocked_count += 1

    return unlocked_count

def unlock_expired_lock_for_user(user):
    active_log = get_active_lock(user)

    if (
        active_log
        and active_log.lock_type == "temporary"
        and active_log.locked_until
        and active_log.locked_until <= timezone.now()
    ):
        unlock_user_account(user, unlock_reason="Tự động mở khóa do đã hết thời gian khóa.")
        send_unlock_notification_email(user, "Tự động mở khóa do đã hết thời gian khóa.")
        sync_user_lock_status(user)

    return user

def send_email_in_background(subject, message, recipient_email):
    threading.Thread(
        target=send_email_async,
        args=(subject, message, recipient_email),
        daemon=True,
    ).start()


def log_login_history(user, request):
    from .models import LoginHistory
    import user_agents
    
    ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
    if ip_address:
        ip_address = ip_address.split(',')[0].strip()
        
    user_agent_str = request.META.get('HTTP_USER_AGENT', '')
    ua = user_agents.parse(user_agent_str)
    
    device_type = "Desktop"
    if ua.is_mobile: device_type = "Mobile"
    elif ua.is_tablet: device_type = "Tablet"
    elif ua.is_pc: device_type = "Desktop"
    
    try:
        LoginHistory.objects.create(
            user=user,
            ip_address=ip_address,
            user_agent=user_agent_str,
            device_type=device_type
        )
    except Exception as e:
        print(f"❌ Error logging login history: {str(e)}")


def log_user_activity(user_id, activity_type, reference_type, reference_id):
    from .models import ActivityLog
    try:
        ActivityLog.objects.create(
            user_id=user_id,
            activity_type=activity_type,
            reference_type=reference_type,
            reference_id=reference_id
        )
    except Exception as e:
        print(f"❌ Error logging user activity: {str(e)}")
  
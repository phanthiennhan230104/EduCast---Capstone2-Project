from django.utils import timezone
import uuid
from django.db import models


def generate_id():
    return uuid.uuid4().hex[:26]


# ==========================================
# MODEL USER
# - bám đúng schema bảng users trong database
# - KHÔNG dùng AbstractBaseUser nữa
# ==========================================
class User(models.Model):
    ROLE_CHOICES = (
        ("user", "User"),
        ("admin", "Admin"),
    )

    STATUS_CHOICES = (
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("locked", "Locked"),
        ("suspended", "Suspended"),
        ("banned", "Banned"),
    )

    AUTH_PROVIDER_CHOICES = (
        ("local", "Local"),
        ("google", "Google"),
        ("facebook", "Facebook"),
    )

    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    username = models.CharField(unique=True, max_length=100)

    # DB hiện tại đang dùng password_hash
    password_hash = models.CharField(max_length=255)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    auth_provider = models.CharField(max_length=20, choices=AUTH_PROVIDER_CHOICES, default="local")
    is_verified = models.BooleanField(default=False)

    # DB hiện tại đang dùng last_login_at
    last_login_at = models.DateTimeField(null=True, blank=True)
    

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Để tương thích với Django's AUTH_USER_MODEL
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = "users"
        app_label = "users"

    def __str__(self):
        return f"{self.username} ({self.email})"

    # DRF/permission thường check thuộc tính này
    @property
    def is_authenticated(self):
        return True

    # để tương thích một số check cơ bản
    @property
    def is_anonymous(self):
        return False

        

# ==========================================
# PROFILE CỦA USER
# ==========================================
class UserProfile(models.Model):
    AGE_GROUP_CHOICES = (
        ("16_22", "16_22"),
        ("23_30", "23_30"),
        ("31_40", "31_40"),
    )

    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=150)
    bio = models.TextField(null=True, blank=True)
    avatar_url = models.URLField(max_length=500, null=True, blank=True)
    cover_url = models.URLField(max_length=500, null=True, blank=True)
    headline = models.CharField(max_length=255, null=True, blank=True)
    age_group = models.CharField(max_length=20, choices=AGE_GROUP_CHOICES, null=True, blank=True)
    learning_field = models.CharField(max_length=100, null=True, blank=True)
    interests = models.JSONField(null=True, blank=True)
    preferred_language = models.CharField(max_length=10, default="vi")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profiles"
        app_label = "users"

    def __str__(self):
        return f"Profile - {self.display_name}"


# ==========================================
# CÀI ĐẶT USER
# ==========================================
class UserSettings(models.Model):
    PROFILE_VISIBILITY_CHOICES = (
        ("public", "Public"),
        ("followers_only", "Followers Only"),
        ("private", "Private"),
    )

    ALLOW_MESSAGES_CHOICES = (
        ("everyone", "Everyone"),
        ("followers_only", "Followers Only"),
        ("nobody", "Nobody"),
    )

    THEME_MODE_CHOICES = (
        ("light", "Light"),
        ("dark", "Dark"),
        ("system", "System"),
    )

    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="settings")
    email_notifications = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)
    notify_likes = models.BooleanField(default=True)
    notify_comments = models.BooleanField(default=True)
    notify_follows = models.BooleanField(default=True)
    notify_messages = models.BooleanField(default=True)
    profile_visibility = models.CharField(max_length=30, choices=PROFILE_VISIBILITY_CHOICES, default="public")
    allow_messages_from = models.CharField(max_length=30, choices=ALLOW_MESSAGES_CHOICES, default="everyone")
    autoplay_audio = models.BooleanField(default=True)
    theme_mode = models.CharField(max_length=20, choices=THEME_MODE_CHOICES, default="dark")
    language_code = models.CharField(max_length=10, default="vi")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_settings"
        app_label = "users"

    def __str__(self):
        return f"Settings - {self.user.username}"


# ==========================================
# REFRESH TOKEN TABLE
# ==========================================
class RefreshToken(models.Model):
    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="refresh_tokens")
    token_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "refresh_tokens"
        app_label = "users"

    def __str__(self):
        return f"RefreshToken - {self.user.username}"
    
class UserLockLog(models.Model):
    LOCK_TYPE_CHOICES = (
        ("temporary", "Temporary"),
        ("permanent", "Permanent"),
    )

    id = models.CharField(primary_key=True, max_length=26, default=generate_id, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="lock_logs",
        db_column="user_id",
    )
    locked_by = models.ForeignKey(
        User,
        on_delete=models.RESTRICT,
        related_name="created_lock_logs",
        db_column="locked_by_id",
    )
    reason = models.TextField()
    lock_type = models.CharField(max_length=20, choices=LOCK_TYPE_CHOICES, default="temporary")
    locked_at = models.DateTimeField(default=timezone.now)
    locked_until = models.DateTimeField(null=True, blank=True)
    unlocked_at = models.DateTimeField(null=True, blank=True)
    unlocked_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_lock_logs",
        db_column="unlocked_by_id",
    )
    unlock_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_lock_logs"
        app_label = "users"
        ordering = ["-locked_at", "-created_at"]

    def __str__(self):
        return f"LockLog - {self.user_id} - {self.lock_type}"


class UserTagPreference(models.Model):
    """Tags yêu thích của user để lọc feed theo tags"""
    id = models.CharField(max_length=26, primary_key=True, default=generate_id, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='tag_preferences'
    )
    tag = models.ForeignKey(
        'content.Tag',
        on_delete=models.CASCADE,
        db_column='tag_id',
        related_name='user_preferences'
    )
    score = models.FloatField(default=1.0)  # Mức độ yêu thích
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_tag_preferences'
        app_label = 'users'
        unique_together = ('user', 'tag')
        ordering = ['-score', '-created_at']

    def __str__(self):
        return f"{self.user_id} - Tag {self.tag.name} (score: {self.score})"

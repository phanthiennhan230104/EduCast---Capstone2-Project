from django.db import models
from django.core.exceptions import ValidationError

class PostLike(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='liked_posts')
    share = models.ForeignKey('PostShare', on_delete=models.CASCADE, related_name='likes', null=True, blank=True)
    created_at = models.DateTimeField()
    class Meta:
        db_table = 'post_likes'
        unique_together = ('post', 'user', 'share')
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        if self.share:
            return f"{self.user} liked share {self.share_id} of post {self.post_id}"
        return f"{self.user} liked post {self.post_id}"
    
class SavedPost(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='saved_by_users')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='saved_posts')
    share = models.ForeignKey('PostShare', on_delete=models.CASCADE, related_name='saved_by_users', null=True, blank=True)
    created_at = models.DateTimeField()
    class Meta:
        db_table = 'saved_posts'
        unique_together = ('post', 'user', 'share')
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        if self.share:
            return f"{self.user} saved share {self.share_id} of post {self.post_id}"
        return f"{self.user} saved post {self.post_id}"

class Comment(models.Model):
    STATUS_CHOICES = [
            ("active", "Active"),
            ("hidden", "Hidden"),
            ("deleted", "Deleted"),
        ]
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='comments')
    share = models.ForeignKey('PostShare', on_delete=models.CASCADE, related_name='comments', null=True, blank=True)
    parent_comment = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    content = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    like_count = models.IntegerField(default=0)
    class Meta:
        db_table = 'comments'
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        if self.share:
            return f"{self.user} commented on share {self.share_id} of post {self.post_id}"
        return f"{self.user} commented on post {self.post_id}"

class CommentLike(models.Model):
    id = models.CharField(primary_key=True, max_length=26)
    comment = models.ForeignKey(
        'social.Comment',
        on_delete=models.CASCADE,
        db_column='comment_id',
        related_name='comment_likes'
    )
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='liked_comments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'comment_likes'
        constraints = [
            models.UniqueConstraint(
                fields=['comment', 'user'],
                name='uq_comment_like'
            )
        ]

class Follow(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    follower = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='following_relations')
    following = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='follower_relations')
    created_at = models.DateTimeField()
    class Meta: 
        db_table = 'follows'
        unique_together = ('follower', 'following')
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.follower} follows {self.following}"
    def clean(self):
        if self.follower_id == self.following_id:
            raise ValidationError("User cannot follow themselves.")
    def save(self, *args, **kwargs): 
        self.clean() 
        super().save(*args, **kwargs)
    
class Notification(models.Model):
    TYPE_CHOICES = [
        ("like", "Like"),
        ("comment", "Comment"),
        ("follow", "Follow"),
        ("message", "Message"),
        ("system", "System"),
        ("report_update", "Report Update"),
        ('new_post', 'New Post'),
    ]
    id = models.CharField(max_length=26, primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='notifications')
    actor_user = models.ForeignKey(
    'users.User',
    on_delete=models.SET_NULL,
    related_name='sent_notifications',
    null=True,
    blank=True
)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    body = models.TextField(null=True, blank=True)
    reference_type = models.CharField(max_length=50, null=True, blank=True)
    reference_id = models.CharField(max_length=100, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'notifications'
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        return f"Notification for {self.user} - {self.type}"
    
class PostShare(models.Model):
    TYPE_CHOICES = [
        ("personal", "Share to Personal"),
        ("message", "Share via Message"),
    ]
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='shares')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='shared_posts')
    share_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="personal")
    # Nếu user share lại một bài share (share_of_share), lưu id của share gốc để đếm share theo "bài share".
    # Lưu ý: model managed=False nên field này chỉ hoạt động nếu DB có cột tương ứng.
    shared_from_share_id = models.CharField(max_length=26, null=True, blank=True)
    caption = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'post_shares'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} shared post {self.post_id} via {self.share_type}"
    
class PlaybackHistory(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="playback_histories",
    )
    post = models.ForeignKey(
        "content.Post",
        on_delete=models.CASCADE,
        related_name="playback_histories",
    )
    progress_seconds = models.IntegerField(default=0)
    duration_seconds = models.IntegerField(default=0)
    completed_ratio = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_completed = models.BooleanField(default=False)
    last_played_at = models.DateTimeField()

    class Meta:
        db_table = "playback_history"
        managed = False
        ordering = ["-last_played_at"]

class PostNote(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='notes')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='post_notes')
    content = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = 'post_notes'
        unique_together = ('post', 'user')
        managed = False
        ordering = ['-updated_at']

    def __str__(self):
        return f"Note by {self.user} on post {self.post_id}"

    def __str__(self):
        return f"{self.user_id} - {self.post_id}"


class Report(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("reviewed", "Reviewed"),
        ("resolved", "Resolved"),
        ("rejected", "Rejected"),
    ]
    REASON_CHOICES = [
        ("spam", "Spam"),
        ("inappropriate_content", "Inappropriate Content"),
        ("harassment", "Harassment"),
        ("misinformation", "Misinformation"),
        ("copyright", "Copyright Violation"),
        ("other", "Other"),
    ]
    TARGET_TYPE_CHOICES = [
        ("post", "Post"),
        ("comment", "Comment"),
        ("user", "User"),
        ("message", "Message"),
    ]
    
    id = models.CharField(max_length=26, primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='reports', db_column='reporter_id')
    target_type = models.CharField(max_length=20, choices=TARGET_TYPE_CHOICES)
    target_id = models.CharField(max_length=26)
    reason = models.CharField(max_length=50, choices=REASON_CHOICES)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        db_table = 'reports'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"Report by {self.user_id} - {self.reason} ({self.status})"
    
    
    
class HiddenPost(models.Model):
    id = models.CharField(max_length=26, primary_key=True)

    post = models.ForeignKey(
        'content.Post',
        on_delete=models.CASCADE,
        db_column='post_id',
        related_name='hidden_by_users'
    )

    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='hidden_posts'
    )

    created_at = models.DateTimeField()

    class Meta:
        db_table = 'hidden_posts'
        unique_together = ('post', 'user')
        managed = False


class Collection(models.Model):
    """User's custom collection/folder for organizing saved posts"""
    id = models.CharField(max_length=26, primary_key=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='collections')
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField()

    class Meta:
        db_table = 'collections'
        unique_together = ('user', 'name')
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.name}"


class CollectionPost(models.Model):
    """M2M relationship between Collection and Post"""
    id = models.CharField(max_length=26, primary_key=True)
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name='posts')
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='in_collections')
    added_at = models.DateTimeField()

    class Meta:
        db_table = 'collection_items'
        unique_together = ('collection', 'post')
        managed = False
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.collection.name} - {self.post_id}"
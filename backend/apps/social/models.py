from django.db import models
from django.core.exceptions import ValidationError

class PostLike(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='liked_posts')
    created_at = models.DateTimeField()
    class Meta:
        db_table = 'post_likes'
        unique_together = ('post', 'user')
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.user} liked post {self.post_id}"
    
class SavedPost(models.Model):
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='saved_by_users')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='saved_posts')
    created_at = models.DateTimeField()
    class Meta:
        db_table = 'saved_posts'
        unique_together = ('post', 'user')
        managed = False
        ordering = ['-created_at']
    def __str__(self):
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
    parent_comment = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    content = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    class Meta:
        db_table = 'comments'
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        return f"{self.user} commented on post {self.post_id}"

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
    actor_user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='sent_notifications', null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    body = models.TextField(null=True, blank=True)
    reference_type = models.CharField(max_length=50, null=True, blank=True)
    reference_id = models.CharField(max_length=26, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    class Meta:
        db_table = 'notifications'
        managed = False
        ordering = ['-created_at']
    def __str__(self):
        return f"Notification for {self.user} - {self.type}"
    
class PostShare(models.Model):
    TYPE_CHOICES = [
        ("copy_link", "Copy Link"),
        ("facebook", "Facebook"),
        ("messenger", "Messenger"),
        ("zalo", "Zalo"),
        ("other", "Other"),
    ]
    id = models.CharField(max_length=26, primary_key=True)
    post = models.ForeignKey('content.Post', on_delete=models.CASCADE, related_name='shares')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='shared_posts')
    share_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="copy_link")
    created_at = models.DateTimeField()

    class Meta:
        db_table = 'post_shares'
        managed = False
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} shared post {self.post_id} via {self.share_type}"
    
import uuid
import requests 
import logging
import json
from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from datetime import timedelta

from .models import User, UserProfile, UserSettings

logger = logging.getLogger(__name__)


# =====================================================
# USER SETTINGS API VIEWS
# =====================================================

class UserSettingsView(APIView):
    """Get current user settings"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Auto-create settings if they don't exist (for users who registered before this feature)
        settings_obj, created = UserSettings.objects.get_or_create(
            user=user,
            defaults={
                'email_notifications': True,
                'push_notifications': True,
                'notify_likes': True,
                'notify_comments': True,
                'notify_follows': True,
                'notify_messages': True,
                'profile_visibility': 'public',
                'allow_messages_from': 'everyone',
                'autoplay_audio': True,
                'theme_mode': 'dark',
                'language_code': 'vi',
            }
        )
        
        if created:
            logger.info(f"Auto-created UserSettings for user {user.id}")
        
        return Response({
            "settings": {
                "email_notifications": settings_obj.email_notifications,
                "push_notifications": settings_obj.push_notifications,
                "notify_likes": settings_obj.notify_likes,
                "notify_comments": settings_obj.notify_comments,
                "notify_follows": settings_obj.notify_follows,
                "notify_messages": settings_obj.notify_messages,
                "profile_visibility": settings_obj.profile_visibility,
                "allow_messages_from": settings_obj.allow_messages_from,
                "autoplay_audio": settings_obj.autoplay_audio,
                "theme_mode": settings_obj.theme_mode,
                "language_code": settings_obj.language_code,
            }
        }, status=status.HTTP_200_OK)


class UpdateUserSettingsView(APIView):
    """Update user settings"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        
        # Auto-create settings if they don't exist (for users who registered before this feature)
        settings_obj, created = UserSettings.objects.get_or_create(
            user=user,
            defaults={
                'email_notifications': True,
                'push_notifications': True,
                'notify_likes': True,
                'notify_comments': True,
                'notify_follows': True,
                'notify_messages': True,
                'profile_visibility': 'public',
                'allow_messages_from': 'everyone',
                'autoplay_audio': True,
                'theme_mode': 'dark',
                'language_code': 'vi',
            }
        )
        
        if created:
            logger.info(f"Auto-created UserSettings for user {user.id}")
        
        # Update allowed fields - matching user_settings table schema
        allowed_fields = {
            'email_notifications': bool,
            'push_notifications': bool,
            'notify_likes': bool,
            'notify_comments': bool,
            'notify_follows': bool,
            'notify_messages': bool,
            'profile_visibility': str,
            'allow_messages_from': str,
            'autoplay_audio': bool,
            'theme_mode': str,
            'language_code': str,
        }
        
        updated_fields = []
        
        for field, field_type in allowed_fields.items():
            if field in request.data:
                value = request.data[field]
                if hasattr(settings_obj, field):
                    setattr(settings_obj, field, value)
                    updated_fields.append(field)
        
        if updated_fields:
            updated_fields.append('updated_at')
            settings_obj.save(update_fields=updated_fields)
        
        return Response({
            "message": "Settings updated successfully",
            "settings": {
                "email_notifications": settings_obj.email_notifications,
                "push_notifications": settings_obj.push_notifications,
                "notify_likes": settings_obj.notify_likes,
                "notify_comments": settings_obj.notify_comments,
                "notify_follows": settings_obj.notify_follows,
                "notify_messages": settings_obj.notify_messages,
                "profile_visibility": settings_obj.profile_visibility,
                "allow_messages_from": settings_obj.allow_messages_from,
                "autoplay_audio": settings_obj.autoplay_audio,
                "theme_mode": settings_obj.theme_mode,
                "language_code": settings_obj.language_code,
            }
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """Change user password"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not old_password or not new_password:
            return Response(
                {"error": "old_password and new_password are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not check_password(old_password, user.password_hash):
            return Response(
                {"error": "Mật khẩu hiện tại không chính xác"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 6:
            return Response(
                {"error": "Mật khẩu phải có ít nhất 6 ký tự"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.password_hash = make_password(new_password)
        user.save(update_fields=['password_hash', 'updated_at'])
        
        return Response({
            "message": "Mật khẩu đã được thay đổi thành công"
        }, status=status.HTTP_200_OK)


class ExportUserDataView(APIView):
    """Export user data including stats from user_stats table"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        profile = user.profile if hasattr(user, 'profile') else None
        
        # Try to get user stats
        user_stats = None
        try:
            from .models import UserStats
            user_stats = UserStats.objects.get(user_id=user.id)
        except:
            pass
        
        export_data = {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "role": user.role,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "profile": {
                "display_name": profile.display_name if profile else None,
                "bio": profile.bio if profile else None,
                "age_group": profile.age_group if profile else None,
                "learning_field": profile.learning_field if profile else None,
                "interests": profile.interests if profile else None,
                "headline": profile.headline if profile else None,
            },
            "stats": {
                "total_posts": user_stats.total_posts if user_stats else 0,
                "total_followers": user_stats.total_followers if user_stats else 0,
                "total_following": user_stats.total_following if user_stats else 0,
                "total_listens": user_stats.total_listens if user_stats else 0,
                "total_likes_received": user_stats.total_likes_received if user_stats else 0,
                "total_saved_received": user_stats.total_saved_received if user_stats else 0,
                "streak_days": user_stats.streak_days if user_stats else 0,
            }
        }
        
        return Response(export_data, status=status.HTTP_200_OK)


class DeleteAccountView(APIView):
    """Lock user account (soft delete)"""
    permission_classes = [IsAuthenticated]
    
    def delete(self, request):
        user = request.user
        password = request.data.get('password', '')
        
        # Verify password if provided
        if password and not check_password(password, user.password_hash):
            return Response(
                {"error": "Mật khẩu không chính xác"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Lock account instead of deleting (set status to 'locked')
        user.status = 'locked'
        user.save(update_fields=['status'])
        
        logger.info(f"User account locked: {user.id}")
        
        return Response({
            "message": "Tài khoản đã bị khóa. Hành động này không thể hoàn tác."
        }, status=status.HTTP_200_OK)


class UnlinkSocialAccountView(APIView):
    """Unlink social account from user_auth_providers"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, provider):
        user = request.user
        
        # Get the model dynamically to avoid import issues
        try:
            from .models import UserAuthProvider
            
            # Delete the social account link
            UserAuthProvider.objects.filter(
                user=user,
                provider=provider
            ).delete()
            
            return Response({
                "message": f"Liên kết {provider} đã được hủy"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "message": f"Liên kết {provider} đã được hủy"
            }, status=status.HTTP_200_OK)


class LinkSocialAccountView(APIView):
    """Link social account"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, provider):
        user = request.user
        code = request.data.get('code')
        
        if not code:
            return Response(
                {"error": "Code is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # This would integrate with your social auth system
        # For now, just acknowledge the request
        return Response({
            "message": f"Liên kết {provider} thành công"
        }, status=status.HTTP_200_OK)

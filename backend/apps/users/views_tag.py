from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
import json

from .models import UserTagPreference, User, generate_id
from .serializers import UserTagPreferenceSerializer
from apps.content.models import Tag, PostTag


def _json_success(message, data=None):
    """Return success response"""
    return Response({
        'success': True,
        'message': message,
        'data': data or {}
    }, status=status.HTTP_200_OK)


def _json_error(message, status_code=400):
    """Return error response"""
    return Response({
        'success': False,
        'message': message
    }, status=status_code)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_http_methods(["GET"])
def get_user_tag_preferences(request):
    """Get all user's tag preferences"""
    try:
        user = request.user
        print(f"📍 Fetching tag preferences for user: {user.id}")
        
        # Try to fetch preferences, but handle if table doesn't exist
        try:
            preferences = UserTagPreference.objects.filter(user=user).order_by('-score', '-created_at')
            print(f" Found {preferences.count()} preferences")
            serializer = UserTagPreferenceSerializer(preferences, many=True)
            print(f" Serialized successfully")
            print(f" Data: {serializer.data[:2] if serializer.data else 'empty'}")
            return _json_success(
                "Tag preferences fetched successfully",
                {"preferences": serializer.data}
            )
        except Exception as db_error:
            # If table doesn't exist, return empty preferences
            if "doesn't exist" in str(db_error):
                print(f" Tag preferences table doesn't exist yet: {str(db_error)}")
                return _json_success(
                    "Tag preferences table not set up yet",
                    {"preferences": []}
                )
            raise
    except Exception as e:
        import traceback
        print(f" Tag preferences error: {str(e)}")
        traceback.print_exc()
        return _json_error(f"Error fetching preferences: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_http_methods(["POST"])
def update_user_tag_preferences(request):
    """Replace all user's tag preferences"""
    try:
        user = request.user
        data = json.loads(request.body) if hasattr(request, 'body') else request.data
        
        tag_ids = data.get('tag_ids', [])
        
        # Delete old preferences
        UserTagPreference.objects.filter(user=user).delete()
        
        # Create new preferences
        for tag_id in tag_ids:
            UserTagPreference.objects.create(user=user, tag_id=tag_id)
        
        preferences = UserTagPreference.objects.filter(user=user).order_by('-score', '-created_at')
        serializer = UserTagPreferenceSerializer(preferences, many=True)
        
        return _json_success(
            "Tag preferences updated successfully",
            {"preferences": serializer.data}
        )
    except Exception as e:
        return _json_error(f"Error updating preferences: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_http_methods(["POST"])
def add_tag_preference(request):
    """Add a single tag preference"""
    try:
        user = request.user
        data = json.loads(request.body) if hasattr(request, 'body') else request.data
        
        tag_id = data.get('tag_id')
        if not tag_id:
            return _json_error("tag_id is required", status.HTTP_400_BAD_REQUEST)
        
        # Create or get the preference
        preference, created = UserTagPreference.objects.get_or_create(
            user=user,
            tag_id=tag_id
        )
        
        serializer = UserTagPreferenceSerializer(preference)
        return _json_success(
            "Tag preference added successfully",
            serializer.data
        )
    except Exception as e:
        return _json_error(f"Error adding preference: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_http_methods(["DELETE"])
def remove_tag_preference(request, tag_id):
    """Remove a tag preference"""
    try:
        user = request.user
        preference = get_object_or_404(UserTagPreference, user=user, tag_id=tag_id)
        preference.delete()
        
        return _json_success("Tag preference removed successfully")
    except Exception as e:
        return _json_error(f"Error removing preference: {str(e)}", 500)


@api_view(['GET'])
@permission_classes([AllowAny])
@require_http_methods(["GET"])
def get_available_tags(request):
    """Get all available tags"""
    try:
        # Simple query - just get all tags
        tags = Tag.objects.all().order_by('name')
        
        return Response({
            'success': True,
            'data': [
                {
                    'id': str(tag.id),
                    'name': tag.name,
                }
                for tag in tags
            ]
        }, status=status.HTTP_200_OK)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error: {str(e)}")
        return _json_error(f"Error fetching tags: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
@require_http_methods(["GET"])
def search_tags(request):
    """Search tags by name"""
    try:
        query = request.query_params.get('q', '').strip()
        
        if not query:
            return _json_error("Search query required", status.HTTP_400_BAD_REQUEST)
        
        # Search tags with post count
        tags = Tag.objects.filter(
            name__icontains=query
        ).annotate(
            post_count=Count('tag_posts')
        ).order_by('-post_count')[:20]
        
        return Response({
            'success': True,
            'data': [
                {
                    'id': str(tag.id),
                    'name': tag.name,
                    'post_count': tag.post_count,
                }
                for tag in tags
            ]
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return _json_error(f"Error searching tags: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_http_methods(["POST"])
def create_and_add_tag(request):
    """Create a new tag and add to user preferences"""
    try:
        user = request.user
        data = json.loads(request.body) if hasattr(request, 'body') else request.data
        
        tag_name = data.get('tag_name', '').strip()
        if not tag_name:
            return _json_error("tag_name is required", status.HTTP_400_BAD_REQUEST)
        
        # Check if tag already exists
        existing_tag = Tag.objects.filter(name__iexact=tag_name).first()
        
        if existing_tag:
            tag = existing_tag
            msg = f"Tag '{tag_name}' already exists"
        else:
            # Create new tag
            tag_id = generate_id()
            tag_slug = tag_name.lower().replace(' ', '-')
            tag = Tag.objects.create(
                id=tag_id,
                name=tag_name,
                slug=tag_slug,
                created_at=timezone.now()
            )
            msg = f"Tag '{tag_name}' created successfully"
        
        # Add to user preferences
        preference, created = UserTagPreference.objects.get_or_create(
            user=user,
            tag=tag
        )
        
        serializer = UserTagPreferenceSerializer(preference)
        return Response({
            'success': True,
            'message': msg,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return _json_error(f"Error creating tag: {str(e)}", status.HTTP_500_INTERNAL_SERVER_ERROR)

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.utils import timezone
from .models import Post, PostAudioVersion
from apps.users.permissions import IsAdminRole
from apps.users.models import User
from apps.social.models import Report, Notification


class AdminPostsListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        # Get query parameters
        status_filter = request.query_params.get('status')
        visibility_filter = request.query_params.get('visibility')
        source_type_filter = request.query_params.get('source_type')
        search_query = request.query_params.get('search')
        report_status_filter = request.query_params.get('report_status')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        # Start with all posts
        # Start with all posts, but hide private draft posts
        posts_qs = (
            Post.objects
            .select_related('user')
            .exclude(visibility='private', status='draft')
        )

        # Apply filters
        if status_filter and status_filter in dict(Post.StatusChoices.choices):
            posts_qs = posts_qs.filter(status=status_filter)

        if visibility_filter and visibility_filter in dict(Post.VisibilityChoices.choices):
            posts_qs = posts_qs.filter(visibility=visibility_filter)

        if source_type_filter and source_type_filter in dict(Post.SourceTypeChoices.choices):
            posts_qs = posts_qs.filter(source_type=source_type_filter)

        if search_query:
            posts_qs = posts_qs.filter(
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(user__username__icontains=search_query)
            )

        # Order by created_at descending
        posts_qs = posts_qs.order_by('-created_at')

        # Calculate total count before pagination
        total_count = posts_qs.count()

        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        posts_page = posts_qs[start_idx:end_idx]

        # Format data with reports
        posts_data = []
        for post in posts_page:
            # Get reports for this post (only reports where target_type='post' and target_id=post.id)
            reports_list = []
            reports_qs = Report.objects.filter(target_type='post', target_id=post.id).select_related('user')
            
            for report in reports_qs:
                reports_list.append({
                    'id': report.id,
                    'reason': report.reason,
                    'description': report.description,
                    'status': report.status,
                    'created_at': report.created_at.isoformat() if report.created_at else None,
                    'reporter_username': report.user.username if report.user else 'Unknown',
                })

            # Apply report status filter if specified
            if report_status_filter and not any(r['status'] == report_status_filter for r in reports_list):
                continue

            # Get audio versions for this post
            # Get audio versions for this post
            audio_versions = []
            audio_versions_qs = (
                PostAudioVersion.objects
                .filter(post_id=post.id)
                .order_by('-is_default', 'created_at')
            )

            for audio in audio_versions_qs:
                audio_versions.append({
                    'id': audio.id,
                    'voice_name': audio.voice_name,
                    'format': audio.format,
                    'bitrate_kbps': audio.bitrate_kbps,
                    'duration_seconds': audio.duration_seconds,
                    'audio_url': audio.audio_url,
                    'is_default': audio.is_default,
                    'created_at': audio.created_at.isoformat() if audio.created_at else None,
                })

            default_audio = next(
                (item for item in audio_versions if item.get('is_default')),
                audio_versions[0] if audio_versions else None
            )

            resolved_audio_url = (
                default_audio.get('audio_url')
                if default_audio and default_audio.get('audio_url')
                else post.audio_url
            )

            resolved_duration_seconds = (
                default_audio.get('duration_seconds')
                if default_audio and default_audio.get('duration_seconds') is not None
                else post.duration_seconds
            )

            posts_data.append({
                'id': post.id,
                'title': post.title,
                'slug': post.slug,
                'status': post.status,
                'visibility': post.visibility,
                'source_type': post.source_type,
                'is_ai_generated': post.is_ai_generated,
                'user_id': post.user_id,
                'username': post.user.username if post.user else 'Unknown',
                'display_name': post.user.profile.display_name if post.user and hasattr(post.user, 'profile') and post.user.profile else (post.user.username if post.user else 'Unknown'),
                'user_avatar': post.user.profile.avatar_url if post.user and hasattr(post.user, 'profile') else None,
                'description': post.description[:100] + '...' if post.description and len(post.description) > 100 else post.description,
                'duration_seconds': resolved_duration_seconds,
                'view_count': post.view_count,
                'listen_count': post.listen_count,
                'like_count': post.like_count,
                'comment_count': post.comment_count,
                'download_count': post.download_count,
                'learning_field': post.learning_field,
                'published_at': post.published_at.isoformat() if post.published_at else None,
                'created_at': post.created_at.isoformat() if post.created_at else None,
                'updated_at': post.updated_at.isoformat() if post.updated_at else None,
                'thumbnail_url': post.thumbnail_url,
                'audio_url': resolved_audio_url,
                'audio': {
                    'id': default_audio.get('id') if default_audio else None,
                    'audio_url': resolved_audio_url,
                    'duration_seconds': resolved_duration_seconds,
                    'voice_name': default_audio.get('voice_name') if default_audio else '',
                    'format': default_audio.get('format') if default_audio else 'mp3',
                } if resolved_audio_url else None,
                'audio_versions': audio_versions,
                'reports': reports_list,
                'report_count': len(reports_list),
                'pending_reports': sum(1 for r in reports_list if r['status'] == 'pending'),
                'resolved_reports': sum(1 for r in reports_list if r['status'] == 'resolved'),
            })

        return Response({
            'posts': posts_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total_count,
                'total_pages': (total_count + page_size - 1) // page_size,
            }
        }, status=status.HTTP_200_OK)


class AdminPostDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, post_id):
        try:
            post = Post.objects.select_related('user').get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        post_data = {
            'id': post.id,
            'title': post.title,
            'slug': post.slug,
            'description': post.description,
            'original_text': post.original_text,
            'summary_text': post.summary_text,
            'dialogue_script': post.dialogue_script,
            'transcript_text': post.transcript_text,
            'status': post.status,
            'visibility': post.visibility,
            'source_type': post.source_type,
            'is_ai_generated': post.is_ai_generated,
            'language_code': post.language_code,
            'user_id': post.user_id,
            'username': post.user.username if post.user else 'Unknown',
            'duration_seconds': post.duration_seconds,
            'view_count': post.view_count,
            'listen_count': post.listen_count,
            'like_count': post.like_count,
            'comment_count': post.comment_count,
            'save_count': post.save_count,
            'share_count': post.share_count,
            'download_count': post.download_count,
            'learning_field': post.learning_field,
            'published_at': post.published_at.isoformat() if post.published_at else None,
            'created_at': post.created_at.isoformat() if post.created_at else None,
            'updated_at': post.updated_at.isoformat() if post.updated_at else None,
            'thumbnail_url': post.thumbnail_url,
            'audio_url': post.audio_url,
        }

        return Response(post_data, status=status.HTTP_200_OK)


class AdminPostHideView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        post.status = 'hidden'
        post.save()

        return Response(
            {'message': 'Đã ẩn bài viết.', 'status': post.status},
            status=status.HTTP_200_OK,
        )


class AdminPostRestoreView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Restore to published and set visibility to public
        post.status = 'published'
        post.visibility = 'public'
        post.save()

        return Response(
            {'message': 'Đã mở bài viết.', 'status': post.status, 'visibility': post.visibility},
            status=status.HTTP_200_OK,
        )


class AdminUpdateReportStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, report_id):
        try:
            report = Report.objects.get(id=report_id)
        except Report.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy báo cáo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_status = request.data.get('status')
        if new_status not in dict(Report._meta.get_field('status').choices):
            return Response(
                {'error': f'Trạng thái không hợp lệ: {new_status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report.status = new_status
        report.updated_at = timezone.now()
        report.save()

        return Response(
            {'message': f'Đã cập nhật báo cáo thành {new_status}', 'status': report.status},
            status=status.HTTP_200_OK,
        )


class AdminLockPostWithReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        report_id = request.data.get('report_id')
        
        # Update post status to hidden
        post.status = 'hidden'
        post.save()

        # Update report status to resolved if provided
        if report_id:
            try:
                report = Report.objects.get(id=report_id)
                report.status = 'resolved'
                report.updated_at = timezone.now()
                report.save()
            except Report.DoesNotExist:
                pass

        return Response(
            {'message': 'Đã khóa bài viết và cập nhật báo cáo.', 'post_status': post.status},
            status=status.HTTP_200_OK,
        )


class AdminRejectReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        report_id = request.data.get('report_id')
        
        # Update post: set visibility to public and status to published
        post.visibility = 'public'
        post.status = 'published'
        post.save()

        # Update report status to rejected if provided
        if report_id:
            try:
                report = Report.objects.get(id=report_id)
                report.status = 'rejected'
                report.updated_at = timezone.now()
                report.save()
            except Report.DoesNotExist:
                pass

        return Response(
            {'message': 'Đã từ chối báo cáo và công khai bài viết.', 'post_status': post.status, 'visibility': post.visibility},
            status=status.HTTP_200_OK,
        )


class AdminPostPublishView(APIView):
    """
    Approve and publish a post from processing status to published.
    Admin can set visibility (public, private, unlisted).
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get visibility from request (default to public)
        visibility = request.data.get('visibility', 'public')
        
        if visibility not in dict(Post.VisibilityChoices.choices):
            return Response(
                {'error': f'Mức độ hiển thị không hợp lệ: {visibility}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update post status and visibility
        post.status = 'published'
        post.visibility = visibility
        post.published_at = timezone.now()
        post.updated_at = timezone.now()
        post.save()

        return Response(
            {
                'message': 'Đã duyệt và công bố bài viết.',
                'post': {
                    'id': post.id,
                    'status': post.status,
                    'visibility': post.visibility,
                    'published_at': post.published_at.isoformat() if post.published_at else None,
                }
            },
            status=status.HTTP_200_OK,
        )


class AdminPostRejectView(APIView):
    """
    Reject a post - set status to hidden (do not publish).
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, post_id):
        try:
            post = Post.objects.get(id=post_id)
        except Post.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy bài viết.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        reason = request.data.get('reason', 'Bài viết không tuân thủ tiêu chuẩn.')
        
        # Update post status to hidden
        post.status = 'hidden'
        post.updated_at = timezone.now()
        post.save()

        return Response(
            {
                'message': 'Đã từ chối bài viết.',
                'post': {
                    'id': post.id,
                    'status': post.status,
                }
            },
            status=status.HTTP_200_OK,
        )


class AdminNotificationsListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        is_read_filter = request.query_params.get('is_read')
        notification_type = request.query_params.get('type')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        notifications_qs = Notification.objects.filter(
            type='new_post'
        ).select_related('actor_user', 'user')

        if is_read_filter == 'true':
            notifications_qs = notifications_qs.filter(is_read=True)
        elif is_read_filter == 'false':
            notifications_qs = notifications_qs.filter(is_read=False)

        if notification_type:
            notifications_qs = notifications_qs.filter(type=notification_type)

        notifications_qs = notifications_qs.order_by('-created_at')

        total_count = notifications_qs.count()

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        notifications_page = notifications_qs[start_idx:end_idx]

        notifications_data = []

        for notification in notifications_page:
            notifications_data.append({
                'id': notification.id,
                'user_id': notification.user_id,
                'actor_user_id': notification.actor_user_id,
                'actor_username': notification.actor_user.username if notification.actor_user else 'Unknown',
                'type': notification.type,
                'title': notification.title,
                'body': notification.body,
                'reference_type': notification.reference_type,
                'reference_id': notification.reference_id,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat() if notification.created_at else None,
            })

        return Response({
            'notifications': notifications_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total_count,
                'total_pages': (total_count + page_size - 1) // page_size,
            }
        }, status=status.HTTP_200_OK)

class AdminNotificationDetailView(APIView):
    """
    Chi tiết một thông báo cụ thể
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, notification_id):
        try:
            notification = Notification.objects.select_related('actor_user').get(
            id=notification_id,
            type='new_post',
        )
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy thông báo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification_data = {
            'id': notification.id,
            'user_id': notification.user_id,
            'actor_user_id': notification.actor_user_id,
            'actor_username': notification.actor_user.username if notification.actor_user else 'Unknown',
            'actor_avatar': notification.actor_user.profile.avatar_url if notification.actor_user and hasattr(notification.actor_user, 'profile') else None,
            'type': notification.type,
            'title': notification.title,
            'body': notification.body,
            'reference_type': notification.reference_type,
            'reference_id': notification.reference_id,
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat() if notification.created_at else None,
        }

        # Mark as read
        if not notification.is_read:
            notification.is_read = True
            notification.save()
            notification_data['is_read'] = True

        return Response(notification_data, status=status.HTTP_200_OK)


class AdminMarkNotificationAsReadView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                id=notification_id,
                type='new_post',
            )
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy thông báo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.is_read = True
        notification.save(update_fields=['is_read'])

        return Response(
            {'message': 'Đã đánh dấu thông báo đã đọc.', 'is_read': notification.is_read},
            status=status.HTTP_200_OK,
        )

class AdminMarkAllNotificationsAsReadView(APIView):
    """
    Đánh dấu tất cả thông báo đã đọc cho admin này
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        # Mark all unread notifications as read for the current admin
        notifications = Notification.objects.filter(
        type='new_post',
        is_read=False
    )
        
        count = notifications.update(is_read=True)

        return Response(
            {'message': f'Đã đánh dấu {count} thông báo đã đọc.', 'count': count},
            status=status.HTTP_200_OK,
        )




class AdminGetUnreadNotificationCountView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        unread_count = Notification.objects.filter(
            type='new_post',
            is_read=False
        ).count()

        return Response(
            {'unread_count': unread_count},
            status=status.HTTP_200_OK,
        )
    
class AdminDeleteNotificationView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def delete(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                id=notification_id,
                type='new_post',
            )
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy thông báo.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        notification.delete()

        return Response(
            {'message': 'Đã xóa thông báo.'},
            status=status.HTTP_200_OK,
        )
class AdminDebugNotificationsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        admin_user = request.user

        latest_new_posts = list(
            Notification.objects
            .filter(type='new_post')
            .order_by('-created_at')
            .values(
                'id',
                'user_id',
                'actor_user_id',
                'type',
                'title',
                'body',
                'is_read',
                'created_at',
            )[:10]
        )

        return Response({
            'current_admin': {
                'id': admin_user.id,
                'username': admin_user.username,
                'email': admin_user.email,
                'role': getattr(admin_user, 'role', None),
            },
            'total_notifications_in_db': Notification.objects.count(),
            'total_new_post_notifications': Notification.objects.filter(type='new_post').count(),
            'total_unread_new_post_notifications': Notification.objects.filter(type='new_post', is_read=False).count(),
            'latest_new_posts': latest_new_posts,
            'all_admins': list(
                User.objects
                .filter(role__iexact='admin')
                .values('id', 'username', 'email', 'role')
            ),
        }, status=status.HTTP_200_OK)
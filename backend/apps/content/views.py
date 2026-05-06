import os
import tempfile
import ulid
from apps.social.models import HiddenPost, PostLike, SavedPost, Comment, PostShare

from django.db import transaction, models
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.content.services.feed_service import FeedService
from .models import Post, PostAudioVersion, PostDocument
from apps.social.models import HiddenPost
from .serializers import (
    DraftCreateSerializer,
    AudioPreviewSerializer,
    SaveDraftWithAudioSerializer,
    DraftDetailSerializer,
    DraftUpdateSerializer,
    UploadDocumentSerializer,
    FeedItemSerializer,
)
from .services.cloudinary_service import (
    upload_file_to_cloudinary,
    delete_file_from_cloudinary,
)


class TestCloudinaryUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pass

from .services.text_processor import process_text_by_mode, generate_ai_description
from .services.tts_service import generate_audio_file
from .services.slug_service import generate_unique_slug
from .services.document_parser import extract_text_from_file


def estimate_duration_seconds(text: str) -> int:
    text = (text or "").strip()
    if not text:
        return 0

    words = len(text.split())
    return max(5, round(words / 2.2))


def build_fallback_description(text: str, max_length: int = 180) -> str:
    text = (text or "").strip()
    if not text:
        return ""

    compact = " ".join(text.split())
    if len(compact) <= max_length:
        return compact

    shortened = compact[:max_length].rsplit(" ", 1)[0].strip()
    return shortened + "..."


class DraftCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DraftCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        title = (data.get("title") or "").strip() or "Bản nháp audio"
        slug = generate_unique_slug(title)
        now = timezone.now()

        try:
            post = Post.objects.create(
                id=str(ulid.new()),
                user=request.user,
                category_id=None,
                title=title,
                slug=slug,
                description=(data.get("description") or "").strip(),
                original_text=data.get("original_text", ""),
                summary_text=None,
                dialogue_script=None,
                transcript_text=None,
                source_type=data.get("source_type", Post.SourceTypeChoices.MANUAL),
                is_ai_generated=False,
                language_code="vi",
                visibility=Post.VisibilityChoices.PRIVATE,
                status=Post.StatusChoices.DRAFT,
                age_group=None,
                learning_field=None,
                audio_url=None,
                thumbnail_url=None,
                duration_seconds=None,
                download_count=0,
                view_count=0,
                listen_count=0,
                like_count=0,
                comment_count=0,
                save_count=0,
                share_count=0,
                published_at=None,
                created_at=now,
                updated_at=now,
            )

            return Response(
                {
                    "message": "Lưu nháp thành công",
                    "data": DraftDetailSerializer(post).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AudioPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AudioPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        original_text = data["original_text"].strip()
        was_truncated = len(original_text) > 12000
        original_text = original_text[:12000]

        processed_text = process_text_by_mode(
            original_text,
            data["mode"],
        )

        if not processed_text.strip():
            return Response(
                {"error": "Không thể tạo nội dung audio từ văn bản đầu vào."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            generated_description = generate_ai_description(processed_text)
            generated_description = (generated_description or "").strip()
        except Exception:
            generated_description = ""

        if not generated_description:
            generated_description = build_fallback_description(processed_text)

        duration_seconds = estimate_duration_seconds(processed_text)

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            temp_audio_path = tmp.name

        try:
            generate_audio_file(
                text=processed_text,
                voice_name=data["voice_name"],
                output_path=temp_audio_path,
            )

            if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
                raise ValueError("TTS không tạo ra file audio hợp lệ.")

            uploaded = upload_file_to_cloudinary(
                file=temp_audio_path,
                folder="educast/audio_preview",
                resource_type="video",
            )

            audio_url = uploaded.get("secure_url")
            if not audio_url:
                raise ValueError("Upload Cloudinary thành công nhưng không nhận được secure_url.")

            return Response(
                {
                    "message": "Tạo audio preview thành công",
                    "data": {
                        "mode": data["mode"],
                        "processed_text": processed_text,
                        "generated_description": generated_description,
                        "audio_url": audio_url,
                        "public_id": uploaded.get("public_id"),
                        "voice_name": data["voice_name"],
                        "format": uploaded.get("format") or "mp3",
                        "bytes": uploaded.get("bytes"),
                        "duration_seconds": duration_seconds,
                        "was_truncated": was_truncated,
                    },
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"TTS preview failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        finally:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)


class DraftSaveWithAudioView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = SaveDraftWithAudioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        title = (data.get("title") or "").strip() or "Bản nháp audio"
        slug = generate_unique_slug(title)
        mode = data.get("mode", "summary")
        processed_text = data.get("processed_text", "")
        duration_seconds = data.get("duration_seconds") or estimate_duration_seconds(processed_text)
        now = timezone.now()

        summary_text = processed_text if mode == "summary" else None
        dialogue_script = processed_text if mode == "dialogue" else None
        transcript_text = processed_text if mode in ["original", "translate"] else None

        final_description = (data.get("description") or "").strip()
        if not final_description:
            final_description = build_fallback_description(
                processed_text or data.get("original_text", "")
            )

        try:
            post = Post.objects.create(
                id=str(ulid.new()),
                user=request.user,
                category_id=None,
                title=title,
                slug=slug,
                description=final_description,
                original_text=data.get("original_text", ""),
                summary_text=summary_text,
                dialogue_script=dialogue_script,
                transcript_text=transcript_text,
                source_type=data.get("source_type", Post.SourceTypeChoices.MANUAL),
                is_ai_generated=(mode != "original"),
                language_code="vi",
                visibility=Post.VisibilityChoices.PUBLIC,
                status=Post.StatusChoices.PUBLISHED,
                age_group=None,
                learning_field=None,
                audio_url=data["audio_url"],
                thumbnail_url=None,
                duration_seconds=duration_seconds,
                download_count=0,
                view_count=0,
                listen_count=0,
                like_count=0,
                comment_count=0,
                save_count=0,
                share_count=0,
                published_at=now,
                created_at=now,
                updated_at=now,
            )

            PostAudioVersion.objects.create(
                id=str(ulid.new()),
                post=post,
                voice_name=data.get("voice_name", "Minh Tuấn"),
                format=data.get("format", "mp3"),
                bitrate_kbps=None,
                duration_seconds=duration_seconds,
                audio_url=data["audio_url"],
                storage_path=data.get("public_id"),
                is_default=True,
                created_at=now,
            )

            if data.get("source_type") == Post.SourceTypeChoices.UPLOADED_DOCUMENT:
                document_url = (data.get("document_url") or "").strip()
                if document_url:
                    PostDocument.objects.create(
                        id=str(ulid.new()),
                        post=post,
                        file_name=data.get("file_name", ""),
                        file_type=data.get("file_type", ""),
                        file_size=data.get("file_size") or 0,
                        document_url=document_url,
                        storage_path=data.get("document_public_id", ""),
                        uploaded_at=now,
                    )

            return Response(
                {
                    "message": "Lưu nháp có audio thành công",
                    "data": DraftDetailSerializer(post).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MyDraftListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Exclude archived drafts from the list
            drafts = Post.objects.filter(
                user=request.user,
            ).exclude(
                status=Post.StatusChoices.ARCHIVED,
            ).order_by("-created_at")

            return Response(
                {
                    "message": "Lấy danh sách nháp thành công",
                    "data": DraftDetailSerializer(drafts, many=True).data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DraftDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, post_id):
        try:
            post = Post.objects.get(
                id=post_id,
                user=request.user,
            )

            return Response(
                {
                    "message": "Lấy chi tiết nháp thành công",
                    "data": DraftDetailSerializer(post).data,
                },
                status=status.HTTP_200_OK,
            )

        except Post.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy bản nháp"},
                status=status.HTTP_404_NOT_FOUND,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DraftUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def put(self, request, post_id):
        try:
            post = Post.objects.get(
                id=post_id,
                user=request.user,
            )
        except Post.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy bản nháp"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = DraftUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            text_changed = False

            # Handle status update (e.g., archiving)
            if "status" in data and data["status"]:
                post.status = data["status"]

            if "title" in data and data["title"]:
                post.title = data["title"]
                post.slug = generate_unique_slug(data["title"])

            if "description" in data:
                post.description = data["description"]

            if "original_text" in data:
                new_text = (data["original_text"] or "").strip()
                old_text = (post.original_text or "").strip()

                if new_text != old_text:
                    text_changed = True
                    post.original_text = new_text

            if text_changed:
                old_audio_versions = PostAudioVersion.objects.filter(post=post)

                for audio in old_audio_versions:
                    if audio.storage_path:
                        delete_file_from_cloudinary(
                            public_id=audio.storage_path,
                            resource_type="video",
                        )

                old_audio_versions.update(is_default=False)

                post.summary_text = None
                post.dialogue_script = None
                post.transcript_text = None
                post.audio_url = None
                post.duration_seconds = None
                post.is_ai_generated = False

            if "summary_text" in data:
                post.summary_text = data["summary_text"]

            if "dialogue_script" in data:
                post.dialogue_script = data["dialogue_script"]

            if "transcript_text" in data:
                post.transcript_text = data["transcript_text"]

            if "audio_url" in data and data["audio_url"]:
                old_default_audio = PostAudioVersion.objects.filter(
                    post=post,
                    is_default=True,
                ).first()

                if old_default_audio and old_default_audio.storage_path:
                    delete_file_from_cloudinary(
                        public_id=old_default_audio.storage_path,
                        resource_type="video",
                    )

                post.audio_url = data["audio_url"]
                post.duration_seconds = data.get("duration_seconds") or estimate_duration_seconds(
                    data.get("summary_text")
                    or data.get("dialogue_script")
                    or data.get("transcript_text")
                    or post.original_text
                )
                post.is_ai_generated = True

                PostAudioVersion.objects.filter(post=post).update(is_default=False)

                PostAudioVersion.objects.create(
                    id=str(ulid.new()),
                    post=post,
                    voice_name=data.get("voice_name") or "Minh Tuấn",
                    format=data.get("format") or "mp3",
                    bitrate_kbps=None,
                    duration_seconds=post.duration_seconds,
                    audio_url=data["audio_url"],
                    storage_path=data.get("public_id"),
                    is_default=True,
                    created_at=timezone.now(),
                )

            post.updated_at = timezone.now()
            post.save()

            return Response(
                {
                    "message": "Cập nhật bản nháp thành công",
                    "data": DraftDetailSerializer(post).data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DraftDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def delete(self, request, post_id):
        try:
            post = Post.objects.get(
                id=post_id,
                user=request.user,
            )
        except Post.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy bản nháp"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            audio_versions = PostAudioVersion.objects.filter(post=post)

            for audio in audio_versions:
                if audio.storage_path:
                    delete_file_from_cloudinary(
                        public_id=audio.storage_path,
                        resource_type="video",
                    )

            document_files = PostDocument.objects.filter(post=post)
            for doc in document_files:
                if doc.storage_path:
                    delete_file_from_cloudinary(
                        public_id=doc.storage_path,
                        resource_type="raw",
                    )

            post.status = "archived"
            post.updated_at = timezone.now()
            post.save(update_fields=["status", "updated_at"])

            return Response(
                {"message": "Xóa bản nháp thành công"},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PublishPostView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, post_id):
        """Publish a draft post (change status to published and visibility to public)"""
        try:
            post = Post.objects.get(
                id=post_id,
                user=request.user,
            )
        except Post.DoesNotExist:
            return Response(
                {"error": "Không tìm thấy bài viết"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            # Update status and visibility
            post.status = "published"
            post.visibility = "public"
            post.published_at = timezone.now()
            post.updated_at = timezone.now()
            post.save(update_fields=["status", "visibility", "published_at", "updated_at"])

            return Response(
                {
                    "message": "Xuất bản bài viết thành công",
                    "data": DraftDetailSerializer(post).data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UploadDocumentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UploadDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data["file"]

        try:
            extracted_text = extract_text_from_file(file)

            if not extracted_text.strip():
                return Response(
                    {
                        "error": "Không thể trích xuất nội dung từ file. Vui lòng dùng file PDF có text, hoặc thử .docx/.txt."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            file.seek(0)
            uploaded = upload_file_to_cloudinary(
                file=file,
                folder="educast/documents",
                resource_type="raw",
            )

            return Response(
                {
                    "message": "Upload file thành công",
                    "data": {
                        "file_name": file.name,
                        "file_type": getattr(file, "content_type", "") or "",
                        "file_size": file.size,
                        "document_url": uploaded.get("secure_url"),
                        "public_id": uploaded.get("public_id"),
                        "extracted_text": extracted_text,
                    },
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class FeedAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", 20))
            feed_type = request.query_params.get("tab", "for_you")
            
            tag_ids_param = request.query_params.get("tags", "")
            tag_ids = None
            if tag_ids_param:
                try:
                    tag_ids = [tid.strip() for tid in tag_ids_param.split(",") if tid.strip()]
                except:
                    tag_ids = None

            items = FeedService.get_feed(
                user=request.user,
                limit=limit,
                feed_type=feed_type,
                tag_ids=tag_ids,
            )
            
            hidden_ids = set(
                str(post_id).strip()
                for post_id in HiddenPost.objects.filter(
                    user_id=str(request.user.id)
                ).values_list("post_id", flat=True)
            )

            items = [
                item for item in items
                if str(item.get("id", "")).strip() not in hidden_ids
            ]

            

            serializer = FeedItemSerializer(items, many=True)
            
            return Response({
                "items": serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            print(f" Feed error: {str(e)}")
            traceback.print_exc()
            return Response({
                "error": f"Failed to load feed: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SearchAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        search_type = request.query_params.get("type", "all")  # all, posts, authors, tags
        limit = int(request.query_params.get("limit", 20))
        offset = int(request.query_params.get("offset", 0))

        if not query or len(query) < 2:
            return Response({
                "posts": [],
                "authors": [],
            }, status=status.HTTP_200_OK)

        results = {
            "posts": [],
            "authors": [],
        }

        # Search Posts (Podcasts) - bao gồm posts với tag + posts của authors
        if search_type in ["all", "posts"]:
            from apps.content.models import Tag, PostTag
            from apps.users.models import User
            
            # Tìm direct by title/description
            posts_qs = Post.objects.filter(
                status="published",
                visibility="public"
            ).exclude(
                status="archived"
            ).filter(
                models.Q(title__icontains=query) |
                models.Q(description__icontains=query)
            ).select_related("user", "user__profile").order_by("-created_at")

            hidden_post_ids = HiddenPost.objects.filter(
                user_id=request.user.id
            ).values_list("post_id", flat=True)

            posts_qs = posts_qs.exclude(id__in=hidden_post_ids)
            
            # Thêm posts của authors có display_name chứa query
            authors_matching = User.objects.filter(
                models.Q(username__icontains=query) |
                models.Q(profile__display_name__icontains=query)
            )
            if authors_matching.exists():
                author_post_ids = Post.objects.filter(
                    user__in=authors_matching,
                    status="published",
                    visibility="public"
                ).exclude(id__in=hidden_post_ids).values_list("id", flat=True)
                
                posts_by_author = Post.objects.filter(
                    id__in=author_post_ids
                ).select_related("user", "user__profile").order_by("-created_at")
                
                posts_qs = posts_qs | posts_by_author
            
            # Nếu tìm tag, thêm posts của tag đó
            tags = Tag.objects.filter(name__icontains=query)
            if tags.exists():
                tag_post_ids = PostTag.objects.filter(
                    tag__in=tags
                ).values_list("post_id", flat=True)
                
                posts_with_tag = Post.objects.filter(
                    id__in=tag_post_ids,
                    status="published",
                    visibility="public"
                ).exclude(id__in=hidden_post_ids).select_related("user", "user__profile").order_by("-created_at")
                
                posts_qs = posts_qs | posts_with_tag
            
            posts_qs = posts_qs.distinct().order_by("-created_at")[offset:offset+limit]

            posts_data = []
            for post in posts_qs:
                author_name = post.user.username
                if hasattr(post.user, 'profile') and post.user.profile:
                    author_name = post.user.profile.display_name or post.user.username

                is_liked = PostLike.objects.filter(
                    user_id=request.user.id,
                    post_id=post.id
                ).exists()

                is_saved = SavedPost.objects.filter(
                    user_id=request.user.id,
                    post_id=post.id
                ).exists()

                posts_data.append({
                    "id": post.id,
                    "title": post.title,
                    "description": post.description,
                    "author": author_name,
                    "author_id": post.user.id,
                    "thumbnail_url": post.thumbnail_url,
                    "listen_count": post.listen_count,
                    "duration_seconds": post.duration_seconds,
                    "created_at": post.created_at.isoformat(),

                    "like_count": PostLike.objects.filter(post_id=post.id).count(),
                    "comment_count": Comment.objects.filter(post_id=post.id).count(),
                    "save_count": SavedPost.objects.filter(post_id=post.id).count(),
                    "share_count": PostShare.objects.filter(
                        post_id=post.id,
                        share_type="personal"
                    ).count(),

                    "is_liked": is_liked,
                    "is_saved": is_saved,
                })
            results["posts"] = posts_data

        # Search Authors
        if search_type in ["all", "authors"]:
            from apps.users.models import User
            from django.db.models import Q
            
            authors_qs = User.objects.filter(
                Q(username__icontains=query) |
                Q(profile__display_name__icontains=query)
            ).select_related("profile")[:limit]

            authors_data = []
            for author in authors_qs:
                avatar_url = None
                if hasattr(author, 'profile') and author.profile:
                    avatar_url = author.profile.avatar_url
                
                display_name = getattr(author.profile, 'display_name', None) if hasattr(author, 'profile') and author.profile else author.username
                
                if avatar_url and (':\\' in avatar_url or avatar_url.startswith('/')):
                    avatar_url = None
                
                if not avatar_url:
                    avatar_url = f'https://ui-avatars.com/api/?name={display_name.replace(" ", "%20")}&background=667eea&color=fff&size=96'
                
                print(f"DEBUG: {author.username} - avatar_url: {avatar_url}")
                
                authors_data.append({
                    "id": author.id,
                    "username": author.username,
                    "display_name": display_name,
                    "avatar_url": avatar_url,
                })
            
            results["authors"] = authors_data

        return Response(results, status=status.HTTP_200_OK)


class UserPostsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    
    def _build_post_data(self, post, request_user_id, share_info=None):
        """Helper to build complete post data"""
        from apps.social.models import PostShare
        
        author_name = post.user.username
        if hasattr(post.user, 'profile') and post.user.profile:
            author_name = post.user.profile.display_name or post.user.username
        
        author_avatar = None
        if hasattr(post.user, 'profile') and post.user.profile:
            author_avatar = post.user.profile.avatar_url
        
        is_liked = PostLike.objects.filter(
            user_id=request_user_id,
            post_id=post.id
        ).exists() if request_user_id else False
        
        print(f"🔍 _build_post_data: post_id={post.id}, user_id={request_user_id}, is_liked={is_liked}, share_info={share_info}")
        
        is_saved = SavedPost.objects.filter(
            user_id=request_user_id,
            post_id=post.id
        ).exists() if request_user_id else False
        
        # Lấy counts thực tế từ bài gốc (cả bài share và bài gốc đều dùng counts của bài gốc)
        like_count = PostLike.objects.filter(post_id=post.id).count()
        comment_count = Comment.objects.filter(post_id=post.id).count()
        save_count = SavedPost.objects.filter(post_id=post.id).count()
        share_count = PostShare.objects.filter(post_id=post.id, share_type="personal").count()
        
        post_data = {
            "id": post.id,
            "title": post.title,
            "description": post.description,
            "original_text": post.original_text,
            "summary_text": post.summary_text,
            "dialogue_script": post.dialogue_script,
            "transcript_text": post.transcript_text,
            "author": author_name,
            "author_id": post.user.id,
            "author_avatar": author_avatar,
            "thumbnail_url": post.thumbnail_url,
            "audio_url": post.audio_url,
            "listen_count": post.listen_count,
            "view_count": post.view_count,
            "download_count": post.download_count,
            "duration_seconds": post.duration_seconds,
            "category_id": post.category_id,
            "age_group": post.age_group,
            "learning_field": post.learning_field,
            "language_code": post.language_code,
            "source_type": post.source_type,
            "is_ai_generated": post.is_ai_generated,
            "created_at": post.created_at.isoformat(),
            "published_at": post.published_at.isoformat() if post.published_at else None,
            "updated_at": post.updated_at.isoformat() if post.updated_at else None,
            "like_count": like_count,
            "comment_count": comment_count,
            "save_count": save_count,
            "share_count": share_count,
            "is_liked": is_liked,
            "is_saved": is_saved,
        }
        
        # Add share info if provided
        if share_info:
            post_data.update(share_info)
        
        return post_data

    def get(self, request, user_id=None):
        """Get all posts (published) + shared posts of a user"""
        try:
            target_user_id = user_id or str(request.user.id)
            
            from apps.users.models import User
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({
                    "error": "User not found",
                    "posts": []
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get current user ID for checking likes/saves
            current_user_id = request.user.id if request.user and request.user.is_authenticated else None
            
            # Get hidden post IDs for the viewing user (not the target user)
            hidden_post_ids = set()
            if current_user_id:
                hidden_post_ids = set(
                    HiddenPost.objects.filter(user_id=current_user_id)
                    .values_list("post_id", flat=True)
                )
            
            # Get user's published posts (exclude hidden posts)
            posts_qs = (
                Post.objects
                .filter(user_id=target_user_id, status="published", visibility="public")
                .exclude(id__in=hidden_post_ids)
                .select_related("user", "user__profile")
                .order_by("-created_at")
            )
            
            limit = int(request.query_params.get("limit", 100))
            posts = list(posts_qs[:limit])
            
            posts_data = []
            for post in posts:
                post_data = self._build_post_data(post, current_user_id)
                post_data["type"] = "original"
                posts_data.append(post_data)
            
            # Get user's shared posts (exclude hidden posts)
            from apps.social.models import PostShare
            shared_posts_qs = (
                PostShare.objects
                .filter(user_id=target_user_id, share_type="personal")
                .exclude(post_id__in=hidden_post_ids)
                .select_related("post", "post__user", "post__user__profile")
                .order_by("-created_at")
            )
            
            shared_posts_list = list(shared_posts_qs[:limit])
            
            for share in shared_posts_list:
                post = share.post
                if not post:
                    continue
                
                share_info = {
                    "id": f"share_{share.id}_{post.id}",
                    "share_id": share.id,
                    "post_id": post.id,
                    "shared_at": share.created_at.isoformat(),
                    "share_caption": share.caption,
                    "type": "shared"
                }
                
                post_data = self._build_post_data(post, current_user_id, share_info)
                posts_data.append(post_data)
            
            # Sort by created_at (newest first), but for shared posts use shared_at
            posts_data.sort(key=lambda x: x.get("shared_at") or x.get("created_at"), reverse=True)
            
            return Response({
                "data": {
                    "posts": posts_data
                },
                "success": True
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "error": f"Failed to load user posts: {str(e)}",
                "posts": []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserSharedPostsAPIView(APIView):
    """API để lấy danh sách bài viết mà user đã chia sẻ"""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id=None):
        """Get all shared posts of a user"""
        try:
            target_user_id = user_id or str(request.user.id)
            
            from apps.users.models import User
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({
                    "error": "User not found",
                    "shared_posts": []
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Lấy danh sách shared posts (thông qua PostShare model)
            shared_posts_qs = (
                PostShare.objects
                .filter(user_id=target_user_id, share_type="personal")
                .select_related("post", "post__user", "post__user__profile")
                .order_by("-created_at")
            )
            
            limit = int(request.query_params.get("limit", 100))
            shared_posts = list(shared_posts_qs[:limit])
            
            posts_data = []
            for share in shared_posts:
                post = share.post
                author_name = post.user.username
                if hasattr(post.user, 'profile') and post.user.profile:
                    author_name = post.user.profile.display_name or post.user.username
                
                is_liked = PostLike.objects.filter(
                    user_id=request.user.id,
                    post_id=post.id
                ).exists()
                
                is_saved = SavedPost.objects.filter(
                    user_id=request.user.id,
                    post_id=post.id
                ).exists()
                
                posts_data.append({
                    "id": post.id,
                    "title": post.title,
                    "description": post.description,
                    "author": author_name,
                    "author_id": post.user.id,
                    "thumbnail_url": post.thumbnail_url,
                    "listen_count": post.listen_count,
                    "duration_seconds": post.duration_seconds,
                    "created_at": post.created_at.isoformat(),
                    "shared_at": share.created_at.isoformat(),
                    "share_caption": share.caption,
                    "like_count": PostLike.objects.filter(post_id=post.id).count(),
                    "comment_count": Comment.objects.filter(post_id=post.id).count(),
                    "save_count": SavedPost.objects.filter(post_id=post.id).count(),
                    "share_count": PostShare.objects.filter(post_id=post.id, share_type="personal").count(),
                    "is_liked": is_liked,
                    "is_saved": is_saved,
                })
            
            return Response({
                "data": {
                    "shared_posts": posts_data
                },
                "success": True
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                "error": f"Failed to load user shared posts: {str(e)}",
                "shared_posts": []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
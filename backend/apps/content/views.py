import os
import tempfile
import ulid

from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Post, PostAudioVersion, PostDocument
from .serializers import (
    DraftCreateSerializer,
    AudioPreviewSerializer,
    SaveDraftWithAudioSerializer,
    DraftDetailSerializer,
    DraftUpdateSerializer,
    UploadDocumentSerializer,
)
from .services.cloudinary_service import (
    upload_file_to_cloudinary,
    delete_file_from_cloudinary,
)
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

            uploaded = upload_file_to_cloudinary(
                file=temp_audio_path,
                folder="educast/audio_preview",
                resource_type="video",
            )

            return Response(
                {
                    "message": "Tạo audio preview thành công",
                    "data": {
                        "mode": data["mode"],
                        "processed_text": processed_text,
                        "generated_description": generated_description,
                        "audio_url": uploaded.get("secure_url"),
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
                {"error": str(e)},
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
                visibility=Post.VisibilityChoices.PRIVATE,
                status=Post.StatusChoices.DRAFT,
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
                published_at=None,
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

            post.delete()

            return Response(
                {"message": "Xóa bản nháp thành công"},
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
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
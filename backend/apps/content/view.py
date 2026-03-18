from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from services.cloudinary_service import upload_file_to_cloudinary


class TestCloudinaryUploadView(APIView):
    def post(self, request):
        file = request.FILES.get("file")

        if not file:
            return Response(
                {"error": "Không tìm thấy file trong request"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            uploaded = upload_file_to_cloudinary(
                file=file,
                folder="educast/test_uploads",
                resource_type="auto"
            )

            return Response(
                {
                    "message": "Upload thành công",
                    "data": uploaded
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
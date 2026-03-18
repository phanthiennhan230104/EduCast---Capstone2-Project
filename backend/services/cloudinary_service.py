import cloudinary
import cloudinary.uploader
from django.conf import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_STORAGE["CLOUD_NAME"],
    api_key=settings.CLOUDINARY_STORAGE["API_KEY"],
    api_secret=settings.CLOUDINARY_STORAGE["API_SECRET"],
    secure=True
)


def upload_file_to_cloudinary(file, folder="educast/files", resource_type="auto"):
    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        resource_type=resource_type
    )

    return {
        "public_id": result.get("public_id"),
        "secure_url": result.get("secure_url"),
        "resource_type": result.get("resource_type"),
        "format": result.get("format"),
        "bytes": result.get("bytes"),
        "created_at": result.get("created_at"),
    }
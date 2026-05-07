import cloudinary
import cloudinary.uploader
from django.conf import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_STORAGE["CLOUD_NAME"],
    api_key=settings.CLOUDINARY_STORAGE["API_KEY"],
    api_secret=settings.CLOUDINARY_STORAGE["API_SECRET"],
    secure=True,
)

def get_audio_duration_from_api(public_id, resource_type="video"):
    if not public_id:
        return None

    try:
        resource = cloudinary.api.resource(
            public_id,
            resource_type=resource_type,
            type="upload",
            media_metadata=True,
        )

        duration = resource.get("duration")

        if duration is None:
            media_metadata = resource.get("media_metadata") or {}
            duration = media_metadata.get("duration")

        if duration is None:
            video_metadata = resource.get("video") or {}
            duration = video_metadata.get("duration")

        if duration is None:
            print(f"No duration found for {public_id}")
            print("Cloudinary keys:", resource.keys())
            print("media_metadata:", resource.get("media_metadata"))
            return None

        return int(round(float(duration)))

    except Exception as e:
        print(f"Cloudinary API error for {public_id}: {e}")
        return None

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


def delete_file_from_cloudinary(public_id, resource_type="auto"):
    if not public_id:
        return None

    return cloudinary.uploader.destroy(
        public_id,
        resource_type=resource_type
    )
from django.conf import settings
from django.http import HttpResponse


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

        env_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", None) or []

        self.allowed_origins = set(env_origins) | {
            "https://edu-cast-capstone2-project.vercel.app",
            "https://edu-cast-capstone2-project-b1bc19qoy.vercel.app",
            "http://localhost:5173",
        }

    def __call__(self, request):
        origin = (request.headers.get("Origin") or "").rstrip("/")

        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        if origin in self.allowed_origins:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization, X-Requested-With, Accept, Origin"
            )
            response["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response["Access-Control-Max-Age"] = "3600"

        response["Vary"] = "Origin"
        return response
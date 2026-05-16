from django.conf import settings
from django.http import HttpResponse


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        origins = getattr(settings, "CORS_ALLOWED_ORIGINS", None) or ()
        self.allowed_origins = frozenset(origins)

    def __call__(self, request):
        origin = (request.headers.get("Origin") or "").rstrip("/")

        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        # CORS: Only echo explicit allowed origins.
        # Never return "*" for browser CORS, especially when credentials are involved.
        if origin and origin in self.allowed_origins:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Max-Age"] = "3600"
        elif origin:
            # Untrusted cross-origin request: don't add CORS headers.
            pass
        else:
            # Same-origin / non-browser clients (no Origin header)
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"

        response["Vary"] = "Origin"

        return response
from django.http import HttpResponse


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        request_headers = request.headers.get(
            "Access-Control-Request-Headers",
            "Content-Type, Authorization, X-Requested-With, Accept, Origin",
        )

        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        if origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Headers"] = request_headers
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Max-Age"] = "86400"

        response["Vary"] = "Origin"
        return response
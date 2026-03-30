from django.utils.text import slugify
from apps.content.models import Post


def generate_unique_slug(title: str) -> str:
    base_slug = slugify(title or "ban-nhap-audio")
    if not base_slug:
        base_slug = "ban-nhap-audio"

    slug = base_slug
    counter = 1

    while Post.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug
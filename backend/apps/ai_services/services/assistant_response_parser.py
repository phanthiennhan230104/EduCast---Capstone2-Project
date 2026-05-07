import json
import re
from typing import Any

from rest_framework.exceptions import ValidationError

from apps.ai_services.serializers import AssistantGeneratedPayloadSerializer


def _clean_text(raw_text: str) -> str:
    return (raw_text or "").strip()


def _extract_json_from_fenced_block(text: str) -> dict[str, Any] | None:
    matches = re.findall(r"```json\s*(.*?)\s*```", text, flags=re.IGNORECASE | re.DOTALL)
    for candidate in matches:
        candidate = candidate.strip()
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    return None


def _extract_first_valid_json_object(text: str) -> dict[str, Any] | None:
    decoder = json.JSONDecoder()

    for index, char in enumerate(text):
        if char != "{":
            continue

        try:
            parsed, _ = decoder.raw_decode(text[index:])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    return None


def extract_json_object(raw_text: str) -> dict[str, Any]:
    text = _clean_text(raw_text)

    if not text:
        raise ValueError("Empty assistant response")

    fenced_json = _extract_json_from_fenced_block(text)
    if fenced_json is not None:
        return fenced_json

    first_object = _extract_first_valid_json_object(text)
    if first_object is not None:
        return first_object

    raise ValueError("No valid JSON object found in assistant response")


def normalize_generate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    serializer = AssistantGeneratedPayloadSerializer(data=payload)
    try:
        serializer.is_valid(raise_exception=True)
    except ValidationError as exc:
        raise ValueError(f"Invalid assistant payload schema: {exc.detail}") from exc

    validated = serializer.validated_data

    content = validated.get("content", {})
    validated["content"] = {
        "title": str(content.get("title", "")).strip(),
        "description": str(content.get("description", "")).strip(),
        "body": str(content.get("body", "")).strip(),
        "bullets": [str(item).strip() for item in content.get("bullets", []) if str(item).strip()],
        "hashtags": [str(item).strip() for item in content.get("hashtags", []) if str(item).strip()],
    }

    validated["summary"] = str(validated.get("summary", "")).strip()
    validated["suggestions"] = [
        str(item).strip()
        for item in validated.get("suggestions", [])
        if str(item).strip()
    ]

    return validated
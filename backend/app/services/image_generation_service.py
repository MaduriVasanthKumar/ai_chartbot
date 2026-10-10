import asyncio
import base64
import os
from typing import Any, Dict

from app.config import GEMINI_API_KEY, GEMINI_IMAGE_MODEL

try:
    from google import genai
    from google.genai import types
    GENAI_SDK_AVAILABLE = True
except ImportError:
    GENAI_SDK_AVAILABLE = False

IMAGE_MODEL = GEMINI_IMAGE_MODEL
ALLOWED_ASPECT_RATIOS = {"1:1", "16:9", "9:16", "4:3", "3:4"}


class ImageGenerationQuotaError(ValueError):
    """Raised when Google has no image-generation quota for the configured project."""


class ImageGenerationServiceError(ValueError):
    """Raised for provider failures that are not quota-related."""


ALLOWED_STYLES = {
    "educational illustration",
    "photorealistic",
    "digital art",
    "watercolor",
    "3d render",
    "minimalist diagram",
}


class ImageGenerationService:
    @staticmethod
    async def generate(
        prompt: str,
        style: str = "educational illustration",
        aspect_ratio: str = "1:1",
    ) -> Dict[str, Any]:
        api_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("Image generation is not configured. Add GEMINI_API_KEY to the backend .env file.")
        if not GENAI_SDK_AVAILABLE:
            raise ValueError("The Google GenAI SDK is not installed on the backend.")

        clean_prompt = prompt.strip()
        if len(clean_prompt) < 3:
            raise ValueError("Enter an image prompt with at least 3 characters.")
        if len(clean_prompt) > 2000:
            raise ValueError("Image prompts must be 2000 characters or fewer.")

        selected_style = style if style in ALLOWED_STYLES else "educational illustration"
        selected_ratio = aspect_ratio if aspect_ratio in ALLOWED_ASPECT_RATIOS else "1:1"
        full_prompt = (
            f"Create a high-quality image for a student learning assistant. "
            f"Style: {selected_style}. Aspect ratio: {selected_ratio}. "
            f"Prompt: {clean_prompt}"
        )

        try:
            client = genai.Client(api_key=api_key)
            config = types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=selected_ratio),
            )
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=IMAGE_MODEL,
                contents=full_prompt,
                config=config,
            )
        except Exception as error:
            error_text = str(error)
            status_code = getattr(error, "code", None) or getattr(error, "status_code", None)
            is_quota_error = (
                status_code == 429
                or "429" in error_text
                or "RESOURCE_EXHAUSTED" in error_text
                or "generate_content_free_tier_requests" in error_text
            )
            if is_quota_error:
                print(f"[Image Generation Quota] {error_text}")
                raise ImageGenerationQuotaError(
                    "Google image-generation quota is unavailable for this project. "
                    "Enable billing/image-model access in Google AI Studio or wait for the quota reset, then retry."
                ) from error
            print(f"[Image Generation Error] {error_text}")
            raise ImageGenerationServiceError(
                "Image generation failed. Check the backend Gemini configuration and try again."
            ) from error

        parts = getattr(response, "parts", None) or []
        if not parts:
            for candidate in getattr(response, "candidates", None) or []:
                content = getattr(candidate, "content", None)
                parts.extend(getattr(content, "parts", None) or [])

        for part in parts:
            inline_data = getattr(part, "inline_data", None)
            image_bytes = getattr(inline_data, "data", None) if inline_data else None
            if image_bytes:
                if isinstance(image_bytes, str):
                    image_bytes = base64.b64decode(image_bytes)
                mime_type = getattr(inline_data, "mime_type", None) or "image/png"
                return {
                    "mime_type": mime_type,
                    "image_base64": base64.b64encode(image_bytes).decode("ascii"),
                    "model": IMAGE_MODEL,
                    "prompt": clean_prompt,
                    "style": selected_style,
                    "aspect_ratio": selected_ratio,
                }

        raise ValueError("The image model returned no image. Try a more specific prompt.")

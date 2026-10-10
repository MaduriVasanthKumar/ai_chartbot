import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services import ai_service


class FakeModels:
    def __init__(self, response=None, get_error=None, generate_error=None):
        self.response = response
        self.get_error = get_error
        self.generate_error = generate_error
        self.generate_calls = []

    def get(self, *, model):
        if self.get_error:
            raise self.get_error
        return SimpleNamespace(supported_actions=["generateContent"])

    def generate_content(self, *, model, contents, config):
        self.generate_calls.append(
            {"model": model, "contents": contents, "config": config}
        )
        if self.generate_error:
            raise self.generate_error
        return self.response


class FakeClient:
    def __init__(self, models):
        self.models = models


def fake_response(*texts):
    return SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(
                    parts=[SimpleNamespace(text=text) for text in texts]
                )
            )
        ]
    )


class GeminiServiceTests(unittest.IsolatedAsyncioTestCase):
    def make_client(self, response=None, get_error=None, generate_error=None):
        models = FakeModels(
            response=response,
            get_error=get_error,
            generate_error=generate_error,
        )
        client = FakeClient(models)
        fake_genai = SimpleNamespace(Client=lambda **kwargs: client)
        return client, fake_genai

    async def test_greeting_uses_live_gemini_response(self):
        client, fake_genai = self.make_client(fake_response("Hello! Ready to learn?"))
        with patch.object(ai_service, "GEMINI_API_KEY", "test-key"), patch.object(
            ai_service, "GEMINI_MODEL", "gemini-test"
        ), patch.object(ai_service, "genai", fake_genai), patch.object(
            ai_service, "GENAI_SDK_AVAILABLE", True
        ):
            result = await ai_service.generate_ai_response(
                [{"role": "user", "content": "Hi"}]
            )

        self.assertEqual(result, "Hello! Ready to learn?")
        self.assertEqual(client.models.generate_calls[0]["model"], "gemini-test")

    async def test_educational_question_returns_provider_text(self):
        client, fake_genai = self.make_client(
            fake_response("Photosynthesis converts light energy into chemical energy.")
        )
        with patch.object(ai_service, "GEMINI_API_KEY", "test-key"), patch.object(
            ai_service, "GEMINI_MODEL", "gemini-test"
        ), patch.object(ai_service, "genai", fake_genai), patch.object(
            ai_service, "GENAI_SDK_AVAILABLE", True
        ):
            result = await ai_service.generate_ai_response(
                [{"role": "user", "content": "What is photosynthesis?"}],
                mode="concept",
            )

        self.assertIn("Photosynthesis", result)
        self.assertNotIn("solution_example", result)
        self.assertEqual(len(client.models.generate_calls), 1)

    async def test_contextual_follow_up_preserves_chronological_history(self):
        client, fake_genai = self.make_client(fake_response("Here is the line-by-line explanation."))
        history = [
            {"role": "user", "content": "Explain Python lists."},
            {"role": "model", "content": "A list is an ordered collection."},
            {"role": "user", "content": "Explain this line by line."},
        ]
        with patch.object(ai_service, "GEMINI_API_KEY", "test-key"), patch.object(
            ai_service, "GEMINI_MODEL", "gemini-test"
        ), patch.object(ai_service, "genai", fake_genai), patch.object(
            ai_service, "GENAI_SDK_AVAILABLE", True
        ):
            await ai_service.generate_ai_response(history)

        contents = client.models.generate_calls[0]["contents"]
        actual = [(item.role, item.parts[0].text) for item in contents]
        self.assertEqual(
            actual,
            [
                ("user", "Explain Python lists."),
                ("model", "A list is an ordered collection."),
                ("user", "Explain this line by line."),
            ],
        )

    async def test_missing_credentials_is_explicit(self):
        with patch.object(ai_service, "GEMINI_API_KEY", ""), patch.dict(
            os.environ, {"GEMINI_API_KEY": ""}, clear=False
        ):
            with self.assertRaises(ai_service.MissingGeminiCredentialsError) as context:
                await ai_service.generate_ai_response(
                    [{"role": "user", "content": "Hello"}]
                )

        self.assertIn("credentials", str(context.exception).lower())

    async def test_unsupported_model_is_explicit(self):
        client, fake_genai = self.make_client(
            fake_response("unused"), get_error=RuntimeError("404 NOT_FOUND")
        )
        with patch.object(ai_service, "GEMINI_API_KEY", "test-key"), patch.object(
            ai_service, "GEMINI_MODEL", "bad-model"
        ), patch.object(ai_service, "genai", fake_genai), patch.object(
            ai_service, "GENAI_SDK_AVAILABLE", True
        ):
            with self.assertRaises(ai_service.GeminiModelError) as context:
                await ai_service.generate_ai_response(
                    [{"role": "user", "content": "Hello"}]
                )

        self.assertIn("configured Gemini model", str(context.exception))
        self.assertEqual(client.models.generate_calls, [])

    async def test_quota_failure_is_not_converted_to_fallback(self):
        client, fake_genai = self.make_client(
            generate_error=RuntimeError("429 RESOURCE_EXHAUSTED quota exceeded")
        )
        with patch.object(ai_service, "GEMINI_API_KEY", "test-key"), patch.object(
            ai_service, "GEMINI_MODEL", "gemini-test"
        ), patch.object(ai_service, "genai", fake_genai), patch.object(
            ai_service, "GENAI_SDK_AVAILABLE", True
        ):
            with self.assertRaises(ai_service.GeminiQuotaError) as context:
                await ai_service.generate_ai_response(
                    [{"role": "user", "content": "Explain gravity."}]
                )

        message = str(context.exception)
        self.assertIn("quota", message.lower())
        self.assertNotIn("EduMate AI Learning Breakdown", message)

    async def test_generic_provider_failure_is_safe(self):
        client, fake_genai = self.make_client(
            generate_error=RuntimeError("private provider payload with secret-looking details")
        )
        with patch.object(ai_service, "GEMINI_API_KEY", "test-key"), patch.object(
            ai_service, "GEMINI_MODEL", "gemini-test"
        ), patch.object(ai_service, "genai", fake_genai), patch.object(
            ai_service, "GENAI_SDK_AVAILABLE", True
        ):
            with self.assertRaises(ai_service.GeminiProviderError) as context:
                await ai_service.generate_ai_response(
                    [{"role": "user", "content": "Explain gravity."}]
                )

        self.assertEqual(
            str(context.exception),
            "Gemini API request failed. Check the provider configuration and try again later.",
        )

    def test_response_parser_reads_all_text_parts(self):
        result = ai_service.extract_response_text(fake_response("Part one.", "Part two."))
        self.assertEqual(result, "Part one.\nPart two.")

    def test_response_parser_rejects_empty_response(self):
        with self.assertRaises(ai_service.GeminiResponseError):
            ai_service.extract_response_text(SimpleNamespace(candidates=[]))


if __name__ == "__main__":
    unittest.main()

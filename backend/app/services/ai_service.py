import json
import logging
import os
from typing import List, Dict, Any, Optional, AsyncGenerator

from app.config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)


class GeminiServiceError(Exception):
    """Base class for safe, user-facing Gemini integration errors."""

    status_code = 502


class GeminiConfigurationError(GeminiServiceError):
    status_code = 503


class MissingGeminiCredentialsError(GeminiConfigurationError):
    pass


class GeminiModelError(GeminiConfigurationError):
    pass


class GeminiProviderError(GeminiServiceError):
    pass


class GeminiQuotaError(GeminiProviderError):
    status_code = 429


class GeminiResponseError(GeminiProviderError):
    pass

try:
    from google import genai
    from google.genai import types
    GENAI_SDK_AVAILABLE = True
except ImportError:
    GENAI_SDK_AVAILABLE = False

SYSTEM_PROMPTS = {
    "general": (
        "You are EduMate AI, an advanced, highly intelligent personal AI learning assistant tailored for students. "
        "Your mission is to empower students of all academic levels (High School, Undergraduate, Graduate, Self-Learners) to master any subject. "
        "Always adopt an encouraging, clear, structured, and pedagogical approach. "
        "Use Markdown with LaTeX math syntax (`$e=mc^2$` or `$$...$$`) when appropriate. "
        "Provide code blocks with language tags when discussing programming."
    ),
    "concept": (
        "You are EduMate AI in Concept Breakdown Mode. "
        "Your goal is to make complex topics intuitive and crystal clear. "
        "Structure your response with: 1. Core Intuition / ELI5 summary, 2. Formal Definition, 3. Real-World Analogy, 4. Step-by-Step Breakdown, 5. Key Takeaways."
    ),
    "coding": (
        "You are EduMate AI in Coding Tutor Mode. "
        "Help the student understand programming concepts, debug errors, and write clean software. "
        "Provide: 1. Clear explanation of the logic, 2. Well-formatted code snippet with comments, 3. Line-by-line breakdown, 4. Time & Space Complexity analysis ($O(N)$, $O(1)$), 5. Suggested practice variations or test cases."
    ),
    "math": (
        "You are EduMate AI in Mathematics & Logic Tutor Mode. "
        "Break down mathematical equations, proofs, and quantitative problems step-by-step. "
        "Use LaTeX notation (`$...$` for inline, `$$...$$` for block equations). "
        "Provide: 1. Problem Statement & Given Values, 2. Applicable Formulas/Theorems, 3. Step-by-Step Derivation/Calculation, 4. Final Answer boxed or bolded, 5. Common Pitfalls to Avoid."
    ),
    "exam": (
        "You are EduMate AI in Exam Prep Mode. "
        "Focus on high-yield exam concepts, quick revision summaries, formula cheat sheets, and target practice questions."
    ),
    "interview": (
        "You are EduMate AI in Technical & Academic Interview Tutor Mode. "
        "Simulate technical questions (coding, system design, domain knowledge) and behavioral questions. "
        "Provide structured feedback using the STAR method (Situation, Task, Action, Result) for behavioral answers or optimal algorithm explanations for technical ones."
    ),
    "research": (
        "You are EduMate AI in Academic Research Assistant Mode. "
        "Provide objective, evidence-backed summaries, literature reviews, and research topic maps. "
        "Use clear citations like [Source 1], [Source 2] where web search context or references are provided."
    ),
    "document": (
        "You are EduMate AI in Document Tutor Mode. "
        "Analyze the provided document context thoroughly and answer the student's questions accurately based ONLY on the document context provided. "
        "Reference specific page numbers or sections whenever available. If context is insufficient, state clearly what is missing."
    )
}

def get_system_instruction(mode: str, language: str = "en", memories: List[str] = None, profile: Dict[str, Any] = None) -> str:
    base = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["general"])
    
    extra = []
    if language and language != "en":
        lang_names = {"te": "Telugu", "hi": "Hindi", "es": "Spanish", "fr": "French"}
        target_lang = lang_names.get(language, language)
        extra.append(f"CRITICAL: Respond primarily in {target_lang}. Keep technical terms or code syntax in standard notation if necessary for clarity.")
    
    if profile:
        level = profile.get("academic_level", "Undergraduate")
        extra.append(f"Student Academic Level: {level}. Calibrate detail depth, tone, and terminology for this level.")
    
    if memories and len(memories) > 0:
        mem_str = "\n- ".join(memories)
        extra.append(f"Remembered Student Context across previous sessions:\n- {mem_str}")
        
    if extra:
        return base + "\n\n" + "\n".join(extra)
    return base


def _configured_api_key() -> str:
    return (GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")).strip()


def _configured_model() -> str:
    return (GEMINI_MODEL or os.getenv("GEMINI_MODEL") or "gemini-3.6-flash").strip()


def _safe_exception_text(error: Exception) -> str:
    """Return provider text used only for classification, never for logging."""
    return str(error).lower()


def _classify_provider_error(error: Exception) -> GeminiProviderError:
    text = _safe_exception_text(error)
    if any(marker in text for marker in ("429", "resource_exhausted", "quota", "rate limit", "rate_limit")):
        return GeminiQuotaError(
            "Gemini API quota is exhausted or rate-limited. Check your Google AI Studio quota or billing and try again later."
        )
    if any(marker in text for marker in ("404", "not_found", "not found", "unsupported model", "invalid model")):
        return GeminiModelError(
            "The configured Gemini model is unavailable or does not support content generation."
        )
    return GeminiProviderError(
        "Gemini API request failed. Check the provider configuration and try again later."
    )


def _validate_model(client: Any, model_name: str) -> None:
    """Validate model existence and generation support before generating content."""
    try:
        model = client.models.get(model=model_name)
    except Exception as error:
        classified = _classify_provider_error(error)
        if isinstance(classified, GeminiModelError):
            raise classified from error
        raise GeminiModelError(
            "The configured Gemini model could not be validated."
        ) from error

    supported_actions = getattr(model, "supported_actions", None)
    if supported_actions:
        normalized = {str(action).lower() for action in supported_actions}
        if not any(action in normalized for action in ("generatecontent", "generate_content")):
            raise GeminiModelError(
                "The configured Gemini model does not support content generation."
            )


def _build_contents(messages: List[Dict[str, str]]) -> List[Any]:
    contents = []
    for message in messages:
        role = "user" if message.get("role") == "user" else "model"
        text = str(message.get("content", "")).strip()
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    if not contents:
        raise GeminiResponseError("Gemini needs at least one non-empty message.")
    return contents


def extract_response_text(response: Any) -> str:
    """Extract text from Gemini candidates/parts and reject empty responses."""
    text_parts: List[str] = []
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            text = getattr(part, "text", None)
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())
    if text_parts:
        return "\n".join(text_parts)

    shortcut = getattr(response, "text", None)
    if isinstance(shortcut, str) and shortcut.strip():
        return shortcut.strip()

    raise GeminiResponseError(
        "Gemini returned no usable text. The response may have been blocked or empty."
    )


async def generate_ai_response(
    messages: List[Dict[str, str]],
    mode: str = "general",
    language: str = "en",
    memories: List[str] = None,
    profile: Dict[str, Any] = None,
    document_context: str = None,
    web_context: str = None
) -> str:
    """Generate a live Gemini response; provider failures are never disguised as fallback text."""
    api_key = _configured_api_key()
    if not api_key:
        raise MissingGeminiCredentialsError(
            "Gemini API credentials are not configured on the backend."
        )
    if not GENAI_SDK_AVAILABLE:
        raise GeminiConfigurationError(
            "The Google GenAI SDK is not installed in the backend environment."
        )

    system_instruction = get_system_instruction(mode, language, memories, profile)
    if document_context:
        system_instruction += f"\n\n--- DOCUMENT CONTEXT ---\n{document_context}\n--- END DOCUMENT CONTEXT ---"
    if web_context:
        system_instruction += f"\n\n--- LIVE SEARCH CONTEXT ---\n{web_context}\n--- END SEARCH CONTEXT ---"

    model_name = _configured_model()
    client = genai.Client(api_key=api_key)
    _validate_model(client, model_name)
    contents = _build_contents(messages)
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
        max_output_tokens=2048,
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config,
        )
    except GeminiServiceError:
        raise
    except Exception as error:
        raise _classify_provider_error(error) from error

    return extract_response_text(response)

def generate_educational_fallback(user_query: str, mode: str, language: str, document_context: str = None) -> str:
    """Provides high-quality structured response when API key is not configured."""
    notice = "\n\n> 💡 *Note: To connect to live Google Gemini AI, configure `GEMINI_API_KEY` in your `.env` file.*"
    
    q_lower = user_query.lower()
    
    if document_context:
        snippet = document_context[:300] + "..." if len(document_context) > 300 else document_context
        return (
            f"### Document Analysis Result\n\n"
            f"Based on your uploaded document context:\n\n"
            f"**Query:** \"{user_query}\"\n\n"
            f"**Relevant Passage Summary:**\n"
            f"> {snippet}\n\n"
            f"**Key Insights:**\n"
            f"1. The document directly addresses your question regarding key formulas and definitions.\n"
            f"2. Make sure to review the core concepts in the attached notes.\n"
            f"{notice}"
        )

    normalized_query = q_lower.strip().rstrip("?.!")

    # A definition question about Python is a concept request, not an
    # instruction to generate an arbitrary list-processing function.
    if normalized_query in {"what is python", "explain python", "tell me about python"}:
        return (
            "### What is Python?\n\n"
            "Python is a **high-level, general-purpose programming language** known for its clear syntax and large ecosystem of libraries. "
            "It is commonly used for web development, automation, data analysis, artificial intelligence, scientific computing, and education.\n\n"
            "#### Why Python is popular\n"
            "- **Readable:** Its syntax is close to plain English.\n"
            "- **Versatile:** It supports scripting, object-oriented, and functional programming.\n"
            "- **Extensible:** Thousands of libraries are available for different tasks.\n"
            "- **Beginner-friendly:** You can write useful programs with relatively little code.\n\n"
            "#### Small example\n\n"
            "```python\n"
            "name = \"Nandu\"\n"
            "print(f\"Hello, {name}!\")\n"
            "```\n\n"
            "This program stores text in a variable and prints a greeting."
            f"{notice}"
        )

    coding_terms = (
        "write code", "implement", "debug", "fix this code", "code snippet",
        "example code", "program", "algorithm", "time complexity",
        "space complexity", "function in", "class in", "syntax error",
    )
    is_coding_request = mode == "coding" or any(term in q_lower for term in coding_terms)

    if is_coding_request:
        return (
            f"### Coding Tutor Explanation: {user_query[:50]}\n\n"
            f"Here is a comprehensive breakdown for **{user_query}**:\n\n"
            f"```python\n"
            f"# Example implementation related to your query\n"
            f"def solution_example(data_input):\n"
            f"    \"\"\"\n"
            f"    Demonstrates optimal algorithm logic\n"
            f"    \"\"\"\n"
            f"    results = []\n"
            f"    for item in data_input:\n"
            f"        processed = item * 2  # Step logic\n"
            f"        results.append(processed)\n"
            f"    return results\n\n"
            f"# Usage example\n"
            f"print(solution_example([1, 2, 3, 4]))  # [2, 4, 6, 8]\n"
            f"```\n\n"
            f"#### Complexity Analysis:\n"
            f"- **Time Complexity:** $O(N)$ where $N$ is the number of elements.\n"
            f"- **Space Complexity:** $O(N)$ for storing output results.\n\n"
            f"#### Key Tips:\n"
            f"1. Always check edge cases (empty input, null values).\n"
            f"2. Use modular functions to keep your code testable and readable."
            f"{notice}"
        )
    
    if mode == "math" or "math" in q_lower or "equation" in q_lower or "derivative" in q_lower or "integral" in q_lower:
        return (
            f"### Step-by-Step Mathematics Solution\n\n"
            f"**Problem:** {user_query}\n\n"
            f"#### Step 1: Identify Given Information & Formulas\n"
            f"We apply the standard formula:\n"
            f"$$f(x) = \\int x^n \\, dx = \\frac{{x^{{n+1}}}}{{n+1}} + C, \\quad (n \\neq -1)$$\n\n"
            f"#### Step 2: Calculation\n"
            f"Substituting the values from your problem:\n"
            f"$$f'(x) = 2x + 5 \\implies f(x) = x^2 + 5x + C$$\n\n"
            f"#### Final Answer:\n"
            f"$$\\mathbf{{Result: \\quad x^2 + 5x + C}}$$"
            f"{notice}"
        )

    return (
        f"### EduMate AI Learning Breakdown\n\n"
        f"Thank you for your question about **\"{user_query}\"**!\n\n"
        f"#### Core Concept:\n"
        f"This topic is fundamental in modern learning. It connects foundational theoretical principles with practical applications.\n\n"
        f"#### Key Takeaways:\n"
        f"1. **Definition & Context:** Understanding the core terms and how they relate to real-world scenarios.\n"
        f"2. **Step-by-Step Structure:** Breaking down large ideas into smaller, easily digestible chunks.\n"
        f"3. **Practical Application:** Testing your knowledge through quizzes and coding/math practice.\n\n"
        f"Feel free to ask a follow-up question or generate a practice quiz on this topic!"
        f"{notice}"
    )

async def generate_structured_json(prompt: str, json_schema_desc: str) -> Dict[str, Any]:
    """Generate structured JSON with the live Gemini provider and explicit failures."""
    api_key = _configured_api_key()
    if not api_key:
        raise MissingGeminiCredentialsError(
            "Gemini API credentials are not configured on the backend."
        )
    if not GENAI_SDK_AVAILABLE:
        raise GeminiConfigurationError(
            "The Google GenAI SDK is not installed in the backend environment."
        )

    model_name = _configured_model()
    client = genai.Client(api_key=api_key)
    _validate_model(client, model_name)
    full_prompt = f"{prompt}\n\nCRITICAL: Respond ONLY with valid JSON matching this schema description:\n{json_schema_desc}"

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=full_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        text = extract_response_text(response)
        return json.loads(text)
    except GeminiServiceError:
        raise
    except json.JSONDecodeError as error:
        raise GeminiResponseError(
            "Gemini returned a response that was not valid JSON."
        ) from error
    except Exception as error:
        raise _classify_provider_error(error) from error

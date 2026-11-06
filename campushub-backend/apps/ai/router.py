"""
AI Provider abstraction and implementations.
Gemini-only for now; NVIDIA can be added as a drop-in second provider later.
"""
from django.conf import settings


class AIProvider:
    """Interface for AI providers. A second provider (NVIDIA) can implement this later."""
    
    def generate(self, prompt, system_prompt="", max_tokens=500):
        raise NotImplementedError


class GeminiProvider(AIProvider):
    """Gemini provider using REST API (requests) — avoids google-generativeai package."""
    
    provider_name = 'gemini'
    
    def __init__(self, api_key):
        self.api_key = api_key
        # Verify the model ID against Google's current model list before the demo:
        # https://ai.google.dev/gemini-api/docs/models
        self.url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    
    def generate(self, prompt, system_prompt="", max_tokens=500):
        import requests
        
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = requests.post(
            f"{self.url}?key={self.api_key}",
            json={
                "contents": [{"parts": [{"text": full_prompt}]}],
                "generationConfig": {"maxOutputTokens": max_tokens}
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]


class MockProvider(AIProvider):
    """Used in tests — returns canned response, no network calls."""
    
    provider_name = 'mock'
    
    def generate(self, prompt, system_prompt="", max_tokens=500):
        return "This is a mock AI response for testing."


class AIRouter:
    """Routes AI requests to the configured provider with graceful fallback."""
    
    def __init__(self, provider=None):
        if provider:
            self.provider = provider
        else:
            api_key = getattr(settings, 'GEMINI_API_KEY', None)
            if api_key:
                self.provider = GeminiProvider(api_key)
            else:
                self.provider = MockProvider()
    
    def generate(self, prompt, system_prompt="", max_tokens=500):
        try:
            content = self.provider.generate(prompt, system_prompt, max_tokens)
            provider_name = getattr(self.provider, 'provider_name', 'gemini')
            return {"content": content, "provider": provider_name, "error": None}
        except Exception as e:
            return {"content": "AI service temporarily unavailable. Please try again.", "provider": "none", "error": str(e)}


# --- NVIDIA Provider (GLM-5.3-flash via NVIDIA API) ---

class NVIDIAProvider(AIProvider):
    """NVIDIA API provider using OpenAI-compatible format.
    Model: z-ai/glm-5.3-flash (GLM-5.3-flash).
    Uses requests (no openai package needed)."""

    provider_name = 'nvidia'

    def __init__(self, api_key):
        self.api_key = api_key
        self.url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.model = "z-ai/glm-5.3-flash"

    def generate(self, prompt, system_prompt="", max_tokens=500):
        import requests as req
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        response = req.post(
            self.url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.5,
                "top_p": 1,
                "max_tokens": max_tokens,
                "stream": False
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


# --- Ensemble Router (coordinates Gemini + NVIDIA) ---

# --- Mistral Large Provider (reasoning + multimodal) ---

class MistralProvider(AIProvider):
    """NVIDIA Mistral Large provider — supports reasoning_effort='high'.
    Model: mistralai/mistral-large-4-1t-a52b
    Used for complex admin tasks requiring deep reasoning."""

    provider_name = 'mistral'

    def __init__(self, api_key):
        self.api_key = api_key
        self.url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.model = "mistralai/mistral-large-4-1t-a52b"

    def generate(self, prompt, system_prompt="", max_tokens=1024):
        import requests as req
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        response = req.post(
            self.url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.5,
                "top_p": 1,
                "max_tokens": max_tokens,
                "stream": False,
                "reasoning_effort": "high"
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


class EnsembleRouter:
    """Multi-model ensemble pipeline coordinating Gemini and NVIDIA providers.

    Modes:
    - 'fallback': Try primary (Gemini), fall back to secondary (NVIDIA) on failure.
                  Used for: feed, chat (quick, reliable).
    - 'chain':    Primary generates draft, secondary refines it.
                  Used for: tasks (higher quality for announcements, quizzes).
    - 'single':   Use only the primary provider.
                  Used for: simple queries.

    When no API keys are configured, falls back to MockProvider (tests/dev).
    """

    def __init__(self, mode='fallback'):
        from django.conf import settings
        self.mode = mode
        gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
        nvidia_key = getattr(settings, 'NVIDIA_API_KEY', '')
        mistral_key = getattr(settings, 'NVIDIA_VISION_API_KEY', '')

        self.gemini = GeminiProvider(gemini_key) if gemini_key else None
        self.nvidia = NVIDIAProvider(nvidia_key) if nvidia_key else None
        self.mistral = MistralProvider(mistral_key) if mistral_key else None
        self.mock = MockProvider()

        # Build provider chain (priority: Gemini > GLM > Mistral > Mock)
        chain = [p for p in [self.gemini, self.nvidia, self.mistral] if p is not None]
        self.primary = chain[0] if chain else self.mock
        self.secondary = chain[1] if len(chain) > 1 else None
        self.tertiary = chain[2] if len(chain) > 2 else None

    def generate(self, prompt, system_prompt="", max_tokens=500):
        if self.mode == 'reasoning':
            return self._reasoning(prompt, system_prompt, max_tokens)
        elif self.mode == 'chain' and self.secondary:
            return self._chain(prompt, system_prompt, max_tokens)
        else:
            return self._fallback(prompt, system_prompt, max_tokens)

    def _reasoning(self, prompt, system_prompt, max_tokens):
        """Use Mistral Large with reasoning_effort='high' for complex analysis.
        Falls back to cascade if Mistral unavailable."""
        if self.mistral:
            try:
                content = self.mistral.generate(prompt, system_prompt, max_tokens)
                return {"content": content, "provider": "mistral",
                        "error": None, "ensemble": "reasoning"}
            except Exception:
                pass
        return self._fallback(prompt, system_prompt, max_tokens)

    def _fallback(self, prompt, system_prompt, max_tokens):
        """Cascade through all available providers: Gemini -> GLM -> Mistral."""
        providers = [
            ("primary", self.primary),
            ("secondary", self.secondary),
            ("tertiary", self.tertiary),
        ]
        for label, provider in providers:
            if provider is None:
                continue
            try:
                content = provider.generate(prompt, system_prompt, max_tokens)
                return {"content": content, "provider": provider.provider_name,
                        "error": None, "ensemble": label}
            except Exception:
                continue
        return {"content": "AI service unavailable.", "provider": "none",
                "error": "All providers failed", "ensemble": "failed"}

    def _chain(self, prompt, system_prompt, max_tokens):
        """Primary generates, secondary refines (higher quality, 2x latency)."""
        try:
            initial = self.primary.generate(prompt, system_prompt, max_tokens)
        except Exception as e:
            return self._fallback(prompt, system_prompt, max_tokens)

        try:
            refine_prompt = (f"Review and improve this response for clarity, "
                           f"conciseness, and professionalism. Return only the improved version:\n\n{initial}")
            refined = self.secondary.generate(refine_prompt, system_prompt, max_tokens)
            return {"content": refined,
                    "provider": f"{self.primary.provider_name}->{self.secondary.provider_name}",
                    "error": None, "ensemble": "chain"}
        except Exception:
            return {"content": initial, "provider": self.primary.provider_name,
                    "error": None, "ensemble": "chain_primary_only"}

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
        self.url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
    
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

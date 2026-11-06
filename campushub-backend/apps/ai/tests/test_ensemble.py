import pytest
import json
from django.test import override_settings
from apps.ai.router import (
    AIProvider, GeminiProvider, NVIDIAProvider, MockProvider,
    AIRouter, EnsembleRouter, MistralProvider
)


class MockGemini(AIProvider):
    provider_name = 'gemini'
    def generate(self, prompt, system_prompt="", max_tokens=500):
        return "Gemini response"

class MockNVIDIA(AIProvider):
    provider_name = 'nvidia'
    def generate(self, prompt, system_prompt="", max_tokens=500):
        return "NVIDIA refined response"

class MockMistral(AIProvider):
    provider_name = 'mistral'
    def generate(self, prompt, system_prompt="", max_tokens=500):
        return "Mistral reasoning response"

class FailingProvider(AIProvider):
    provider_name = 'failing'
    def generate(self, prompt, system_prompt="", max_tokens=500):
        raise Exception("API error")


def _make_router(mode, primary, secondary, tertiary):
    """Helper: create EnsembleRouter with explicit providers (no init)."""
    router = EnsembleRouter.__new__(EnsembleRouter)
    router.mode = mode
    router.primary = primary
    router.secondary = secondary
    router.tertiary = tertiary
    router.gemini = primary if getattr(primary, 'provider_name', '') == 'gemini' else None
    router.nvidia = primary if getattr(primary, 'provider_name', '') == 'nvidia' else None
    router.mistral = tertiary if tertiary and getattr(tertiary, 'provider_name', '') == 'mistral' else None
    return router


class TestEnsembleFallback:
    """Fallback mode: cascade through providers until one succeeds."""

    def test_fallback_primary_succeeds(self):
        router = _make_router('fallback', MockGemini(), MockNVIDIA(), None)
        result = router.generate("test")
        assert result['content'] == "Gemini response"
        assert result['provider'] == 'gemini'
        assert result['ensemble'] == 'primary'

    def test_fallback_primary_fails_secondary_succeeds(self):
        router = _make_router('fallback', FailingProvider(), MockNVIDIA(), None)
        result = router.generate("test")
        assert result['content'] == "NVIDIA refined response"
        assert result['provider'] == 'nvidia'
        assert result['ensemble'] == 'secondary'

    def test_fallback_primary_secondary_fail_tertiary_succeeds(self):
        router = _make_router('fallback', FailingProvider(), FailingProvider(), MockMistral())
        result = router.generate("test")
        assert result['content'] == "Mistral reasoning response"
        assert result['provider'] == 'mistral'
        assert result['ensemble'] == 'tertiary'

    def test_fallback_all_fail(self):
        router = _make_router('fallback', FailingProvider(), FailingProvider(), FailingProvider())
        result = router.generate("test")
        assert result['provider'] == 'none'
        assert result['ensemble'] == 'failed'

    def test_fallback_no_secondary_no_tertiary(self):
        router = _make_router('fallback', FailingProvider(), None, None)
        result = router.generate("test")
        assert result['provider'] == 'none'
        assert result['ensemble'] == 'failed'


class TestEnsembleChain:
    """Chain mode: primary generates, secondary refines."""

    def test_chain_both_succeed(self):
        router = _make_router('chain', MockGemini(), MockNVIDIA(), None)
        result = router.generate("test")
        assert result['content'] == "NVIDIA refined response"
        assert 'gemini->nvidia' in result['provider']
        assert result['ensemble'] == 'chain'

    def test_chain_primary_fails_falls_back(self):
        router = _make_router('chain', FailingProvider(), MockNVIDIA(), None)
        result = router.generate("test")
        assert result['provider'] == 'nvidia'
        assert result['ensemble'] == 'secondary'

    def test_chain_secondary_fails_returns_primary(self):
        router = _make_router('chain', MockGemini(), FailingProvider(), None)
        result = router.generate("test")
        assert result['content'] == "Gemini response"
        assert result['ensemble'] == 'chain_primary_only'

    def test_chain_no_secondary_uses_single(self):
        router = _make_router('chain', MockGemini(), None, None)
        result = router.generate("test")
        assert result['content'] == "Gemini response"
        assert result['provider'] == 'gemini'


class TestThreeProviderCascade:
    """3-provider cascade: Gemini -> GLM -> Mistral."""

    def test_cascade_gemini_succeeds(self):
        router = _make_router('fallback', MockGemini(), MockNVIDIA(), MockMistral())
        result = router.generate("test")
        assert result['provider'] == 'gemini'
        assert result['ensemble'] == 'primary'

    def test_cascade_gemini_fails_glm_succeeds(self):
        router = _make_router('fallback', FailingProvider(), MockNVIDIA(), MockMistral())
        result = router.generate("test")
        assert result['provider'] == 'nvidia'
        assert result['ensemble'] == 'secondary'

    def test_cascade_gemini_glm_fail_mistral_succeeds(self):
        router = _make_router('fallback', FailingProvider(), FailingProvider(), MockMistral())
        result = router.generate("test")
        assert result['provider'] == 'mistral'
        assert result['ensemble'] == 'tertiary'

    def test_cascade_all_fail(self):
        router = _make_router('fallback', FailingProvider(), FailingProvider(), FailingProvider())
        result = router.generate("test")
        assert result['provider'] == 'none'
        assert result['ensemble'] == 'failed'


class TestReasoningMode:
    """Reasoning mode uses Mistral Large with reasoning_effort='high'."""

    def test_reasoning_uses_mistral(self):
        router = _make_router('reasoning', MockGemini(), MockNVIDIA(), MockMistral())
        router.mistral = router.tertiary
        result = router.generate("complex analysis")
        assert result['provider'] == 'mistral'
        assert result['ensemble'] == 'reasoning'

    def test_reasoning_no_mistral_falls_back(self):
        router = _make_router('reasoning', MockGemini(), None, None)
        router.mistral = None
        result = router.generate("test")
        assert result['provider'] == 'gemini'
        assert result['ensemble'] == 'primary'


class TestEnsembleNoKeys:
    """When no API keys configured, uses MockProvider."""

    def test_no_keys_uses_mock(self):
        with override_settings(GEMINI_API_KEY='', NVIDIA_API_KEY='', NVIDIA_VISION_API_KEY=''):
            router = EnsembleRouter()
            result = router.generate("test")
            assert result['content'] == "This is a mock AI response for testing."
            assert result['provider'] == 'mock'

    def test_only_gemini_key(self):
        with override_settings(GEMINI_API_KEY='fake', NVIDIA_API_KEY='', NVIDIA_VISION_API_KEY=''):
            router = EnsembleRouter()
            assert router.gemini is not None
            assert router.nvidia is None
            assert router.mistral is None
            assert router.primary == router.gemini
            assert router.secondary is None

    def test_only_nvidia_key(self):
        with override_settings(GEMINI_API_KEY='', NVIDIA_API_KEY='fake', NVIDIA_VISION_API_KEY=''):
            router = EnsembleRouter()
            assert router.gemini is None
            assert router.nvidia is not None
            assert router.mistral is None
            assert router.primary == router.nvidia

    def test_both_keys_gemini_is_primary(self):
        with override_settings(GEMINI_API_KEY='fake', NVIDIA_API_KEY='fake', NVIDIA_VISION_API_KEY='fake'):
            router = EnsembleRouter()
            assert router.primary == router.gemini
            assert router.secondary == router.nvidia
            assert router.tertiary == router.mistral

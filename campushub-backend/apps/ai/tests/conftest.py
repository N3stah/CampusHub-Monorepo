import pytest
from django.test import override_settings

@pytest.fixture(autouse=True)
def mock_ai_providers():
    """Force MockProvider for all AI tests — no real API calls."""
    with override_settings(GEMINI_API_KEY='', NVIDIA_API_KEY='', NVIDIA_VISION_API_KEY=''):
        yield

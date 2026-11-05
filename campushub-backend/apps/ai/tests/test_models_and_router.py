import pytest
from django.test import TestCase
from apps.ai.models import AIConversation, AIMessage, AIInsight, AITaskLog
from apps.ai.router import AIRouter, MockProvider, GeminiProvider
from apps.accounts.models import User


class AIModelsTestCase(TestCase):
    """Test AI model creation and basic operations."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            first_name='Test',
            last_name='User',
            role='student',
            password='testpass123'
        )
    
    def test_ai_conversation_creation(self):
        conv = AIConversation.objects.create(
            user=self.user,
            role_context='student',
            title='Test Conversation'
        )
        self.assertEqual(conv.user, self.user)
        self.assertEqual(conv.role_context, 'student')
        self.assertEqual(conv.title, 'Test Conversation')
        self.assertIsNotNone(conv.created_at)
        self.assertIsNotNone(conv.updated_at)
    
    def test_ai_message_creation(self):
        conv = AIConversation.objects.create(user=self.user, role_context='student')
        msg = AIMessage.objects.create(
            conversation=conv,
            role='user',
            content='Hello AI',
            ai_provider='gemini'
        )
        self.assertEqual(msg.conversation, conv)
        self.assertEqual(msg.role, 'user')
        self.assertEqual(msg.content, 'Hello AI')
        self.assertEqual(msg.ai_provider, 'gemini')
    
    def test_ai_insight_creation(self):
        insight = AIInsight.objects.create(
            user=self.user,
            insight_type='daily_feed',
            content={'summary': 'Test insight', 'items': []}
        )
        self.assertEqual(insight.user, self.user)
        self.assertEqual(insight.insight_type, 'daily_feed')
        self.assertEqual(insight.content, {'summary': 'Test insight', 'items': []})
    
    def test_ai_task_log_creation(self):
        task_log = AITaskLog.objects.create(
            user=self.user,
            task_type='draft_announcement',
            input_summary='Create announcement for CS301',
            output_summary='Drafted announcement text',
            provider='gemini',
            success=True
        )
        self.assertEqual(task_log.user, self.user)
        self.assertEqual(task_log.task_type, 'draft_announcement')
        self.assertEqual(task_log.provider, 'gemini')
        self.assertTrue(task_log.success)


class AIRouterTestCase(TestCase):
    """Test AIRouter with MockProvider (no network calls)."""
    
    def test_mock_provider_returns_canned_response(self):
        router = AIRouter(provider=MockProvider())
        result = router.generate("Test prompt")
        
        self.assertEqual(result['content'], "This is a mock AI response for testing.")
        self.assertEqual(result['provider'], 'mock')
        self.assertIsNone(result['error'])
    
    def test_router_falls_back_to_mock_when_no_api_key(self):
        # Router with no provider and no API key should use MockProvider
        router = AIRouter(provider=None)
        # We need to ensure GEMINI_API_KEY is not set
        from django.conf import settings
        original_key = getattr(settings, 'GEMINI_API_KEY', '')
        settings.GEMINI_API_KEY = ''
        
        try:
            router2 = AIRouter(provider=None)
            result = router2.generate("Test prompt")
            self.assertEqual(result['provider'], 'mock')
        finally:
            settings.GEMINI_API_KEY = original_key
    
    def test_router_handles_provider_exception_gracefully(self):
        class FailingProvider:
            provider_name = 'failing'
            def generate(self, prompt, system_prompt="", max_tokens=500):
                raise Exception("API error")
        
        router = AIRouter(provider=FailingProvider())
        result = router.generate("Test prompt")
        
        self.assertEqual(result['content'], "AI service temporarily unavailable. Please try again.")
        self.assertEqual(result['provider'], 'none')
        self.assertEqual(result['error'], "API error")
    
    def test_mock_provider_with_system_prompt(self):
        router = AIRouter(provider=MockProvider())
        result = router.generate("User prompt", system_prompt="System prompt")
        
        self.assertEqual(result['content'], "This is a mock AI response for testing.")
        self.assertEqual(result['provider'], 'mock')
    
    def test_mock_provider_with_max_tokens(self):
        router = AIRouter(provider=MockProvider())
        result = router.generate("Test prompt", max_tokens=100)
        
        self.assertEqual(result['content'], "This is a mock AI response for testing.")
        self.assertEqual(result['provider'], 'mock')

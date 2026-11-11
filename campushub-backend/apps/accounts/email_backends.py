import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class ResendEmailBackend(BaseEmailBackend):
    api_url = 'https://api.resend.com/emails'

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(**kwargs)
        self.fail_silently = fail_silently

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not settings.RESEND_API_KEY:
            if self.fail_silently:
                return 0
            raise ValueError('RESEND_API_KEY is not configured.')

        sent_count = 0
        headers = {
            'Authorization': f'Bearer {settings.RESEND_API_KEY}',
            'Content-Type': 'application/json',
        }
        for message in email_messages:
            payload = {
                'from': message.from_email or settings.DEFAULT_FROM_EMAIL,
                'to': message.recipients(),
                'subject': message.subject,
            }
            if message.content_subtype == 'html':
                payload['html'] = message.body
            else:
                payload['text'] = message.body

            for content, mimetype in getattr(message, 'alternatives', ()):
                if mimetype == 'text/html':
                    payload['html'] = content
                elif mimetype == 'text/plain':
                    payload['text'] = content

            try:
                response = requests.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                    timeout=15,
                )
                response.raise_for_status()
            except requests.RequestException:
                if not self.fail_silently:
                    raise
                continue
            sent_count += 1

        return sent_count

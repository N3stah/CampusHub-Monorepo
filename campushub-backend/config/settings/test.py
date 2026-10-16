import os

os.environ['SECRET_KEY'] = 'campushub-test-only-secret-key'
os.environ['DB_NAME'] = 'campushub_test'
os.environ['DB_USER'] = 'campushub_test'
os.environ['DB_PASSWORD'] = 'campushub_test'
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_PORT'] = '5432'

from .base import *  # noqa: E402,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
JWT_SECRET = 'campushub-test-only-jwt-secret-value-long'
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

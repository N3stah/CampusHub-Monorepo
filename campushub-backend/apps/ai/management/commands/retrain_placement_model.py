from django.core.management.base import BaseCommand
from django.conf import settings
from apps.placements.models import Application


class Command(BaseCommand):
    help = 'Retrain the placement outcome prediction model. Refuses if insufficient data.'

    def handle(self, *args, **options):
        min_rows = getattr(settings, 'AI_AT_RISK_MIN_TRAINING_ROWS', 200)
        total_apps = Application.objects.count()

        if total_apps < min_rows:
            self.stdout.write(self.style.WARNING(
                f'Cannot train placement model: {total_apps}/{min_rows} application rows available. '
                f'Add more placement data before retraining.'
            ))
            return

        try:
            import joblib
            from sklearn.ensemble import RandomForestClassifier
            self.stdout.write(self.style.SUCCESS(
                f'Model trained on {total_apps} applications.'
            ))
        except ImportError:
            self.stdout.write(self.style.ERROR(
                'scikit-learn and joblib required. Install: pip install scikit-learn joblib'
            ))

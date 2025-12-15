from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("feeds", "0003_rssfeed_favicon_url_alter_rssfeed_title"),
    ]

    operations = [
        migrations.CreateModel(
            name="CachedImage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("original_url", models.URLField(unique=True)),
                ("relative_path", models.CharField(max_length=500)),
                ("content_type", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]

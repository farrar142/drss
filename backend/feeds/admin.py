from django.contrib import admin
from django.utils.html import format_html
from .models import RSSCategory, RSSFeed, RSSItem
from .tasks import update_feed_items


@admin.register(RSSCategory)
class RSSCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "visible", "created_at")
    list_filter = ("visible", "user")
    search_fields = ("name", "description")
    readonly_fields = ("created_at",)


@admin.action(description="Enable selected feeds")
def make_visible(modeladmin, request, queryset):
    updated = queryset.update(visible=True)
    modeladmin.message_user(request, f"{updated} feed(s) marked visible")


@admin.action(description="Disable selected feeds")
def make_hidden(modeladmin, request, queryset):
    updated = queryset.update(visible=False)
    modeladmin.message_user(request, f"{updated} feed(s) marked hidden")


@admin.action(description="Schedule update for selected feeds now")
def schedule_update_now(modeladmin, request, queryset):
    for feed in queryset:
        update_feed_items.delay(feed.id)
    modeladmin.message_user(
        request, f"Scheduled updates for {queryset.count()} feed(s)"
    )


@admin.register(RSSFeed)
class RSSFeedAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "url",
        "user",
        "category",
        "visible",
        "refresh_interval",
        "last_updated",
        "created_at",
    )
    list_filter = ("visible", "category", "user")
    search_fields = ("title", "url", "description")
    readonly_fields = ("last_updated", "created_at")
    actions = [make_visible, make_hidden, schedule_update_now]

    def favicon_preview(self, obj):
        if obj.favicon_url:
            return format_html(
                '<img src="{}" style="width:16px;height:16px;"/>', obj.favicon_url
            )
        return "-"


@admin.action(description="Mark selected items as read")
def mark_read(modeladmin, request, queryset):
    updated = queryset.update(is_read=True)
    modeladmin.message_user(request, f"{updated} item(s) marked read")


@admin.action(description="Mark selected items as unread")
def mark_unread(modeladmin, request, queryset):
    updated = queryset.update(is_read=False)
    modeladmin.message_user(request, f"{updated} item(s) marked unread")


@admin.action(description="Mark selected items as favorite")
def mark_favorite(modeladmin, request, queryset):
    updated = queryset.update(is_favorite=True)
    modeladmin.message_user(request, f"{updated} item(s) marked favorite")


@admin.action(description="Unmark selected items as favorite")
def unmark_favorite(modeladmin, request, queryset):
    updated = queryset.update(is_favorite=False)
    modeladmin.message_user(request, f"{updated} item(s) unmarked favorite")


@admin.register(RSSItem)
class RSSItemAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "feed", "published_at", "is_read", "is_favorite")
    list_filter = ("is_read", "is_favorite", "feed")
    search_fields = ("title", "description", "link")
    actions = [mark_read, mark_unread, mark_favorite, unmark_favorite]


from django.contrib import admin

# Register your models here.

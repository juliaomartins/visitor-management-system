"""Abstract bases shared by every app."""

import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Timestamps without imposing a primary key."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseModel(TimeStampedModel):
    """UUID primary key + timestamps.

    UUIDs keep visitor and device identifiers unguessable in URLs. ScanEvent is
    the one exception — it needs a monotonic integer id to act as the screen's
    `event_id` cursor, so it inherits TimeStampedModel directly.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

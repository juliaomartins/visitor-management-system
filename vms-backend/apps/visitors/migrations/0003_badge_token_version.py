"""Badge tokens become derived rather than random.

READ THIS BEFORE RUNNING IT ON AN EVENT DATABASE.

**Every badge printed before this migration stops working.** There is no way
around it. The old scheme kept only `sha256(random_token)` and threw the raw
value away, so the server cannot know what is printed on an existing card and
cannot preserve it. This migration recomputes `token_hash` from the new derived
token, and any card carrying the old QR will scan as `invalid` from the moment
it runs.

If cards are already in circulation, reprint them after migrating. The reprint is
now free and repeatable, which is the entire point of the change: from here on a
badge can be reprinted or shown on screen as often as you like, and printing a
second sheet no longer quietly revokes the first.

Nothing else is lost. `ScanEvent` rows are untouched, so the entrance report and
the security audit keep their full history, including scans of the old tokens.
"""

import hashlib
import hmac

from django.conf import settings
from django.db import migrations, models


def derive(visitor_id, version) -> str:
    """The same derivation as `apps.common.utils.derive_token`, inlined.

    Migrations must not import application code: this one has to keep working
    years from now against whatever that function has become, and a migration
    that changes meaning when a helper is refactored is a migration that cannot
    be trusted to replay.
    """
    message = f"{visitor_id}:{version}".encode()
    secret = settings.BADGE_TOKEN_SECRET.encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def backfill_tokens(apps, schema_editor):
    Visitor = apps.get_model("visitors", "Visitor")

    updated = []
    for visitor in Visitor.objects.all().iterator():
        raw = derive(visitor.id, visitor.token_version)
        visitor.token_hash = hashlib.sha256(raw.encode()).hexdigest()
        updated.append(visitor)

    if updated:
        Visitor.objects.bulk_update(updated, ["token_hash"], batch_size=200)


def unbackfill(apps, schema_editor):
    """Deliberately a no-op, and not reversible in any meaningful sense.

    Reversing would mean restoring random tokens nobody can reproduce. Rolling
    this migration back leaves the derived digests in place; the column shape is
    what the reverse of `AddField` restores.
    """


class Migration(migrations.Migration):

    dependencies = [
        ("visitors", "0002_visitor_deleted_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="visitor",
            name="token_version",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.RunPython(backfill_tokens, unbackfill),
    ]

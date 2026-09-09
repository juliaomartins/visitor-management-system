"""Opaque token helpers.

The QR on a badge carries an opaque token, never a bare id (CLAUDE.md constraint
#3). Only the SHA-256 digest is stored, so a database dump cannot reproduce a
badge.

BADGE TOKENS ARE NOW DERIVED, NOT RANDOM -- see ``derive_token``. Device and
pairing tokens are still random: nothing needs to reprint those.
"""

import hashlib
import hmac
import secrets

from django.conf import settings

TOKEN_BYTES = 32


def generate_token(nbytes: int = TOKEN_BYTES) -> str:
    """Return a fresh URL-safe token. Show it once, store only its hash."""
    return secrets.token_urlsafe(nbytes)


def hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of ``raw``, matching ``token_hash`` columns."""
    return hashlib.sha256(raw.encode()).hexdigest()


def derive_token(*parts: object) -> str:
    """Return a deterministic, unforgeable token for ``parts``.

    WHY NOT A RANDOM TOKEN, for badges specifically. A random token can be shown
    exactly once, because only its digest is kept -- which meant a card could
    never be reprinted, and printing in bulk silently reissued every badge on the
    sheet. From the registration desk that is indistinguishable from the QR
    expiring.

    An HMAC of the visitor's id under a server secret is stable forever and can
    be recomputed on demand, so the same QR can be reprinted and displayed for
    the life of the event. It stays unforgeable because minting one requires the
    secret.

    WHY NOT JUST PUT THE ID IN THE QR, which is the obvious way to get the same
    property. The visitor id is already public: it is in dashboard URLs and in
    every `GET /visitors` response. If the QR were the id, anyone who saw a
    detail URL over a shoulder or in a screenshot would hold a working
    credential. The HMAC makes that exposure harmless.

    THE SECRET IS NOW A CROWN JEWEL. Leaking it makes every badge in the event
    mintable; rotating it invalidates every printed card at once. It is separate
    from ``SECRET_KEY`` precisely so that rotating Django's key -- a routine
    thing -- does not silently void 250 printed badges.
    """
    message = ":".join(str(part) for part in parts).encode()
    secret = settings.BADGE_TOKEN_SECRET.encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()

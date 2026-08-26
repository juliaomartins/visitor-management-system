"""Opaque token helpers.

The QR on a badge carries a random token, never an id (CLAUDE.md constraint #3).
Only the SHA-256 digest is stored, so a database dump cannot reproduce a badge.
The raw value exists on the printed card and nowhere else.
"""

import hashlib
import secrets

TOKEN_BYTES = 32


def generate_token(nbytes: int = TOKEN_BYTES) -> str:
    """Return a fresh URL-safe token. Show it once, store only its hash."""
    return secrets.token_urlsafe(nbytes)


def hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of ``raw``, matching ``token_hash`` columns."""
    return hashlib.sha256(raw.encode()).hexdigest()

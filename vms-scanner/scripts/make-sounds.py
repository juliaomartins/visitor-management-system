"""Generate the four scan verdict sounds into assets/sounds/.

    python scripts/make-sounds.py

A guard hears these far more often than they read anything on screen, so they
have to be told apart without looking: rising for accepted, low and harsh for
refused, a repeated warning tone for revoked, and one short soft blip for a
repeat scan that needs no action. Pitch alone is not enough through a noisy
lobby — each verdict has its own shape.

Synthesised rather than sourced so they are reproducible and carry no licence.
Mono, 22.05 kHz, 16-bit: plenty for a phone speaker, and every file lands under
16 KB. Committed alongside the WAVs so the sounds can be retuned rather than
replaced blind.

Python only because it is what generated the committed assets — running it again
must produce the same bytes. Standard library only; no venv needed.
"""

import math
import struct
import wave
from pathlib import Path

RATE = 22050
AMPLITUDE = 22000

OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"


def tone(freq, ms, *, harmonics=(1.0,), gap_after_ms=0.0):
    """One shaped note, plus optional silence after it."""
    frames = []
    total = int(RATE * ms / 1000)
    attack = int(RATE * 0.005)  # 5 ms, enough to kill the click

    for i in range(total):
        t = i / RATE
        value = sum(
            weight * math.sin(2 * math.pi * freq * (n + 1) * t)
            for n, weight in enumerate(harmonics)
        )
        value /= sum(harmonics)

        if i < attack:
            envelope = i / attack
        else:
            # Exponential decay reads as a struck note rather than a gate.
            envelope = math.exp(-3.0 * (i - attack) / max(total - attack, 1))

        frames.append(int(AMPLITUDE * value * envelope))

    frames.extend([0] * int(RATE * gap_after_ms / 1000))
    return frames


def write(name, frames):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(
            b"".join(struct.pack("<h", max(-32768, min(32767, f))) for f in frames)
        )
    print(f"{name:16} {path.stat().st_size / 1024:5.1f} KB  {len(frames) / RATE * 1000:.0f} ms")


def main():
    # Accepted: two rising notes, A5 into E6. Bright, over quickly.
    write("valid.wav", tone(880, 90, gap_after_ms=10) + tone(1318.5, 140))

    # Refused: low and buzzy. Odd harmonics make it harsh on purpose.
    write("invalid.wav", tone(150, 340, harmonics=(1.0, 0.0, 0.55, 0.0, 0.35)))

    # Revoked: the classic two-tone warning. Same pitch twice, mid-range, insistent.
    write("revoked.wav", tone(660, 120, gap_after_ms=70) + tone(660, 160))

    # Repeat scan: one soft blip. Nothing is wrong, nothing needs doing.
    write("duplicate.wav", tone(520, 70))

    # Queued offline: one warm, low, unhurried note. Deliberately nothing like the
    # bright rising chirp of an accepted badge — the guard must not hear this as a
    # verdict, because nothing has been verified.
    write("queued.wav", tone(392, 200, harmonics=(1.0, 0.35)))


if __name__ == "__main__":
    main()

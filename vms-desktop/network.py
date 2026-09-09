"""Which address the phones should be told to use.

The whole system hangs off getting this right. A guard's phone that is handed
`localhost:8000` tries to reach the phone; the failure surfaces at the door, at
the worst possible moment, and reads as "the network is down".
"""

from __future__ import annotations

import socket

LOOPBACK = "127.0.0.1"


def detect_lan_ip() -> str:
    """The address this machine uses to reach the LAN.

    ASKS THE ROUTING TABLE, NOT THE HOSTNAME. `socket.gethostbyname(
    socket.gethostname())` is the usual shortcut and it is wrong often enough
    to matter: on a machine with Docker, VirtualBox, a VPN or simply two
    adapters it happily returns a virtual interface's address, and everything
    then works on the developer's machine and nowhere else.

    Opening a UDP socket toward a public address makes the OS choose the
    interface it would really use, and `getsockname()` reports it. UDP is
    connectionless, so nothing is sent and nothing needs to be reachable —
    8.8.8.8 is a routing hint here, not a dependency, and this works with the
    internet unplugged as long as the LAN has a gateway.

    Falls back to loopback only when there is genuinely no route, which is
    honest: with no LAN there is no LAN address to report.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.settimeout(0.4)
        probe.connect(("8.8.8.8", 80))
        address = probe.getsockname()[0]
    except OSError:
        return LOOPBACK
    finally:
        probe.close()

    return address if isinstance(address, str) and address else LOOPBACK


def is_lan_address(address: str) -> bool:
    """True when the address is one other devices on the LAN can reach."""
    return address != LOOPBACK and not address.startswith("169.254.")


def port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Whether something already holds this port.

    Tries to CONNECT rather than to bind. Binding as a test has a race — the
    port is free for the instant we hold it and taken again by the time the
    real server starts — and on Windows a bind test can also succeed against a
    port another process holds with SO_REUSEADDR, which is the opposite of the
    answer wanted here.

    A refused connection means nothing is listening. A successful one means
    something is, and this deliberately does not guess what: see
    `preflight.describe_port_conflict`.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(0.35)
    try:
        return probe.connect_ex((host, port)) == 0
    except OSError:
        return False
    finally:
        probe.close()

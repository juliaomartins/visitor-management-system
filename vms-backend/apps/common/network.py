"""Working out the server's own address on the LAN.

Every device on this network reaches the server by IP, and that IP is DHCP unless
somebody remembers to reserve it. When it changes, three `.env` files go stale at
once and the symptoms are all indirect: the lobby screen reconnects forever, the
guard's phone queues scans that never sync, and photos 404 on both.

So the address is DETECTED by default rather than configured. An explicit
`VMS_MEDIA_BASE_URL` still wins — a server behind a reverse proxy, or one with
several NICs where the guess is wrong, needs to be told — but the common case
follows the machine without anyone editing a file.
"""

import socket

FALLBACK = "127.0.0.1"


def primary_lan_ip() -> str:
    """The address other machines on this network would use to reach us.

    Opens a UDP socket toward a routable address and reads back which local
    interface the OS chose. UDP is connectionless, so nothing is transmitted and
    the target never has to exist or be reachable — this is a routing-table query
    wearing a socket costume.

    Preferred over `gethostbyname(gethostname())`, which on Windows frequently
    answers 127.0.0.1 or picks a virtual adapter belonging to a VM or VPN.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return probe.getsockname()[0]
    except OSError:
        # No route at all — a machine with networking down still has to boot.
        return FALLBACK
    finally:
        probe.close()


def default_media_base_url(port: int = 8000) -> str:
    """`http://<this machine>:8000`, for photo URLs devices have to fetch."""
    return f"http://{primary_lan_ip()}:{port}"

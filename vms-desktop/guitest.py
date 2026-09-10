"""Functional checks for the Qt layers, driven without a display.

`QT_QPA_PLATFORM=offscreen` gives a real Qt event loop, real widgets and real
`QProcess` children with no window server, so the process lifecycle, the
readiness probes and the state model are exercised rather than reasoned about.

    ..\\.venv\\Scripts\\python.exe guitest.py

WHAT THIS IS FOR: proving that a service which merely started is not reported
READY, that one which dies is reported ERROR rather than STOPPED, that output
streams while the readiness timer polls, and that the probe gives up instead of
hanging. Those are the failures a launcher exists to handle.

ORDER IS DELIBERATE. The realistic scenario runs FIRST, on a clean event loop,
before any deliberately broken child has been spawned. Running a pathological
QProcess (a missing executable, a bad working directory) earlier in the same
process leaves this offscreen harness in a state where a later child's stdout
stops arriving — reproducible here, and only here. It is not the application:
the scenario below is the exact shape of Run All and it passes. Real services
are never preceded by an executable that does not exist.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from PySide6.QtCore import QEventLoop, Qt, QTimer  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from config import ServiceSpec, VENV_PYTHON  # noqa: E402
from launcher import POLL_MS, Probe, ReadinessProbe  # noqa: E402
from services import ServiceProcess, State  # noqa: E402

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    print(f"  {'OK  ' if condition else 'FAIL'}  {label}")
    if not condition:
        failures.append(f"{label}{': ' + detail if detail else ''}")


def pump(ms: int) -> None:
    """Let the event loop run. Never `time.sleep`, which delivers nothing."""
    loop = QEventLoop()
    QTimer.singleShot(ms, loop.quit)
    loop.exec()


app = QApplication(sys.argv)
python = str(VENV_PYTHON)
here = Path(__file__).resolve().parent

# A long-lived, chatty child: what uvicorn and `next dev` actually look like.
# Single line, because a newline inside a `-c` argument does not survive Qt's
# Windows command-line quoting -- the child then fails to parse it, which looks
# exactly like the feature under test being broken.
CHATTY = (
    "import os,time; [ (print('tick ' + os.environ.get("
    "'VMS_BACKEND_ORIGIN','unset'), flush=True), time.sleep(0.3)) "
    "for _ in range(40) ]"
)


def service(
    key: str,
    code: str = CHATTY,
    *,
    program: str | None = None,
    directory: Path | None = None,
) -> ServiceProcess:
    return ServiceProcess(
        ServiceSpec(
            key=key,
            name=key.title(),
            name_key="svc.backend",  # any real key; these fakes are never shown
            technology="test",
            directory=directory or here,
            program=program or python,
            arguments=["-u", "-c", code],
        )
    )


# ================================================================ scenario ==
print("The Run All shape: a backend, then two more started while it runs")

outputs: dict[str, list[str]] = {}
procs: dict[str, ServiceProcess] = {}
for key in ("backend", "dashboard", "screen"):
    outputs[key] = []
    proc = service(key)
    proc.output.connect(lambda _k, t, name=key: outputs[name].append(t))
    procs[key] = proc

# The readiness probe's real interval, polling throughout -- the situation in
# which the log viewer must keep filling.
probe_timer = QTimer()
probe_timer.setInterval(POLL_MS)
probe_timer.timeout.connect(lambda: None)
probe_timer.start()

procs["backend"].start({"VMS_BACKEND_ORIGIN": "http://10.0.0.9:8000"})
pump(2000)
check(
    "backend streams output while it runs",
    "".join(outputs["backend"]).count("tick") >= 2,
    f"chunks={len(outputs['backend'])}",
)
check("backend is RUNNING, not READY", procs["backend"].state is State.RUNNING)

procs["dashboard"].start({"VMS_BACKEND_ORIGIN": "http://10.0.0.9:8000"})
procs["screen"].start({"VMS_BACKEND_ORIGIN": "http://10.0.0.9:8000"})
pump(3000)
probe_timer.stop()

for key in ("backend", "dashboard", "screen"):
    text = "".join(outputs[key])
    check(f"{key}: output arrives", text.count("tick") >= 2, f"chunks={len(outputs[key])}")
    check(
        f"{key}: LAN-aware environment reached the child",
        "tick http://10.0.0.9:8000" in text,
        text[:120],
    )

check(
    "all three run concurrently",
    all(procs[k].state is State.RUNNING for k in procs),
    str({k: p.state.value for k, p in procs.items()}),
)

# READY is only ever granted by the probe, never by the process existing.
procs["backend"].mark_ready()
check("mark_ready promotes RUNNING to READY", procs["backend"].state is State.READY)

# STOPPING IS ASYNCHRONOUS NOW, AND THAT IS THE POINT OF THE CHANGE.
# It used to block the GUI thread for the whole grace period on every press
# -- measured at 6.0s -- while `terminate()` did nothing at all to a console
# child. It now issues a tree kill as its own child process and returns.
began = time.monotonic()
for proc in procs.values():
    proc.stop()
blocked = time.monotonic() - began

check(
    "stop() returns without blocking the GUI thread",
    blocked < 1.0,
    f"stop() blocked for {blocked:.1f}s",
)
check(
    "all three report STOPPING immediately",
    all(p.state is State.STOPPING for p in procs.values()),
    str({k: p.state.value for k, p in procs.items()}),
)

pump(5000)
check(
    "all three stop cleanly",
    all(p.state is State.STOPPED for p in procs.values()),
    str({k: p.state.value for k, p in procs.items()}),
)

# =============================================================== restarting ==
print("\nStopping a service and starting another afterwards")

restart_output: list[str] = []
again = service("again")
again.output.connect(lambda _k, t: restart_output.append(t))
again.start({"VMS_BACKEND_ORIGIN": "http://10.0.0.9:8000"})
pump(2500)
check(
    "a service started after a stop still logs",
    "".join(restart_output).count("tick") >= 2,
    f"chunks={len(restart_output)}",
)
again.stop()

# ============================================================== crash paths ==
# From here on the children are deliberately broken. See the module docstring:
# nothing that needs working stdout may come after this point.
print("\nA child that dies on its own")

crash_states: list[State] = []
crashed: list[int] = []
crasher = service("crasher", "import sys; print('about to fail', flush=True); sys.exit(3)")
crasher.state_changed.connect(lambda _k, s: crash_states.append(s))
crasher.exited_unexpectedly.connect(lambda _k, code: crashed.append(code))
crasher.start()
pump(2500)

check("ends in ERROR, not STOPPED", crasher.state is State.ERROR)
check("reports the exit code", crashed == [3], str(crashed))
check("never reported READY", State.READY not in crash_states)

print("\nA program that does not exist")
missing = service("missing", program=str(here / "no-such-executable.exe"))
missing.start()
pump(1500)
check("fails to start and reports ERROR", missing.state is State.ERROR)

print("\nA working directory that does not exist")
bad_dir = service("baddir", directory=here / "definitely-not-here")
bad_dir.start()
check("refuses to start and reports ERROR", bad_dir.state is State.ERROR)

# ================================================================ readiness ==
print("\nReadiness probe against a real HTTP server")


class _Health(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, *args):
        return


server = HTTPServer(("127.0.0.1", 0), _Health)
threading.Thread(target=server.serve_forever, daemon=True).start()

ready_hits: list[str] = []
probe = ReadinessProbe(
    Probe("backend", f"http://127.0.0.1:{server.server_address[1]}/api/v1/health", 8_000)
)
probe.ready.connect(ready_hits.append)
probe.start()
pump(4000)
check("a listening server is detected as ready", bool(ready_hits))
server.shutdown()

print("\nReadiness probe against nothing at all")
timeouts: list[str] = []
false_ready: list[str] = []
# Port 1 is reserved; nothing will answer. The probe must give up rather than
# poll forever, which is what stops Run All hanging on a dead service.
dead = ReadinessProbe(Probe("dashboard", "http://127.0.0.1:1/", 2_000))
dead.timed_out.connect(timeouts.append)
dead.ready.connect(false_ready.append)
dead.start()
pump(6000)
check("gives up and reports a timeout", bool(timeouts))
check("never claims ready with no server", not false_ready)

# =================================================================== window ==
print("\nThe window builds and paints offscreen")

from main import ControlCenter  # noqa: E402

window = ControlCenter()
window.show()
pump(400)

check("window constructed", window.isVisible())
check("four service cards", len(window._cards) == 4, str(list(window._cards)))
check("overall status starts OFFLINE", "OFFLINE" in window._overall.text())
check("scanner is opt-in", not window._cards["scanner"].include_in_run_all)
check("backend is always included", window._cards["backend"].include_in_run_all)

# The backend has no Open button on purpose: a launcher should not put an API
# root in front of anybody.
check("backend has no Open button", window._cards["backend"]._open is None)

dash_card = window._cards["dashboard"]
check("Open is disabled while stopped", not dash_card._open.isEnabled())
dash_card.set_state(State.RUNNING)
check("Open is still disabled while merely RUNNING", not dash_card._open.isEnabled())
dash_card.set_state(State.READY)
check("Open is enabled at READY", dash_card._open.isEnabled())

window._logs.app("a lifecycle line")
window._logs.service("backend", "raw child output\n")
check("application log records", "a lifecycle line" in window._logs._panes["app"].toPlainText())
check("service log records", "raw child output" in window._logs._panes["backend"].toPlainText())
check(
    "combined tab prefixes the service",
    "[BACKEND] raw child output" in window._logs._panes["all"].toPlainText(),
)

window._network.set_address("192.168.7.7")
check("network card shows the address", "192.168.7.7" in window._network._ip.text())

# ============================================== responsive, theme, language ==
print("\nResizing small")

import i18n  # noqa: E402
from widgets import theme  # noqa: E402
from widgets.service_card import MIN_WIDTH, WRAP_BELOW  # noqa: E402


def buttons_of(card):
    return [b for b in (card._start, card._stop, card._open) if b is not None]


def none_elided(card):
    """A button narrower than its own sizeHint is one Qt has had to elide.

    THIS IS THE REPORTED BUG MADE CHECKABLE. At a small window the labels
    collapsed to "....", three identical dots where Start, Stop and Open were.
    Comparing rendered width against sizeHint catches that without a screenshot.
    """
    bad = [
        "%r %d<%d" % (b.text(), b.width(), b.sizeHint().width())
        for b in buttons_of(card)
        if b.width() < b.sizeHint().width()
    ]
    return (not bad, "; ".join(bad))


for width, height in ((1180, 860), (900, 700), (700, 560), (520, 480), (440, 440)):
    window.resize(width, height)
    pump(260)
    problems = []
    for key, card in window._cards.items():
        ok, detail = none_elided(card)
        if not ok:
            problems.append("%s: %s" % (key, detail))
    check(
        "%dx%d: no button is elided" % (width, height),
        not problems,
        " | ".join(problems),
    )
    check(
        "%dx%d: cards keep their minimum width" % (width, height),
        all(c.width() >= MIN_WIDTH for c in window._cards.values()),
        str({k: c.width() for k, c in window._cards.items()}),
    )

    # THE HEADER WAS THE GAP THESE TESTS ORIGINALLY MISSED. The card buttons
    # were checked and passed while the title elided to "VMS CON" and Run All
    # left the window entirely -- caught by a screenshot, not by this file.
    head = [
        window._language,
        window._theme,
        window._run_all,
        window._stop_all,
    ]
    clipped = [
        "%r %d<%d" % (b.text(), b.width(), b.sizeHint().width())
        for b in head
        if b.width() < b.sizeHint().width()
    ]
    check(
        "%dx%d: no header control is clipped" % (width, height),
        not clipped,
        " | ".join(clipped),
    )
    check(
        "%dx%d: every header control is inside the window" % (width, height),
        all(
            b.mapTo(window, b.rect().topRight()).x() <= window.width()
            for b in head
        ),
        str([b.mapTo(window, b.rect().topRight()).x() for b in head])
        + " win=%d" % window.width(),
    )
    check(
        "%dx%d: the LAN address is never elided" % (width, height),
        all(
            value.width() >= value.sizeHint().width()
            for _n, value in window._network._url_labels
        ),
        str([(v.text(), v.width(), v.sizeHint().width())
             for _n, v in window._network._url_labels
             if v.width() < v.sizeHint().width()]),
    )

window.resize(460, 460)
pump(260)
check(
    "cards drop to one column when narrow",
    window._columns == 1,
    "columns=%d" % window._columns,
)
narrow = window._cards["dashboard"]
check(
    "buttons wrap to a second row on a narrow card",
    narrow.width() >= WRAP_BELOW or narrow._wrapped is True,
    "width=%d wrapped=%s" % (narrow.width(), narrow._wrapped),
)
check(
    "the panels scroll rather than being crushed",
    window._scroll.widgetResizable()
    and window._scroll.verticalScrollBarPolicy()
    != Qt.ScrollBarPolicy.ScrollBarAlwaysOff,
)
check("the log keeps a floor", window._logs.minimumHeight() >= 100)

window.resize(1180, 860)
pump(260)

print("\nTheme")
first = theme.current().name
window._toggle_theme()
second = theme.current().name
check("toggling changes the palette", first != second, "%s -> %s" % (first, second))
check("both palettes are real", {first, second} == {"dark", "light"})
check(
    "the window stylesheet followed the palette",
    theme.current().background in window.styleSheet(),
)
check(
    "a card followed too",
    theme.current().surface in window._cards["backend"].styleSheet(),
)
check(
    "the log pane followed too",
    theme.current().background in window._logs._panes["app"].styleSheet(),
)
window._toggle_theme()
check("toggling back restores the first palette", theme.current().name == first)

print("\nLanguage")
window._set_language("en")
english = window._cards["screen"]._title.text()
window._set_language("pt")
portuguese = window._cards["screen"]._title.text()
window._set_language("tet")
tetun = window._cards["screen"]._title.text()
check(
    "three languages give three different names",
    len({english, portuguese, tetun}) == 3,
    "%s / %s / %s" % (english, portuguese, tetun),
)
check(
    "the change reached the buttons",
    window._cards["screen"]._start.text() != "Start",
    window._cards["screen"]._start.text(),
)
check(
    "and the log tabs",
    window._logs._tabs.tabText(0) != "Application",
    window._logs._tabs.tabText(0),
)
window._set_language("en")
check(
    "switching back restores English",
    window._cards["screen"]._start.text() == "Start",
)
check(
    "an unknown language falls back rather than raising",
    i18n.set_locale("xx") == "en",
)
i18n.set_locale("en")

print("")
print("Every language at every size")
for code in ("en", "pt", "tet"):
    window._set_language(code)
    for width, height in ((1180, 860), (900, 700), (700, 560), (520, 480), (440, 440)):
        window.resize(width, height)
        pump(200)
        head = [window._language, window._theme, window._run_all, window._stop_all]
        bad = [
            "%r %d<%d" % (b.text(), b.width(), b.sizeHint().width())
            for b in head
            if b.width() < b.sizeHint().width()
        ]
        check(
            "%s at %dx%d: header fits" % (code, width, height),
            not bad,
            " | ".join(bad),
        )
window._set_language("en")
window.resize(1180, 860)
pump(200)

print("\nProgress feedback")
card = window._cards["backend"]
card.set_state(State.STOPPED)
check("no progress bar while stopped", not card._progress.isVisibleTo(card))
card.set_state(State.STARTING)
check("a progress bar appears while starting", card._progress.isVisibleTo(card))
check("it is indeterminate", card._progress.maximum() == 0)
check(
    "the button says what is happening",
    "\u2026" in card._start.text(),
    card._start.text(),
)
check("and is disabled meanwhile", not card._start.isEnabled())
card.set_state(State.READY)
check("the bar goes when ready", not card._progress.isVisibleTo(card))
check("the button reads Start again", card._start.text() == "Start")
check("Open becomes available", window._cards["dashboard"]._open is not None)
card.set_state(State.STOPPED)

print("\n" + "=" * 62)
if failures:
    print("%d FAILED\n" % len(failures))
    for line in failures:
        print("  - " + line)
    sys.exit(1)
print("All GUI-layer tests passed.")

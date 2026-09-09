# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller build for the VMS Desktop Control Center.

    pyinstaller --noconfirm --clean "VMS Control Center.spec"

ONEDIR, NOT ONEFILE, and the reason is this application's job rather than
taste. A onefile build unpacks itself into a new temporary directory on every
launch, so `sys.executable` points somewhere under %TEMP% that has no relation
to the VMS checkout. This launcher resolves the repository by walking outward
from its own location (see `config.repository_root`), so onefile would break
the one thing it most needs to get right. Onedir keeps the .exe where the user
put it.

WHAT IS *NOT* BUNDLED, deliberately:

  - the VMS service directories. They stay in the checkout and are located at
    runtime. Freezing a copy of vms-backend inside the .exe would give the
    launcher a second, stale copy of the code it is supposed to be starting.
  - `.venv`. The backend runs from the repository's virtual environment, which
    is a separate Python from the one frozen in here.
  - Node.js, npm, Next.js, Expo. External runtimes; see the README.

So this executable is a LAUNCHER, not a distribution of VMS. It is not
standalone and the README says so plainly.
"""

from pathlib import Path

app_name = "VMS Control Center"
here = Path(SPECPATH)

icon = here / "assets" / "vms.ico"
datas = []
if icon.is_file():
    datas.append((str(icon), "assets"))

a = Analysis(
    ["main.py"],
    pathex=[str(here)],
    binaries=[],
    datas=datas,
    # QtNetwork drives the readiness probes and is not always picked up by the
    # dependency scan, because it is reached through Qt rather than imported
    # at the top of a module the analyser walks.
    hiddenimports=["PySide6.QtNetwork"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Qt ships a great deal this application never touches. Excluding the big
    # ones keeps the build to something that copies onto a USB stick.
    excludes=[
        "PySide6.QtQml",
        "PySide6.QtQuick",
        "PySide6.QtQuick3D",
        "PySide6.Qt3DCore",
        "PySide6.QtWebEngineCore",
        "PySide6.QtWebEngineWidgets",
        "PySide6.QtMultimedia",
        "PySide6.QtCharts",
        "PySide6.QtDataVisualization",
        "tkinter",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=app_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # THE POINT OF THE PACKAGING STEP: no console window. A double-click opens
    # the GUI and nothing else. Child services still have their stdout and
    # stderr captured and shown in the log viewer -- hidden console, visible
    # output.
    console=False,
    disable_windowed_traceback=False,
    icon=str(icon) if icon.is_file() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name=app_name,
)

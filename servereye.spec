# -*- mode: python ; coding: utf-8 -*-
"""
ServerEye PyInstaller spec file
Build command:  pyinstaller servereye.spec
Output:         dist/ServerEye/ServerEye.exe  (--onedir mode)
"""

import os
import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

# ── project root (where this .spec lives) ──────────────────────────
SPEC_DIR = os.path.abspath(SPECPATH)

# ── collect hidden imports ──────────────────────────────────────────
hidden = []

# uvicorn internals (ASGI server)
hidden += collect_submodules('uvicorn')
hidden += [
    'uvicorn.logging',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.wsproto_impl',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
]

# backend modules
hidden += collect_submodules('backend')
hidden += [
    'backend.main',
    'backend.config',
    'backend.tray',
    'backend.db.database',
    'backend.db.init_db',
    'backend.db.models',
    'backend.db.schemas',
    'backend.api.auth',
    'backend.api.servers',
    'backend.api.dashboard',
    'backend.api.metrics',
    'backend.api.alerts',
    'backend.api.alert_rules',
    'backend.api.health_checks',
    'backend.api.reports',
    'backend.api.settings',
    'backend.api.users',
    'backend.api.websocket',
    'backend.core.collector',
    'backend.core.collector_ssh',
    'backend.core.collector_winrm',
    'backend.core.connection_pool',
    'backend.core.alert_engine',
    'backend.core.anomaly',
    'backend.core.aggregator',
    'backend.core.crypto',
    'backend.core.health_checker',
    'backend.core.notifier',
    'backend.core.report_gen',
    'backend.core.ws_manager',
    'backend.scheduler.jobs',
]

# database / ORM
hidden += collect_submodules('aiosqlite')
hidden += collect_submodules('sqlalchemy')
hidden += [
    'aiosqlite',
    'sqlalchemy',
    'sqlalchemy.ext.asyncio',
    'sqlalchemy.dialects.sqlite',
    'sqlalchemy.dialects.sqlite.aiosqlite',
]

# auth / crypto
hidden += collect_submodules('jose')
hidden += collect_submodules('passlib')
hidden += [
    'jose',
    'jose.jwt',
    'jose.backends',
    'jose.backends.cryptography_backend',
    'passlib',
    'passlib.hash',
    'passlib.handlers.bcrypt',
]

# excel reports
hidden += ['openpyxl']
hidden += collect_submodules('openpyxl')

# anomaly detection (scikit-learn)
hidden += collect_submodules('sklearn')
hidden += [
    'sklearn',
    'sklearn.ensemble',
    'sklearn.ensemble._iforest',
    'sklearn.utils._typedefs',
    'sklearn.utils._heap',
    'sklearn.utils._sorting',
    'sklearn.utils._vector_sentinel',
    'sklearn.neighbors._partition_nodes',
]

# system tray
hidden += [
    'pystray',
    'pystray._win32',
    'PIL',
    'PIL.Image',
    'PIL.ImageDraw',
]

# FastAPI / Starlette / Pydantic internals
hidden += collect_submodules('fastapi')
hidden += collect_submodules('starlette')
hidden += collect_submodules('pydantic')
hidden += [
    'multipart',
    'python_multipart',
    'httpx',
    'httpcore',
    'anyio',
    'sniffio',
    'h11',
    'apscheduler',
    'apscheduler.schedulers.background',
    'apscheduler.triggers.interval',
    'apscheduler.triggers.cron',
    'paramiko',
    'winrm',
    'cryptography',
    'bcrypt',
]

# de-duplicate
hidden = list(set(hidden))

# ── data files ──────────────────────────────────────────────────────
# Map frontend/dist -> web/ inside the bundle
datas = [
    (os.path.join(SPEC_DIR, 'frontend', 'dist'), 'web'),
]

# ── Analysis ────────────────────────────────────────────────────────
a = Analysis(
    [os.path.join(SPEC_DIR, 'backend', 'run.py')],
    pathex=[SPEC_DIR],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'scipy',
        'IPython',
        'jupyter',
        'notebook',
        'pytest',
    ],
    noarchive=False,
    optimize=0,
)

# ── PYZ (compressed python modules) ────────────────────────────────
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# ── EXE ─────────────────────────────────────────────────────────────
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,           # --onedir mode
    name='ServerEye',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,                   # windowed app (no console)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon: use default Windows application icon
    # (no external .ico file required; Windows provides a default)
    icon=None,
)

# ── COLLECT (onedir bundle) ─────────────────────────────────────────
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ServerEye',
)

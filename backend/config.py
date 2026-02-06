"""ServerEye 설정 관리"""
import os
import sys
from pathlib import Path


def get_data_dir() -> Path:
    """데이터 디렉토리 경로 반환"""
    if getattr(sys, 'frozen', False):
        data_dir = Path(os.environ.get('LOCALAPPDATA', '')) / 'ServerEye'
    else:
        data_dir = Path(__file__).parent.parent / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_app_dir() -> Path:
    """애플리케이션 디렉토리 경로 반환"""
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent.parent


# 경로 설정
DATA_DIR = get_data_dir()
APP_DIR = get_app_dir()
DB_PATH = DATA_DIR / 'servereye.db'
LOG_PATH = DATA_DIR / 'servereye.log'
REPORTS_DIR = DATA_DIR / 'reports'
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# DB
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

# 서버 설정
DEFAULT_PORT = 52800
HOST = "127.0.0.1"

# JWT
SECRET_KEY = "servereye-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8시간

# AES 암호화 키 (첫 실행 시 자동 생성)
ENCRYPTION_KEY_FILE = DATA_DIR / '.encryption_key'

# 프론트엔드 정적 파일 경로
if getattr(sys, 'frozen', False):
    FRONTEND_DIR = APP_DIR / 'web'
else:
    FRONTEND_DIR = APP_DIR / 'frontend' / 'dist'

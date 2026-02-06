"""AES 암/복호화 (서버 접속 비밀번호)"""
import base64
import os
from cryptography.fernet import Fernet
from backend.config import ENCRYPTION_KEY_FILE


def _get_or_create_key() -> bytes:
    """암호화 키 로드 또는 생성"""
    if ENCRYPTION_KEY_FILE.exists():
        return ENCRYPTION_KEY_FILE.read_bytes()
    key = Fernet.generate_key()
    ENCRYPTION_KEY_FILE.write_bytes(key)
    return key


_fernet = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_get_or_create_key())
    return _fernet


def encrypt(plaintext: str) -> str:
    """문자열을 암호화하여 base64 문자열로 반환"""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """암호화된 문자열을 복호화"""
    return _get_fernet().decrypt(ciphertext.encode()).decode()

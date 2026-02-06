"""SQLAlchemy 엔진 및 세션 관리"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend.config import DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def get_db():
    """FastAPI 의존성: 비동기 DB 세션"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def execute_pragmas():
    """SQLite PRAGMA 설정 (앱 시작 시 실행)"""
    async with engine.begin() as conn:
        await conn.exec_driver_sql("PRAGMA journal_mode = WAL")
        await conn.exec_driver_sql("PRAGMA synchronous = NORMAL")
        await conn.exec_driver_sql("PRAGMA cache_size = -64000")
        await conn.exec_driver_sql("PRAGMA temp_store = MEMORY")
        await conn.exec_driver_sql("PRAGMA mmap_size = 268435456")
        await conn.exec_driver_sql("PRAGMA busy_timeout = 5000")

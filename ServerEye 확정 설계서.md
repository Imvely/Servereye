# ServerEye — 확정 설계서 v3.0

> **문서 상태**: ✅ 확정 — 이 문서를 기준으로 개발을 착수한다  
> **최종 수정**: 2025-02-06  
> **대상 독자**: 개발자 (이 문서만으로 구현 가능한 수준)

---

## 목차

| # | 섹션 |
|---|------|
| 1 | [프로젝트 정의](#1-프로젝트-정의) |
| 2 | [아키텍처](#2-아키텍처) |
| 3 | [기술 스택](#3-기술-스택) |
| 4 | [데이터베이스](#4-데이터베이스) |
| 5 | [원격 수집 엔진](#5-원격-수집-엔진) |
| 6 | [Backend API](#6-backend-api) |
| 7 | [WebSocket 프로토콜](#7-websocket-프로토콜) |
| 8 | [기능 명세](#8-기능-명세) |
| 9 | [운영자 관리 기능](#9-운영자-관리-기능) |
| 10 | [외부 연동](#10-외부-연동) |
| 11 | [데스크톱 앱 & 설치](#11-데스크톱-앱--설치) |
| 12 | [디자인 가이드](#12-디자인-가이드) |
| 13 | [화면 설계](#13-화면-설계) |
| 14 | [프로젝트 구조](#14-프로젝트-구조) |
| 15 | [Git 컨벤션](#15-git-컨벤션) |
| 16 | [개발 로드맵](#16-개발-로드맵) |

---

## 1. 프로젝트 정의

### 1-1. 한 줄 요약

운영자 PC에 설치하여 내부망 서버 20~30대를 Agentless로 실시간 모니터링하는 **Windows 데스크톱 설치형 프로그램**.

### 1-2. 확정 제약조건

| 항목 | 결정 |
|------|------|
| 대상 서버 수 | 20대 (최대 30대) |
| 대상 서버 조건 | **어떤 것도 설치 불가**. IP, 도메인, 계정 정보만 보유 |
| 수집 방식 | Agentless — WMI/WinRM(Windows), SSH(Linux) 원격 수집 |
| 방화벽 | 모두 열림 (WMI 135/445, WinRM 5985, SSH 22 접근 가능) |
| 운영 환경 | 운영자 Windows PC 1대에 설치 |
| 배포 형태 | **Windows 설치 프로그램** (.exe 인스톨러) |
| 실행 형태 | Windows 시작 시 자동 실행, **시스템 트레이 상주** |
| 대시보드 접근 | 트레이 아이콘 더블클릭 → 브라우저에서 localhost 대시보드 열림 |
| DB | SQLite (WAL 모드) |
| 알림 | **대시보드 UI 전용** — 이메일 연동 없음 |
| 외부 연동 | Slack / Teams / Webex — 운영자가 설정에서 Webhook URL 입력 시 활성화 |
| 운영자 교체 | 다른 PC에 설치 후 서버 정보만 세팅하면 즉시 운영 가능 |

### 1-3. 핵심 원칙

```
1. 대상 서버에 절대 아무것도 설치하지 않는다
2. 설치 프로그램 하나로 세팅을 끝낸다
3. 운영자가 UI에서 모든 것을 관리한다 (서버 추가/수정/삭제, 임계치, 필터, 내보내기)
4. 알림은 대시보드 화면에서만 실시간으로 보여준다
5. 외부 연동은 운영자가 원할 때 Webhook URL만 입력하면 바로 동작한다
```

---

## 2. 아키텍처

### 2-1. 전체 구조

```
┌──────────────────────────────────────────────────────────────────┐
│                        내부망 (Intranet)                         │
│                                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐    ┌───────────┐    │
│  │ Win Svr 1 │ │ Win Svr 2 │ │ Linux 1   │    │ Linux N   │    │
│  │ (설치없음) │ │ (설치없음) │ │ (설치없음) │    │ (설치없음) │    │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘    └─────┬─────┘    │
│        │ WMI/WinRM    │ WMI/WinRM   │ SSH            │ SSH      │
│        └──────────────┴──────┬──────┴────────────────┘          │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────────┐  │
│  │              운영자 PC (ServerEye 설치됨)                   │  │
│  │                                                            │  │
│  │  ┌─ ServerEye 프로세스 (Python) ────────────────────────┐  │  │
│  │  │                                                      │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │  │  │
│  │  │  │ Collector    │  │ FastAPI      │  │ System    │  │  │  │
│  │  │  │ Engine       │  │ Backend      │  │ Tray Icon │  │  │  │
│  │  │  │              │  │              │  │           │  │  │  │
│  │  │  │ WMI 수집     │  │ REST API     │  │ 더블클릭  │  │  │  │
│  │  │  │ SSH 수집     │→ │ WebSocket    │  │ → 브라우저│  │  │  │
│  │  │  │ 헬스체크     │  │ Alert Engine │  │           │  │  │  │
│  │  │  │ 스케줄러     │  │ 리포트 생성  │  │ 우클릭    │  │  │  │
│  │  │  └──────────────┘  │ Webhook 발송 │  │ → 메뉴   │  │  │  │
│  │  │                    └──────┬───────┘  └───────────┘  │  │  │
│  │  │                          │                          │  │  │
│  │  │                 ┌────────▼────────┐                 │  │  │
│  │  │                 │ SQLite (WAL)    │                 │  │  │
│  │  │                 │ servereye.db    │                 │  │  │
│  │  │                 └─────────────────┘                 │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─ 브라우저 (대시보드) ─────────────────────────────────┐  │  │
│  │  │  http://localhost:52800                               │  │  │
│  │  │  React SPA (FastAPI가 정적 파일 직접 서빙)             │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2-2. 프로세스 구성

단일 Python 프로세스가 아래 모든 역할을 수행한다.

| 컴포넌트 | 역할 | 실행 방식 |
|---------|------|----------|
| **System Tray** | 트레이 아이콘, 우클릭 메뉴, 더블클릭 시 브라우저 오픈 | 메인 스레드 (pystray) |
| **FastAPI** | REST API + WebSocket + 정적 파일 서빙 | 별도 스레드 (uvicorn) |
| **Collector Engine** | 서버별 WMI/SSH 원격 수집 | asyncio 태스크 (서버당 1개) |
| **Alert Engine** | 임계치 판단 + 알림 생성 + Webhook 발송 | 수집 콜백 |
| **Scheduler** | 데이터 집계, 오래된 데이터 정리, 헬스체크 | APScheduler |

### 2-3. 포트

| 포트 | 용도 |
|------|------|
| **52800** | 대시보드 + API (운영자 브라우저 접속) |

> 52800은 일반적으로 충돌이 없는 번호다. 설정에서 변경 가능하게 한다.

---

## 3. 기술 스택

### 3-1. Backend + Desktop (Python)

| 패키지 | 버전 | 역할 |
|--------|------|------|
| **Python** | 3.11 | 런타임 (PyInstaller로 단일 exe 패키징) |
| **FastAPI** | 0.110+ | REST API + WebSocket + 정적 파일 서빙 |
| **uvicorn** | 0.29+ | ASGI 서버 |
| **SQLAlchemy** | 2.0+ | ORM |
| **aiosqlite** | 0.20+ | 비동기 SQLite |
| **pydantic** | 2.x | 데이터 검증 |
| **paramiko** | 3.x | SSH 클라이언트 (Linux 수집) |
| **pywinrm** | 0.4+ | WinRM 클라이언트 (Windows 수집) |
| **wmi** | 1.5+ | 로컬 WMI 쿼리 (원격 WMI는 pywinrm 활용) |
| **httpx** | 0.27+ | 헬스체크, Webhook 발송 |
| **APScheduler** | 3.x | 백그라운드 스케줄러 |
| **openpyxl** | 3.x | Excel 리포트 생성 |
| **scikit-learn** | 1.x | AI 이상탐지 (Isolation Forest) |
| **python-jose** | 3.x | JWT |
| **passlib[bcrypt]** | 1.7+ | 비밀번호 해싱 |
| **pystray** | 0.19+ | **Windows 시스템 트레이 아이콘** |
| **Pillow** | 10.x | 트레이 아이콘 이미지 처리 |
| **cryptography** | 42+ | 서버 접속 비밀번호 AES 암호화 |
| **PyInstaller** | 6.x | 단일 exe 패키징 |

### 3-2. Frontend (React)

| 패키지 | 버전 | 역할 |
|--------|------|------|
| **React** | 18.x | UI 프레임워크 |
| **TypeScript** | 5.x | 타입 안전 |
| **Vite** | 5.x | 빌드 |
| **React Router** | 6.x | SPA 라우팅 |
| **TanStack Query** | 5.x | 서버 상태 + 캐싱 |
| **Zustand** | 4.x | 클라이언트 전역 상태 |
| **Recharts** | 2.x | 시계열 차트 |
| **AG Grid Community** | 31.x | 테이블 (정렬, 필터, 가상 스크롤) |
| **Tailwind CSS** | 3.x | 스타일링 |
| **Headless UI** | 2.x | 모달, 드롭다운, 탭 (접근성 보장) |
| **lucide-react** | latest | 아이콘 |
| **react-hot-toast** | 2.x | 토스트 알림 |
| **date-fns** | 3.x | 날짜 처리 |
| **react-datepicker** | latest | 기간 선택 캘린더 |

### 3-3. 설치/배포

| 도구 | 역할 |
|------|------|
| **PyInstaller** | Python → 단일 exe |
| **Inno Setup** | Windows 설치 프로그램 (.exe) 생성 |
| **Windows Task Scheduler** | 로그인 시 자동 시작 등록 |

---

## 4. 데이터베이스

### 4-1. 보존 정책

| 테이블 | 간격 | 보존 | 30대 기준 상시 rows |
|--------|------|------|---------------------|
| metrics_raw | 3초 | 24시간 | ~86만 |
| metrics_5min | 5분 | 30일 | ~26만 |
| metrics_hourly | 1시간 | 1년 | ~26만 |
| server_logs | - | 7일 | 가변 |
| alert_history | - | 90일 | 가변 |
| **합계** | | | **~150만 rows ≈ 100~200MB** |

### 4-2. 전체 스키마

아래 SQL을 `init_db.py`에서 그대로 실행한다.

```sql
-- ================================================================
-- PRAGMA (앱 시작 시 매번 실행)
-- ================================================================
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
PRAGMA busy_timeout = 5000;

-- ================================================================
-- servers: 모니터링 대상 서버
-- ================================================================
CREATE TABLE IF NOT EXISTS servers (
    server_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname          TEXT NOT NULL,
    display_name      TEXT NOT NULL,
    ip_address        TEXT NOT NULL UNIQUE,
    domain            TEXT,
    os_type           TEXT NOT NULL DEFAULT 'windows',   -- windows | linux
    os_version        TEXT,

    -- 접속 정보
    credential_user   TEXT NOT NULL,
    credential_pass   TEXT NOT NULL,                      -- AES 암호화 저장
    ssh_port          INTEGER DEFAULT 22,
    ssh_key_path      TEXT,
    winrm_port        INTEGER DEFAULT 5985,
    use_ssl           INTEGER DEFAULT 0,

    -- 분류
    group_name        TEXT DEFAULT '미분류',
    location          TEXT,
    description       TEXT,
    tags              TEXT DEFAULT '[]',                   -- JSON: ["prod","critical"]

    -- 하드웨어 (첫 수집 시 자동)
    cpu_model         TEXT,
    cpu_cores         INTEGER,
    total_memory_mb   INTEGER,
    disk_info         TEXT,                                -- JSON: 파티션 정보

    -- 상태
    status            TEXT DEFAULT 'unknown',              -- online|warning|critical|offline|maintenance
    last_collected_at TEXT,
    collect_error     TEXT,
    is_maintenance    INTEGER DEFAULT 0,
    maintenance_until TEXT,
    is_active         INTEGER DEFAULT 1,

    -- 서버별 수집 설정
    collect_interval  INTEGER DEFAULT 3,
    collect_processes INTEGER DEFAULT 1,
    collect_services  INTEGER DEFAULT 1,
    collect_logs      INTEGER DEFAULT 1,

    created_at        TEXT DEFAULT (datetime('now','localtime')),
    updated_at        TEXT DEFAULT (datetime('now','localtime'))
);

-- ================================================================
-- metrics_raw: 실시간 (24시간 보존)
-- ================================================================
CREATE TABLE IF NOT EXISTS metrics_raw (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id         INTEGER NOT NULL REFERENCES servers(server_id),
    collected_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    cpu_usage_pct     REAL,
    cpu_load_1m       REAL,
    cpu_load_5m       REAL,
    cpu_load_15m      REAL,
    mem_total_mb      INTEGER,
    mem_used_mb       INTEGER,
    mem_usage_pct     REAL,
    swap_total_mb     INTEGER,
    swap_used_mb      INTEGER,
    disk_json         TEXT,           -- JSON: [{mount,total_gb,used_gb,free_gb,usage_pct}]
    disk_read_mbps    REAL,
    disk_write_mbps   REAL,
    net_json          TEXT,           -- JSON: [{iface,in_mbps,out_mbps,errors}]
    net_connections   INTEGER,
    process_count     INTEGER,
    uptime_seconds    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_raw_lookup ON metrics_raw(server_id, collected_at DESC);

-- ================================================================
-- metrics_5min: 5분 집계 (30일 보존)
-- ================================================================
CREATE TABLE IF NOT EXISTS metrics_5min (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL,
    bucket_time   TEXT NOT NULL,
    cpu_avg       REAL, cpu_max REAL, cpu_min REAL,
    mem_avg_pct   REAL, mem_max_pct REAL,
    disk_read_avg REAL, disk_write_avg REAL,
    net_in_avg    REAL, net_out_avg REAL,
    sample_count  INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_5min_uk ON metrics_5min(server_id, bucket_time);

-- ================================================================
-- metrics_hourly: 1시간 집계 (1년 보존)
-- ================================================================
CREATE TABLE IF NOT EXISTS metrics_hourly (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL,
    bucket_time   TEXT NOT NULL,
    cpu_avg       REAL, cpu_max REAL, cpu_p95 REAL,
    mem_avg_pct   REAL, mem_max_pct REAL,
    disk_read_avg REAL, disk_write_avg REAL,
    net_in_avg    REAL, net_out_avg REAL,
    alert_count   INTEGER DEFAULT 0,
    downtime_sec  INTEGER DEFAULT 0,
    sample_count  INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_uk ON metrics_hourly(server_id, bucket_time);

-- ================================================================
-- service_status: 서비스 스냅샷 (최신만)
-- ================================================================
CREATE TABLE IF NOT EXISTS service_status (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL,
    service_name  TEXT NOT NULL,
    display_name  TEXT,
    status        TEXT,          -- running|stopped|paused|unknown
    start_type    TEXT,          -- auto|manual|disabled
    pid           INTEGER,
    mem_mb        REAL,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_svc ON service_status(server_id);

-- ================================================================
-- process_snapshot: 프로세스 스냅샷 (최신 TOP N만)
-- ================================================================
CREATE TABLE IF NOT EXISTS process_snapshot (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL,
    pid           INTEGER,
    name          TEXT,
    username      TEXT,
    cpu_pct       REAL,
    mem_mb        REAL,
    mem_pct       REAL,
    thread_count  INTEGER,
    status        TEXT,
    command_line  TEXT,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_proc ON process_snapshot(server_id);

-- ================================================================
-- server_logs: 로그 (7일 보존)
-- ================================================================
CREATE TABLE IF NOT EXISTS server_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL,
    log_source    TEXT,          -- system|application|security|syslog|auth
    log_level     TEXT,          -- ERROR|WARN|INFO
    message       TEXT,
    event_id      INTEGER,
    occurred_at   TEXT NOT NULL,
    collected_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_log_lookup ON server_logs(server_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_level ON server_logs(log_level, occurred_at DESC);

-- ================================================================
-- alert_rules: 임계치 규칙
-- ================================================================
CREATE TABLE IF NOT EXISTS alert_rules (
    rule_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name     TEXT NOT NULL,
    description   TEXT,
    server_id     INTEGER,               -- NULL이면 group_name 또는 전체
    group_name    TEXT,                   -- NULL이면 server_id 또는 전체
    metric_name   TEXT NOT NULL,          -- cpu_usage_pct|mem_usage_pct|disk_usage_pct|service_stopped|collect_timeout
    condition_op  TEXT DEFAULT '>=',
    warning_value REAL,
    critical_value REAL,
    duration_sec  INTEGER DEFAULT 30,     -- N초 지속 후 발동
    cooldown_sec  INTEGER DEFAULT 300,    -- 재알림 방지
    is_enabled    INTEGER DEFAULT 1,
    sort_order    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
);

-- ================================================================
-- alert_history: 알림 이력 (90일 보존)
-- ================================================================
CREATE TABLE IF NOT EXISTS alert_history (
    alert_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL,
    rule_id       INTEGER REFERENCES alert_rules(rule_id),
    severity      TEXT NOT NULL,          -- warning|critical|resolved|info
    metric_name   TEXT,
    metric_value  REAL,
    threshold_value REAL,
    message       TEXT NOT NULL,
    acknowledged  INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    resolved_at   TEXT,
    webhook_sent  INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_alert_active ON alert_history(severity)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alert_time ON alert_history(server_id, created_at DESC);

-- ================================================================
-- health_checks + health_check_results
-- ================================================================
CREATE TABLE IF NOT EXISTS health_checks (
    check_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id     INTEGER NOT NULL REFERENCES servers(server_id),
    check_type    TEXT NOT NULL,          -- ping|tcp|http
    check_name    TEXT,
    target        TEXT NOT NULL,          -- host:port 또는 URL
    interval_sec  INTEGER DEFAULT 60,
    timeout_sec   INTEGER DEFAULT 10,
    expected_status INTEGER,
    is_enabled    INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS health_check_results (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id      INTEGER NOT NULL REFERENCES health_checks(check_id),
    server_id     INTEGER NOT NULL,
    is_healthy    INTEGER NOT NULL,
    response_ms   INTEGER,
    status_code   INTEGER,
    error_message TEXT,
    checked_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_hcr ON health_check_results(check_id, checked_at DESC);

-- ================================================================
-- users
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    role          TEXT DEFAULT 'viewer',  -- admin|operator|viewer
    is_active     INTEGER DEFAULT 1,
    preferences   TEXT DEFAULT '{}',      -- JSON
    last_login    TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);

-- ================================================================
-- app_settings: 전역 설정 (key-value)
-- ================================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    label         TEXT,
    category      TEXT,          -- general|collection|retention|threshold|webhook
    value_type    TEXT DEFAULT 'string',  -- string|number|boolean
    description   TEXT,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
);

INSERT OR IGNORE INTO app_settings (key, value, label, category, value_type, description) VALUES
    ('app_port',                 '52800', '대시보드 포트',          'general',    'number',  '브라우저 접속 포트'),
    ('auto_start',               'true',  '윈도우 시작 시 자동실행', 'general',    'boolean', ''),
    ('collect_interval_metrics', '3',     '메트릭 수집 주기(초)',    'collection', 'number',  ''),
    ('collect_interval_process', '10',    '프로세스 수집 주기(초)',  'collection', 'number',  ''),
    ('collect_interval_service', '30',    '서비스 수집 주기(초)',    'collection', 'number',  ''),
    ('collect_interval_log',     '30',    '로그 수집 주기(초)',      'collection', 'number',  ''),
    ('collect_process_top_n',    '30',    '프로세스 수집 개수',      'collection', 'number',  ''),
    ('retention_raw_hours',      '24',    'Raw 보존(시간)',          'retention',  'number',  ''),
    ('retention_5min_days',      '30',    '5분 집계 보존(일)',       'retention',  'number',  ''),
    ('retention_hourly_days',    '365',   '1시간 집계 보존(일)',     'retention',  'number',  ''),
    ('retention_log_days',       '7',     '로그 보존(일)',           'retention',  'number',  ''),
    ('retention_alert_days',     '90',    '알림 보존(일)',           'retention',  'number',  ''),
    ('default_cpu_warn',         '70',    'CPU 경고(%)',             'threshold',  'number',  ''),
    ('default_cpu_crit',         '90',    'CPU 위험(%)',             'threshold',  'number',  ''),
    ('default_mem_warn',         '80',    '메모리 경고(%)',          'threshold',  'number',  ''),
    ('default_mem_crit',         '95',    '메모리 위험(%)',          'threshold',  'number',  ''),
    ('default_disk_warn',        '80',    '디스크 경고(%)',          'threshold',  'number',  ''),
    ('default_disk_crit',        '95',    '디스크 위험(%)',          'threshold',  'number',  ''),
    ('default_duration_sec',     '30',    '지속시간(초)',            'threshold',  'number',  ''),
    ('timeout_warn_sec',         '15',    '수집실패 경고(초)',       'threshold',  'number',  ''),
    ('timeout_crit_sec',         '60',    '수집실패 위험(초)',       'threshold',  'number',  ''),
    ('webhook_slack_url',        '',      'Slack Webhook URL',       'webhook',    'string',  ''),
    ('webhook_slack_enabled',    'false', 'Slack 활성화',            'webhook',    'boolean', ''),
    ('webhook_teams_url',        '',      'Teams Webhook URL',       'webhook',    'string',  ''),
    ('webhook_teams_enabled',    'false', 'Teams 활성화',            'webhook',    'boolean', ''),
    ('webhook_webex_url',        '',      'Webex Webhook URL',       'webhook',    'string',  ''),
    ('webhook_webex_enabled',    'false', 'Webex 활성화',            'webhook',    'boolean', ''),
    ('webhook_severity',         'critical','Webhook 알림 수준',     'webhook',    'string',  'all|warning|critical');

-- ================================================================
-- report_history
-- ================================================================
CREATE TABLE IF NOT EXISTS report_history (
    report_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    report_name TEXT NOT NULL,
    report_type TEXT,
    server_ids  TEXT,
    date_from   TEXT NOT NULL,
    date_to     TEXT NOT NULL,
    file_path   TEXT,
    file_size_kb INTEGER,
    created_by  TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- ================================================================
-- audit_log: 감사 로그
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT,
    action      TEXT NOT NULL,
    target_type TEXT,
    target_id   INTEGER,
    detail      TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_audit ON audit_log(created_at DESC);
```

### 4-3. 자동 정리 SQL (스케줄러가 1시간마다 실행)

```sql
DELETE FROM metrics_raw WHERE collected_at < datetime('now', '-24 hours', 'localtime');
DELETE FROM metrics_5min WHERE bucket_time < datetime('now', '-30 days', 'localtime');
DELETE FROM metrics_hourly WHERE bucket_time < datetime('now', '-365 days', 'localtime');
DELETE FROM server_logs WHERE collected_at < datetime('now', '-7 days', 'localtime');
DELETE FROM alert_history WHERE created_at < datetime('now', '-90 days', 'localtime');
DELETE FROM health_check_results WHERE checked_at < datetime('now', '-30 days', 'localtime');
```

---

## 5. 원격 수집 엔진

### 5-1. 수집 방식별 명령어 매핑

#### Windows (WinRM/PowerShell Remoting)

```python
# pywinrm을 통해 PowerShell 명령을 원격 실행

COMMANDS_WINDOWS = {
    "cpu": """
        Get-CimInstance Win32_Processor |
        Measure-Object -Property LoadPercentage -Average |
        Select-Object -ExpandProperty Average
    """,

    "memory": """
        $os = Get-CimInstance Win32_OperatingSystem
        @{
            total_mb  = [math]::Round($os.TotalVisibleMemorySize/1024)
            free_mb   = [math]::Round($os.FreePhysicalMemory/1024)
            used_mb   = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)/1024)
            usage_pct = [math]::Round((1 - $os.FreePhysicalMemory/$os.TotalVisibleMemorySize)*100, 1)
        } | ConvertTo-Json
    """,

    "disk": """
        Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
        Select-Object DeviceID,
            @{N='total_gb';E={[math]::Round($_.Size/1GB,1)}},
            @{N='free_gb';E={[math]::Round($_.FreeSpace/1GB,1)}},
            @{N='used_gb';E={[math]::Round(($_.Size-$_.FreeSpace)/1GB,1)}},
            @{N='usage_pct';E={[math]::Round((1-$_.FreeSpace/$_.Size)*100,1)}} |
        ConvertTo-Json
    """,

    "network": """
        Get-NetAdapterStatistics | Where-Object { $_.ReceivedBytes -gt 0 } |
        Select-Object Name, ReceivedBytes, SentBytes |
        ConvertTo-Json
    """,

    "processes": """
        Get-Process | Sort-Object CPU -Descending | Select-Object -First 30
            Id, ProcessName, CPU,
            @{N='mem_mb';E={[math]::Round($_.WorkingSet64/1MB,1)}},
            @{N='threads';E={$_.Threads.Count}} |
        ConvertTo-Json
    """,

    "services": """
        Get-Service | Where-Object { $_.StartType -ne 'Disabled' } |
        Select-Object ServiceName, DisplayName, Status, StartType |
        ConvertTo-Json
    """,

    "uptime": """
        (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime |
        Select-Object -ExpandProperty TotalSeconds
    """,

    "event_logs": """
        Get-EventLog -LogName System -Newest 50 -EntryType Error,Warning |
        Select-Object TimeGenerated, EntryType, Source, EventID, Message |
        ConvertTo-Json
    """,

    "sysinfo": """
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        $os = Get-CimInstance Win32_OperatingSystem
        @{
            os_version = $os.Caption + ' ' + $os.Version
            cpu_model = $cpu.Name
            cpu_cores = $cpu.NumberOfLogicalProcessors
            total_memory_mb = [math]::Round($os.TotalVisibleMemorySize/1024)
        } | ConvertTo-Json
    """
}
```

#### Linux (SSH + 표준 명령)

```python
# paramiko를 통해 SSH 명령 실행

COMMANDS_LINUX = {
    "cpu":       "top -bn1 | grep 'Cpu(s)' | awk '{print 100-$8}'",
    "loadavg":   "cat /proc/loadavg | awk '{print $1,$2,$3}'",
    "memory":    "free -m | awk '/Mem:/{printf \"{\\\"total_mb\\\":%s,\\\"used_mb\\\":%s,\\\"free_mb\\\":%s,\\\"usage_pct\\\":%.1f}\", $2,$3,$4,$3/$2*100}'",
    "swap":      "free -m | awk '/Swap:/{print $2,$3}'",
    "disk":      "df -BG --output=target,size,used,avail,pcent -x tmpfs -x devtmpfs | tail -n+2",
    "disk_io":   "cat /proc/diskstats",
    "network":   "cat /proc/net/dev | tail -n+3",
    "net_conn":  "ss -tun state established | wc -l",
    "processes": "ps aux --sort=-%cpu | head -31 | tail -30",
    "services":  "systemctl list-units --type=service --state=running,failed --no-pager --plain",
    "uptime":    "cat /proc/uptime | awk '{print int($1)}'",
    "logs":      "journalctl --since '30 seconds ago' --no-pager -o json --priority=0..4",
    "sysinfo":   "echo $(uname -r) && nproc && free -m | awk '/Mem:/{print $2}' && cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2"
}
```

### 5-2. 수집 엔진 동작 흐름

```
앱 시작
  │
  ├─ servers 테이블에서 is_active=1인 서버 목록 로드
  │
  ├─ 서버마다 asyncio 태스크 생성:
  │     │
  │     ├─ [3초마다] collect_metrics()
  │     │     ├─ WinRM 또는 SSH 접속
  │     │     ├─ CPU/MEM/DISK/NET 명령 실행 (배치)
  │     │     ├─ 결과 파싱 → metrics_raw INSERT
  │     │     ├─ alert_engine.evaluate() 호출
  │     │     └─ WebSocket 브로드캐스트
  │     │
  │     ├─ [10초마다] collect_processes()
  │     │     ├─ 프로세스 명령 실행
  │     │     └─ process_snapshot UPSERT (기존 삭제 후 INSERT)
  │     │
  │     ├─ [30초마다] collect_services()
  │     │     ├─ 서비스 명령 실행
  │     │     └─ service_status UPSERT
  │     │
  │     └─ [30초마다] collect_logs()
  │           ├─ 이벤트 로그/journalctl 실행
  │           └─ server_logs INSERT
  │
  ├─ 서버 추가/삭제/수정 시 해당 태스크만 재시작
  │
  └─ 접속 실패 시:
        ├─ 3회 연속 실패 → status='offline' + 알림
        ├─ collect_error에 에러 메시지 저장
        └─ 다음 주기에 재시도 (지수 백오프 없음, 단순 재시도)
```

### 5-3. WinRM 연결 풀

```python
# 서버당 WinRM 세션 1개를 유지하고 재사용
class WinRMPool:
    sessions: dict[int, winrm.Session]  # server_id → Session

    def get_session(self, server) -> winrm.Session:
        if server.server_id not in self.sessions:
            self.sessions[server.server_id] = winrm.Session(
                f"http://{server.ip_address}:{server.winrm_port}/wsman",
                auth=(server.credential_user, decrypt(server.credential_pass)),
                transport='ntlm'
            )
        return self.sessions[server.server_id]
```

### 5-4. SSH 연결 풀

```python
# 서버당 paramiko SSHClient 1개를 유지하고 재사용
class SSHPool:
    clients: dict[int, paramiko.SSHClient]

    def get_client(self, server) -> paramiko.SSHClient:
        if server.server_id not in self.clients or not self._is_alive(server.server_id):
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                hostname=server.ip_address,
                port=server.ssh_port,
                username=server.credential_user,
                password=decrypt(server.credential_pass),
                key_filename=server.ssh_key_path or None,
                timeout=10
            )
            self.clients[server.server_id] = client
        return self.clients[server.server_id]
```

---

## 6. Backend API

### 6-1. 전체 엔드포인트

```
Base: http://localhost:52800/api/v1

── 인증 ──
POST   /auth/login                         로그인 (JWT 발급)
POST   /auth/logout                        로그아웃
GET    /auth/me                            내 정보

── 대시보드 ──
GET    /dashboard/summary                  전체 요약 (서버 수, 상태별 카운트, 평균 메트릭)
GET    /dashboard/alerts/active            현재 활성 알림 목록

── 서버 관리 (운영자 CRUD) ──
GET    /servers                            서버 목록 (?group=&status=&search=&sort=&page=&size=)
POST   /servers                            서버 등록
GET    /servers/{id}                       서버 상세
PUT    /servers/{id}                       서버 수정
DELETE /servers/{id}                       서버 비활성화
POST   /servers/{id}/test-connection       접속 테스트 (등록 전 연결 확인)
POST   /servers/{id}/maintenance           유지보수 모드 전환
POST   /servers/import                     서버 일괄 등록 (CSV/JSON)
GET    /servers/export                     서버 목록 내보내기

── 메트릭 ──
GET    /servers/{id}/metrics/latest        최신 메트릭
GET    /servers/{id}/metrics/history       이력 (?from=&to=&interval=auto|raw|5m|1h)
GET    /servers/compare                    서버 비교 (?ids=1,2,3&metric=cpu&from=&to=)

── 프로세스 & 서비스 ──
GET    /servers/{id}/processes             프로세스 목록 (최신)
GET    /servers/{id}/services              서비스 목록 (최신)

── 로그 ──
GET    /servers/{id}/logs                  로그 (?level=&source=&search=&from=&to=&page=&size=)

── 알림 ──
GET    /alerts                             알림 목록 (?severity=&server_id=&acknowledged=&from=&to=&page=&size=)
GET    /alerts/active                      활성(미해결) 알림
PUT    /alerts/{id}/acknowledge            알림 확인
PUT    /alerts/{id}/resolve                알림 수동 해제
PUT    /alerts/acknowledge-all             전체 확인

── 알림 규칙 (임계치) ──
GET    /alert-rules                        규칙 목록
POST   /alert-rules                        규칙 생성
PUT    /alert-rules/{id}                   규칙 수정
DELETE /alert-rules/{id}                   규칙 삭제
POST   /alert-rules/reset-defaults         기본 프리셋으로 초기화

── 헬스체크 ──
GET    /servers/{id}/health-checks         목록 + 최신 결과
POST   /servers/{id}/health-checks         등록
PUT    /health-checks/{id}                 수정
DELETE /health-checks/{id}                 삭제
POST   /servers/{id}/health-check-now      즉시 실행

── 리포트 ──
POST   /reports/generate                   리포트 생성 (기간 필수)
GET    /reports                            이력
GET    /reports/{id}/download              다운로드

── 설정 ──
GET    /settings                           전체 설정 (?category=)
PUT    /settings                           설정 변경 (JSON body: {key: value, ...})
POST   /settings/webhook/test              Webhook 테스트 발송

── 사용자 관리 ──
GET    /users                              사용자 목록
POST   /users                              사용자 생성
PUT    /users/{id}                         수정
DELETE /users/{id}                         비활성화

── WebSocket ──
WS     /ws/dashboard                       대시보드 실시간 스트림
WS     /ws/server/{id}                     서버 상세 실시간 스트림
```

### 6-2. 주요 요청/응답 스키마

```typescript
// POST /servers — 서버 등록 요청
interface CreateServerRequest {
  hostname: string;
  display_name: string;
  ip_address: string;
  domain?: string;
  os_type: 'windows' | 'linux';
  credential_user: string;
  credential_pass: string;          // 평문 전송 → 서버에서 AES 암호화 저장
  ssh_port?: number;                // default: 22
  winrm_port?: number;              // default: 5985
  group_name?: string;              // default: '미분류'
  location?: string;
  description?: string;
  tags?: string[];
}

// GET /servers — 서버 목록 응답
interface ServerListResponse {
  items: ServerSummary[];
  total: number;
  page: number;
  size: number;
}
interface ServerSummary {
  server_id: number;
  display_name: string;
  ip_address: string;
  os_type: string;
  group_name: string;
  status: 'online' | 'warning' | 'critical' | 'offline' | 'maintenance';
  cpu_usage_pct: number | null;     // 최신 값
  mem_usage_pct: number | null;
  disk_max_pct: number | null;      // 가장 사용률 높은 파티션
  last_collected_at: string | null;
  active_alerts: number;            // 미해결 알림 수
}

// GET /dashboard/summary
interface DashboardSummary {
  total_servers: number;
  status_counts: { online: number; warning: number; critical: number; offline: number; maintenance: number };
  avg_cpu: number;
  avg_mem: number;
  active_alerts: number;
  unacknowledged_alerts: number;
  today_alert_count: number;
  uptime_pct: number;               // 전체 가동률 (24시간)
}

// GET /alerts/active
interface ActiveAlert {
  alert_id: number;
  server_id: number;
  server_name: string;
  severity: 'warning' | 'critical';
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  message: string;
  acknowledged: boolean;
  created_at: string;
  duration_seconds: number;         // 발생 후 경과 시간
}

// POST /reports/generate
interface GenerateReportRequest {
  date_from: string;                // 필수: '2025-01-01'
  date_to: string;                  // 필수: '2025-01-31'
  server_ids?: number[];            // null이면 전체
  report_type: 'summary' | 'detail' | 'alerts';
}
```

---

## 7. WebSocket 프로토콜

### 7-1. 연결

```
ws://localhost:52800/ws/dashboard      전체 대시보드
ws://localhost:52800/ws/server/{id}    특정 서버 상세
```

### 7-2. 서버→클라이언트 메시지

```jsonc
// 메트릭 업데이트 (3초마다, 모든 서버)
{
  "type": "metrics",
  "server_id": 1,
  "server_name": "WEB-01",
  "status": "online",
  "data": {
    "cpu_usage_pct": 34.2,
    "mem_usage_pct": 67.5,
    "disk_max_pct": 64.0,
    "net_connections": 142,
    "process_count": 85
  },
  "timestamp": "2025-02-06T10:30:00"
}

// 알림 발생
{
  "type": "alert_fired",
  "alert_id": 1234,
  "server_id": 3,
  "server_name": "DB-01",
  "severity": "critical",
  "message": "CPU 사용률 95.3% — 임계치 90% 초과 (30초 지속)",
  "timestamp": "2025-02-06T10:30:15"
}

// 알림 해제
{
  "type": "alert_resolved",
  "alert_id": 1234,
  "server_id": 3,
  "server_name": "DB-01",
  "message": "CPU 정상 복귀 (현재 42%)",
  "timestamp": "2025-02-06T10:35:30"
}

// 서버 상태 변경
{
  "type": "status_change",
  "server_id": 5,
  "server_name": "FILE-01",
  "old_status": "online",
  "new_status": "offline",
  "timestamp": "2025-02-06T10:30:15"
}

// 서버 상세 — 프로세스/서비스 업데이트 (10초/30초마다)
{
  "type": "processes_update",
  "server_id": 1,
  "data": [ /* process_snapshot rows */ ],
  "timestamp": "..."
}
```

---

## 8. 기능 명세

### 8-1. 대시보드 (메인)

**실시간 갱신**: WebSocket을 통해 3초마다 모든 서버 카드가 업데이트된다.

**구성 요소**:

| 영역 | 내용 | 갱신 |
|------|------|------|
| 인프라 요약 바 | 서버 수, 상태별 카운트(🟢🟡🔴⚫🔧), 평균 CPU/MEM, 가동률, 오늘 알림 수 | 3초 |
| 서버 카드 그리드 | 서버별 카드 (이름, IP, 상태 뱃지, CPU/MEM/DISK 미니 게이지, 스파크라인) | 3초 |
| 알림 패널 (우측) | 실시간 알림 스트림, 미확인 건수 배지, 확인 버튼 | 실시간 |
| 필터 바 | 그룹 필터, 상태 필터, 검색, 뷰 전환(카드/테이블) | - |

**서버 카드 클릭 → 서버 상세 페이지로 이동**

### 8-2. 서버 상세 페이지

| 탭 | 내용 |
|----|------|
| **개요** | 4개 메트릭(CPU/MEM/DISK/NET) 실시간 미니차트, 서버 정보, 활성 알림, 최근 이벤트 |
| **CPU** | 사용률 실시간 라인차트, Load Average, 기간 변경(1h/6h/24h/7d/30d/커스텀) |
| **메모리** | 사용률 차트, Swap, 구성 비율 |
| **디스크** | 파티션별 사용률 바, I/O 차트, 용량 추세 |
| **네트워크** | 인터페이스별 In/Out 차트, 연결 수 |
| **서비스** | 서비스 테이블 (이름, 상태, 시작유형, PID, 필터, 정렬) |
| **프로세스** | 프로세스 테이블 (PID, 이름, CPU%, MEM, 스레드, 필터, 정렬) |
| **로그** | 로그 테이블 (시간, 레벨, 소스, 메시지, 레벨 필터, 키워드 검색) |
| **헬스체크** | 등록된 체크 목록, 결과, 응답시간 추이, "지금 체크" 버튼 |

**모든 차트에 기간 선택기**: `[1시간] [6시간] [24시간] [7일] [30일] [커스텀 📅~📅]`

### 8-3. 알림 시스템

```
메트릭 수신 → 해당 서버에 적용되는 규칙 조회 → 조건 판단 → 지속시간 체크 → 쿨다운 체크
                                                                      │
                                                          ┌───────────▼────────────┐
                                                          │ 알림 발생              │
                                                          │ 1. alert_history INSERT│
                                                          │ 2. WebSocket broadcast │
                                                          │ 3. Webhook 발송 (설정시)│
                                                          └────────────────────────┘
                                                          
정상 복귀 시 → resolved 알림 자동 생성 → 동일하게 WebSocket + Webhook
```

**알림 UI 표현**:
- 대시보드 우측 알림 패널에 실시간 스트림 (최신순)
- 서버 카드 상태 뱃지 색상 변경 (🟢→🟡→🔴)
- 브라우저 탭 타이틀에 미확인 알림 수 표시: `(3) ServerEye`
- 토스트 팝업: 새 critical 알림 발생 시 화면 우상단 토스트

### 8-4. 리포트 & 내보내기

**리포트 생성 UI**:

```
┌─ 리포트 생성 ──────────────────────────────┐
│                                             │
│  기간 설정 (필수)                            │
│  [📅 시작일] ~ [📅 종료일]                   │
│  빠른 선택: [오늘] [이번주] [이번달] [지난달] │
│                                             │
│  대상 서버                                   │
│  ◉ 전체 서버                                │
│  ○ 선택: [▼ 서버 선택 드롭다운 (다중선택)]    │
│                                             │
│  리포트 유형                                 │
│  ◉ 종합 요약                                │
│  ○ 서버별 상세                               │
│  ○ 알림 이력                                 │
│                                             │
│                    [생성 & 다운로드]          │
└─────────────────────────────────────────────┘
```

**엑셀 시트 구성**:

| Sheet | 내용 |
|-------|------|
| 요약 | 기간, 대상, 전체 가동률, 주요 이슈 TOP 5 |
| 서버별 현황 | 서버명/평균CPU/최대CPU/평균MEM/최대MEM/디스크/가동률/알림수 (조건부 서식) |
| 시계열 데이터 | 타임스탬프/서버/CPU/MEM/DISK/NET (5분 또는 1시간 간격) |
| 알림 이력 | 발생시각/서버/심각도/메트릭/값/임계치/해결시각/소요시간 |
| 차트 | CPU/MEM 추세 라인차트 (openpyxl 차트) |

---

## 9. 운영자 관리 기능

### 9-1. 서버 관리

#### 서버 등록 (추가)

```
┌─ 서버 등록 ──────────────────────────────────────────┐
│                                                       │
│  기본 정보                                             │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ 표시명 *         │  │ WEB-SERVER-01             │   │
│  │ IP 주소 *        │  │ 192.168.1.10              │   │
│  │ 호스트명         │  │ web01.internal            │   │
│  │ 도메인           │  │ web01.company.local       │   │
│  │ OS 유형 *        │  │ ◉ Windows  ○ Linux        │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                       │
│  접속 정보                                             │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ 계정 *           │  │ administrator             │   │
│  │ 비밀번호 *       │  │ ••••••••                  │   │
│  │ 포트             │  │ 5985 (WinRM)              │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                       │
│  분류                                                  │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ 그룹             │  │ [▼ WEB / WAS / DB / ...]  │   │
│  │ 위치             │  │ 본사 서버실               │   │
│  │ 태그             │  │ [prod] [critical] [+추가] │   │
│  │ 설명             │  │ IIS 웹 서버               │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                       │
│          [접속 테스트]              [등록]  [취소]      │
└───────────────────────────────────────────────────────┘
```

- **접속 테스트 버튼**: 등록 전에 WMI/SSH 연결이 되는지 확인
- **비밀번호**: AES-256으로 암호화하여 DB 저장
- **일괄 등록**: CSV 파일 업로드로 여러 서버 한 번에 등록

#### 서버 수정

- 서버 목록 또는 상세 페이지에서 "편집" 버튼
- 등록과 동일한 폼, 기존 값이 채워진 상태로 열림
- 수정 시 수집 태스크 자동 재시작

#### 서버 삭제

- 실제 DELETE가 아닌 `is_active = 0`으로 비활성화
- 비활성화 시 수집 즉시 중단
- 설정에서 "비활성 서버 표시" 토글로 복구 가능

### 9-2. 임계치 관리

```
┌─ 알림 규칙 관리 ────────────────────────────────────────────────────────┐
│                                                                          │
│  [+ 규칙 추가]  [기본값으로 초기화]                                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ #  │ 규칙명        │ 적용대상   │ 메트릭   │ 경고  │ 위험  │ 지속 │ 활성│
│  │ 1  │ CPU 과부하     │ 전체 서버  │ CPU %    │ 70%  │ 90%  │ 30초│ ✅ │ [편집][삭제]
│  │ 2  │ 메모리 부족    │ 전체 서버  │ MEM %    │ 80%  │ 95%  │ 60초│ ✅ │ [편집][삭제]
│  │ 3  │ 디스크 부족    │ 전체 서버  │ DISK %   │ 80%  │ 95%  │ -   │ ✅ │ [편집][삭제]
│  │ 4  │ DB CPU 전용    │ DB 그룹    │ CPU %    │ 60%  │ 80%  │ 30초│ ✅ │ [편집][삭제]
│  │ 5  │ 수집 실패      │ 전체 서버  │ timeout  │ 15초 │ 60초 │ -   │ ✅ │ [편집][삭제]
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  규칙 편집 모달:                                                          │
│  ┌────────────────────────────────────────────────────┐                  │
│  │ 규칙명:   [CPU 과부하          ]                    │                  │
│  │ 적용:     ◉전체 ○그룹:[▼     ] ○서버:[▼          ] │                  │
│  │ 메트릭:   [▼ CPU 사용률 (%)    ]                    │                  │
│  │ 조건:     [▼ >= ]                                   │                  │
│  │ 경고 값:  [70   ]  위험 값: [90   ]                 │                  │
│  │ 지속시간: [30   ] 초  (0이면 즉시)                   │                  │
│  │ 쿨다운:   [300  ] 초                                │                  │
│  │ 활성화:   [✅]                                      │                  │
│  │                                                     │                  │
│  │                          [저장]  [취소]             │                  │
│  └────────────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9-3. 필터 & 정렬 (모든 테이블 공통)

모든 AG Grid 테이블은 아래 기능을 동일하게 제공한다:

| 기능 | 구현 |
|------|------|
| **컬럼 정렬** | 헤더 클릭으로 오름차순/내림차순 토글 |
| **컬럼 필터** | 헤더의 필터 아이콘 클릭 → 텍스트/숫자/선택 필터 |
| **글로벌 검색** | 테이블 상단 검색 입력창 (모든 컬럼 대상) |
| **컬럼 표시/숨김** | 테이블 우상단 "컬럼 설정" 버튼 → 체크박스 |
| **컬럼 너비 조절** | 드래그로 조절 |
| **페이지네이션** | 하단 페이지 네비게이션 (기본 50rows/page) |
| **행 수 선택** | [25] [50] [100] [전체] |
| **CSV 내보내기** | 테이블 우상단 "내보내기" 버튼 → 현재 필터 적용 상태로 다운로드 |

### 9-4. 내보내기 (기간 설정)

모든 내보내기 기능에는 기간 선택이 필수:

```
┌─ 내보내기 ─────────────────────────────┐
│                                         │
│  기간: [📅 2025-01-01] ~ [📅 2025-01-31]│
│                                         │
│  빠른 선택:                              │
│  [오늘] [어제] [이번주] [지난주]         │
│  [이번달] [지난달] [최근7일] [최근30일]  │
│                                         │
│  형식: ◉ Excel (.xlsx)  ○ CSV          │
│                                         │
│                          [다운로드]      │
└─────────────────────────────────────────┘
```

---

## 10. 외부 연동

### 10-1. 설계 원칙

- 연동은 **운영자가 원할 때** 설정 페이지에서 URL/키만 입력하면 즉시 동작
- 코드 변경 없이 UI만으로 활성화/비활성화
- Webhook 방식으로 통일 (Slack, Teams, Webex 모두 Incoming Webhook 지원)

### 10-2. 설정 UI

```
┌─ 설정 > 외부 연동 ─────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Slack ─────────────────────────────────────────────┐        │
│  │ 활성화: [🔘 OFF]                                     │        │
│  │ Webhook URL: [https://hooks.slack.com/services/...  ]│        │
│  │                                        [테스트 발송] │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─ Microsoft Teams ───────────────────────────────────┐        │
│  │ 활성화: [🔘 OFF]                                     │        │
│  │ Webhook URL: [https://company.webhook.office.com/...] │       │
│  │                                        [테스트 발송] │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─ Webex ─────────────────────────────────────────────┐        │
│  │ 활성화: [🔘 OFF]                                     │        │
│  │ Webhook URL: [https://webexapis.com/v1/webhooks/...  ]│       │
│  │                                        [테스트 발송] │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  공통 설정                                                       │
│  알림 수준: ◉ Critical만  ○ Warning 이상  ○ 전체               │
│                                                                  │
│                                            [저장]               │
└──────────────────────────────────────────────────────────────────┘
```

### 10-3. Webhook 메시지 포맷

```python
# Slack
{
    "text": "🔴 [CRITICAL] DB-01 — CPU 95.3% (임계치 90%)",
    "attachments": [{
        "color": "#E53E3E",
        "fields": [
            {"title": "서버", "value": "DB-01 (192.168.1.30)", "short": True},
            {"title": "메트릭", "value": "CPU 사용률 95.3%", "short": True},
            {"title": "임계치", "value": "90%", "short": True},
            {"title": "발생시각", "value": "2025-02-06 10:30:15", "short": True}
        ]
    }]
}

# Teams (Adaptive Card)
{
    "@type": "MessageCard",
    "themeColor": "E53E3E",
    "summary": "[CRITICAL] DB-01 CPU 95.3%",
    "sections": [{
        "activityTitle": "🔴 CRITICAL — DB-01",
        "facts": [
            {"name": "서버", "value": "DB-01 (192.168.1.30)"},
            {"name": "메트릭", "value": "CPU 사용률 95.3%"},
            {"name": "임계치", "value": "90%"},
            {"name": "발생시각", "value": "2025-02-06 10:30:15"}
        ]
    }]
}

# Webex
{
    "markdown": "🔴 **[CRITICAL]** DB-01 — CPU 95.3% (임계치 90%)\n\n- 서버: DB-01 (192.168.1.30)\n- 발생시각: 2025-02-06 10:30:15"
}
```

---

## 11. 데스크톱 앱 & 설치

### 11-1. 시스템 트레이

```
Windows 작업 표시줄 우측 시스템 트레이 영역:

  [...] [🔋] [📶] [🖥️ ServerEye]        ← 트레이 아이콘

더블클릭 → 기본 브라우저에서 http://localhost:52800 열기

우클릭 메뉴:
  ┌─────────────────────────┐
  │  🖥️ ServerEye v1.0.0    │
  │  ─────────────────────  │
  │  📊 대시보드 열기        │  → 브라우저 오픈
  │  ⚙️ 설정                │  → 브라우저에서 설정 페이지
  │  📋 서버 관리            │  → 브라우저에서 서버 관리
  │  🔔 알림 (3)            │  → 브라우저에서 알림 페이지
  │  ─────────────────────  │
  │  📊 리포트 생성          │  → 브라우저에서 리포트
  │  📁 데이터 폴더 열기     │  → Explorer에서 DB 폴더
  │  📝 로그 파일 보기       │  → 앱 로그 파일 열기
  │  ─────────────────────  │
  │  🔄 수집 재시작          │  → 모든 수집 태스크 재시작
  │  ⏸️ 수집 일시 중지       │  → 전체 수집 중지/재개
  │  ─────────────────────  │
  │  ❌ 종료                 │  → 프로세스 종료
  └─────────────────────────┘
```

### 11-2. 트레이 아이콘 상태 표시

| 상태 | 아이콘 색상 | 조건 |
|------|-----------|------|
| 정상 | 🟢 초록 테두리 | 모든 서버 정상 |
| 경고 | 🟡 노란 테두리 | 1개 이상 Warning |
| 위험 | 🔴 빨간 테두리 | 1개 이상 Critical |
| 중지 | ⚫ 회색 | 수집 일시 중지 상태 |

### 11-3. 설치 프로그램

**Inno Setup으로 생성하는 Windows 설치 프로그램**:

```
ServerEye_Setup_v1.0.0.exe

설치 과정:
1. 라이센스 동의
2. 설치 경로 선택 (기본: C:\Program Files\ServerEye\)
3. 옵션 선택:
   [✅] 바탕화면 바로가기 생성
   [✅] Windows 시작 시 자동 실행
4. 설치 완료 → 자동 실행

설치되는 파일:
C:\Program Files\ServerEye\
  ├── servereye.exe          # PyInstaller 패키징 (단일 exe)
  ├── icon.ico               # 트레이/바탕화면 아이콘
  ├── web\                   # React 빌드 정적 파일
  │   ├── index.html
  │   ├── assets\
  │   └── ...
  └── README.txt

데이터 디렉토리 (사용자별):
C:\Users\{user}\AppData\Local\ServerEye\
  ├── servereye.db           # SQLite DB
  ├── servereye.log          # 앱 로그
  ├── reports\               # 생성된 리포트
  └── config.ini             # 로컬 설정 (포트 등)
```

### 11-4. 자동 시작

```ini
# Windows 레지스트리 등록 (설치 시)
[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run]
"ServerEye"="C:\Program Files\ServerEye\servereye.exe --minimized"
```

`--minimized` 플래그: 시작 시 트레이에만 표시, 브라우저 자동 열지 않음

### 11-5. 운영자 교체 시나리오

```
1. 새 PC에 ServerEye_Setup.exe 설치
2. 프로그램 실행 → 초기 설정 위자드:
   ┌─ 초기 설정 ─────────────────────────────┐
   │                                           │
   │  관리자 계정 생성                          │
   │  아이디: [admin        ]                  │
   │  비밀번호: [••••••••    ]                  │
   │  비밀번호 확인: [••••••••]                 │
   │                                           │
   │  또는 기존 DB 가져오기:                    │
   │  [📁 servereye.db 파일 선택]              │
   │                                           │
   │                          [시작하기]        │
   └───────────────────────────────────────────┘
3. 서버 등록 시작 (또는 기존 DB에서 자동 로드)
4. 바로 모니터링 시작
```

---

## 12. 디자인 가이드

### 12-1. 디자인 철학

```
"관제 도구는 정보를 빠르게 파악하는 것이 핵심이다.
 장식 없이, 데이터가 곧 디자인이다."

- 포인트 컬러 하나로 통일감
- 불필요한 장식 제거, 여백으로 정보 구분
- 상태(정상/경고/위험)는 색상만으로 즉시 인지
- 한국어 가독성 최적화
```

### 12-2. 컬러 시스템

#### 포인트 컬러: **Indigo (#4F46E5)**

선정 이유: 파란 계열 중 채도와 명도의 균형이 좋고, 관제 화면의 빨강/노랑/초록 상태색과 충돌하지 않으면서 전문적이고 신뢰감 있는 인상을 준다.

```css
:root {
  /* ── 포인트 컬러 (Indigo) ── */
  --color-primary-50:  #EEF2FF;
  --color-primary-100: #E0E7FF;
  --color-primary-200: #C7D2FE;
  --color-primary-300: #A5B4FC;
  --color-primary-400: #818CF8;
  --color-primary-500: #6366F1;
  --color-primary-600: #4F46E5;    /* ← 메인 */
  --color-primary-700: #4338CA;
  --color-primary-800: #3730A3;
  --color-primary-900: #312E81;

  /* ── 상태 컬러 (이것은 고정, 절대 변경하지 않는다) ── */
  --color-success:     #10B981;    /* 초록 — online, 정상 */
  --color-warning:     #F59E0B;    /* 노랑 — warning */
  --color-danger:      #EF4444;    /* 빨강 — critical, 에러 */
  --color-neutral:     #6B7280;    /* 회색 — offline, 비활성 */
  --color-maintenance: #8B5CF6;    /* 보라 — 유지보수 모드 */

  /* ── 배경/텍스트 (라이트 모드) ── */
  --bg-primary:    #FFFFFF;        /* 카드, 모달 배경 */
  --bg-secondary:  #F9FAFB;        /* 페이지 배경 */
  --bg-tertiary:   #F3F4F6;        /* 입력창 배경, 호버 */
  --text-primary:  #111827;        /* 본문 */
  --text-secondary:#6B7280;        /* 보조 텍스트 */
  --text-tertiary: #9CA3AF;        /* 비활성 텍스트 */
  --border:        #E5E7EB;        /* 테두리 */
  --border-strong: #D1D5DB;        /* 강조 테두리 */

  /* ── 배경/텍스트 (다크 모드) ── */
  --dark-bg-primary:    #1F2937;
  --dark-bg-secondary:  #111827;
  --dark-bg-tertiary:   #374151;
  --dark-text-primary:  #F9FAFB;
  --dark-text-secondary:#9CA3AF;
  --dark-border:        #374151;
}
```

#### 컬러 사용 규칙

| 용도 | 컬러 | 적용 위치 |
|------|------|----------|
| **포인트** (Indigo 600) | #4F46E5 | 사이드바 활성 메뉴, 주요 버튼, 링크, 선택된 탭, 차트 기본색 |
| **정상** (Green) | #10B981 | 서버 상태 뱃지, 서비스 Running 뱃지, 헬스체크 성공 |
| **경고** (Amber) | #F59E0B | Warning 뱃지, 알림 카드 좌측 테두리 |
| **위험** (Red) | #EF4444 | Critical 뱃지, 알림 카드 좌측 테두리, 에러 로그 |
| **비활성** (Gray) | #6B7280 | Offline 뱃지, 비활성 서버, 비활성 버튼 |
| **배경** (White/Gray) | #FFF/#F9FAFB | 카드 위에 카드는 항상 흰색, 페이지 배경은 연한 회색 |

### 12-3. 타이포그래피

```css
/* 한국어 가독성 최우선 */

/* 시스템 폰트 스택 — 별도 웹폰트 로드 없이 네이티브 폰트 사용 */
font-family:
  -apple-system,
  BlinkMacSystemFont,
  'Apple SD Gothic Neo',      /* macOS 한국어 */
  'Pretendard Variable',      /* 설치되어 있으면 사용 */
  'Malgun Gothic',            /* Windows 한국어 */
  'Segoe UI',                 /* Windows 영문 */
  system-ui,
  sans-serif;

/* 모노스페이스 (코드, 로그, IP 주소 등) */
font-family-mono:
  'JetBrains Mono',
  'Cascadia Code',
  'D2Coding',
  'Consolas',
  monospace;
```

| 용도 | 크기 | 굵기 | 행간 |
|------|------|------|------|
| 페이지 제목 (h1) | 24px (1.5rem) | 700 (Bold) | 1.3 |
| 섹션 제목 (h2) | 18px (1.125rem) | 600 (SemiBold) | 1.4 |
| 카드 제목 (h3) | 15px (0.9375rem) | 600 | 1.4 |
| 본문 | 14px (0.875rem) | 400 (Regular) | 1.5 |
| 보조 텍스트 | 13px (0.8125rem) | 400 | 1.5 |
| 캡션 / 라벨 | 12px (0.75rem) | 500 (Medium) | 1.4 |
| 테이블 셀 | 13px | 400 | 1.4 |
| 수치 (메트릭) | 28px (1.75rem) | 700 | 1.1 |
| 코드/IP/로그 | 13px (mono) | 400 | 1.5 |

### 12-4. 컴포넌트 스타일

#### 버튼

```
Primary:  bg-indigo-600, text-white, hover:bg-indigo-700, rounded-lg, h-9, px-4, text-sm font-medium
          그림자 없음. 호버 시 배경만 어두워짐.

Secondary: bg-white, text-gray-700, border border-gray-300, hover:bg-gray-50
           설정에서 사용하는 보조 버튼.

Danger:   bg-red-50, text-red-700, hover:bg-red-100
          삭제 등 위험 액션에만 사용.

Ghost:    bg-transparent, text-gray-600, hover:bg-gray-100
          필터 토글, 아이콘 버튼 등에 사용.

버튼 크기: sm(h-8), md(h-9 기본), lg(h-10)
아이콘+텍스트: 아이콘은 텍스트 왼쪽, gap-1.5
아이콘만: 정사각형 (w-9 h-9)
```

#### 카드

```
배경: white
테두리: border border-gray-200 (1px solid #E5E7EB)
모서리: rounded-xl (12px)
그림자: shadow-sm (0 1px 2px rgba(0,0,0,0.05))
호버: shadow-md 전환 (transition-shadow duration-150)
내부 여백: p-5 (20px)
카드 간격: gap-4 (16px)

절대 사용하지 않는 것:
  - 과도한 그림자 (shadow-lg, shadow-xl)
  - 두꺼운 테두리
  - 배경 그라데이션
```

#### 상태 뱃지

```
공통: inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium

Online:      bg-emerald-50  text-emerald-700  좌측에 🟢 (8px 원형 dot)
Warning:     bg-amber-50    text-amber-700    좌측에 🟡 dot
Critical:    bg-red-50      text-red-700      좌측에 🔴 dot (애니메이션 pulse)
Offline:     bg-gray-100    text-gray-600     좌측에 ⚫ dot
Maintenance: bg-violet-50   text-violet-700   좌측에 🔧 아이콘

dot 구현: w-2 h-2 rounded-full bg-{color} mr-1.5
Critical dot: animate-pulse 추가
```

#### 입력 폼

```
Input:   h-9, rounded-lg, border border-gray-300, px-3, text-sm
         focus: ring-2 ring-indigo-500 ring-offset-0, border-indigo-500
         placeholder: text-gray-400
         비활성: bg-gray-50, text-gray-500

Select:  Input과 동일 스타일, 우측에 ChevronDown 아이콘
Toggle:  w-9 h-5 rounded-full, 활성=bg-indigo-600, 비활성=bg-gray-200
Label:   text-sm font-medium text-gray-700, mb-1
```

#### 모달 (Dialog)

```
오버레이: bg-black/50 backdrop-blur-sm
모달 본체: bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4
          p-6, 상단에 제목 + X 닫기 버튼
하단 액션: pt-4 border-t border-gray-100, flex justify-end gap-3
애니메이션: opacity + scale 전환 (150ms)
```

#### 테이블 (AG Grid 커스텀)

```
헤더: bg-gray-50, text-xs font-medium text-gray-500 uppercase, tracking-wider
행: hover:bg-gray-50/50, 짝수행 배경 변경 없음 (줄무늬 제거)
셀: py-3 px-4, text-sm
하단: 회색 테두리 상단선, 페이지네이션
테두리: 외곽 border border-gray-200 rounded-xl overflow-hidden
```

### 12-5. 차트 스타일

```
라인 차트:
  - 라인 두께: 2px
  - 라인 색상: Indigo-500 (#6366F1) — 기본
  - 영역 채움: Indigo-500 opacity 10%
  - Warning 라인: dashed, Amber-400
  - Critical 라인: dashed, Red-400
  - 그리드: 가로선만, #F3F4F6, strokeDasharray 없음
  - X축: 시간 (HH:mm), 회색 텍스트 12px
  - Y축: 0~100(%), 회색 텍스트 12px
  - 호버 툴팁: white bg, shadow-lg, rounded-lg, 값 + 시간

미니 게이지 (대시보드 카드 내):
  - 원형이 아닌 수평 바 형태
  - 높이 4px, rounded-full
  - 배경: gray-200
  - 채움: 0~70% green, 70~90% amber, 90~100% red
  - 라벨: 우측에 퍼센트 숫자

스파크라인 (카드 내 미니 차트):
  - 높이 32px, 너비 카드 전체
  - 라인만, 축/라벨 없음
  - 색상: 상태에 따라 green/amber/red
```

### 12-6. 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ Header (h-14)                                               │
│ 좌: 로고 + "ServerEye" │ 중: 없음 │ 우: 알림벨+카운트, 사용자│
├──────────┬──────────────────────────────────────────────────┤
│ Sidebar  │ Main Content                                     │
│ (w-60)   │                                                  │
│          │  Page Header (제목 + 액션 버튼)                   │
│ 📊 대시보드│                                                  │
│ 🖥 서버목록│  Content Area                                    │
│ 🔔 알림   │  (p-6, bg-gray-50)                               │
│ 📋 리포트 │                                                  │
│ ───────  │                                                  │
│ ⚙ 설정   │                                                  │
│ 👥 사용자 │                                                  │
│          │                                                  │
│          │                                                  │
│ v1.0.0   │                                                  │
└──────────┴──────────────────────────────────────────────────┘

Sidebar:
  - 배경: white
  - 우측 테두리: border-r border-gray-200
  - 메뉴 아이템: h-10, px-3, rounded-lg, text-sm
  - 활성 메뉴: bg-indigo-50 text-indigo-700 font-medium
  - 비활성 메뉴: text-gray-600 hover:bg-gray-50
  - 아이콘: 20px, 텍스트 좌측, gap-3
  - 섹션 구분선: my-2 border-t border-gray-100

Header:
  - 배경: white
  - 하단 테두리: border-b border-gray-200
  - 로고: text-lg font-bold text-gray-900
  - 알림 벨: 상대 위치에 빨간 dot (미확인 시)
```

### 12-7. 다크 모드

```
다크 모드는 설정에서 토글.
Tailwind의 class 전략 사용: <html class="dark">

매핑:
  bg-white        → dark:bg-gray-800
  bg-gray-50      → dark:bg-gray-900
  bg-gray-100     → dark:bg-gray-800
  text-gray-900   → dark:text-gray-100
  text-gray-600   → dark:text-gray-400
  border-gray-200 → dark:border-gray-700

차트, 상태 컬러는 동일하게 유지.
```

### 12-8. 절대 하지 않는 것

```
❌ 그라데이션 배경
❌ 과도한 그림자 (shadow-xl 이상)
❌ 둥근 원형 프로필 이미지
❌ 아이콘에 컬러 배경 원형
❌ 보라-파랑 그라데이션 버튼
❌ 각 카드마다 다른 색상
❌ 이모지를 버튼 텍스트에 사용 (아이콘 컴포넌트만 사용)
❌ 웹폰트 외부 로딩 (시스템 폰트만)
❌ 둥근 아바타
❌ 장식적 일러스트레이션
```

---

## 13. 화면 설계

### 13-1. 대시보드

```
┌── Header ──────────────────────────────────────────────────────────┐
│  [≡] ServerEye                                    🔔(3)  👤 admin  │
├── Sidebar ──┬──────────────────────────────────────────────────────┤
│             │                                                      │
│ 📊 대시보드  │  ┌─ 인프라 요약 ─────────────────────────────────┐  │
│ 🖥 서버 관리 │  │ 서버 22대   🟢18  🟡2  🔴1  ⚫1              │  │
│ 🔔 알림     │  │ CPU 평균 34%  MEM 평균 52%  가동률 99.2%     │  │
│ 📋 리포트   │  │ 오늘 알림 12건 (미확인 3)                      │  │
│ ──────────  │  └────────────────────────────────────────────────┘  │
│ ⚙ 설정     │                                                      │
│ 👥 사용자   │  필터: [ALL▼] [상태▼] [검색...        ] [카드|테이블]│
│             │                                                      │
│             │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│             │  │🟢WEB-01│ │🟡WAS-01│ │🔴DB-01 │ │🟢WEB-02│       │
│             │  │CPU  23%│ │CPU  72%│ │CPU  95%│ │CPU  15%│       │
│             │  │MEM  45%│ │MEM  80%│ │MEM  88%│ │MEM  30%│       │
│             │  │DSK  60%│ │DSK  55%│ │DSK  70%│ │DSK  45%│       │
│             │  │▁▂▃▂▁▂▃▁│ │▃▅▆▇▆▅▃▅│ │▇█▇█▇█▇█│ │▁▁▂▁▁▂▁▁│       │
│             │  └────────┘ └────────┘ └────────┘ └────────┘       │
│             │                                                      │
│             │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│             │  │🟢WAS-02│ │⚫DEV-01│ │🔧STG-01│ │🟢FIL-01│       │
│             │  │CPU  30%│ │OFFLINE │ │유지보수 │ │CPU  12%│       │
│             │  └────────┘ └────────┘ └────────┘ └────────┘       │
│             │                                                      │
│ v1.0.0      │  ── 실시간 알림 (하단 슬라이드업 또는 우측 패널) ──   │
│             │  🔴 10:30 DB-01 CPU 95% 초과  [확인]                │
│             │  🟡 10:28 WAS-01 MEM 80% 초과 [확인]                │
└─────────────┴──────────────────────────────────────────────────────┘
```

### 13-2. 서버 상세

```
┌── Header ──────────────────────────────────────────────────────────┐
├── Sidebar ──┬──────────────────────────────────────────────────────┤
│             │  ← 뒤로   WEB-01  192.168.1.10  🟢Online            │
│             │  Windows Server 2019 │ 8Core/16GB │ Up 45d │ v1.0   │
│             │                                                      │
│             │  [개요] [CPU] [메모리] [디스크] [네트워크]             │
│             │  [서비스] [프로세스] [로그] [헬스체크]                 │
│             │                                                      │
│             │  기간: [1h] [6h] [24h] [7d] [30d] [📅~📅]            │
│             │                                                      │
│             │  ┌─ CPU 사용률 ─────────────────────────────────┐   │
│             │  │ 100│                                          │   │
│             │  │  80│         ╭──╮                             │   │
│             │  │  60│    ╭────╯  ╰──╮                         │   │
│             │  │  40│╭───╯          ╰───╮    ╭──╮             │   │
│             │  │  20│╯                   ╰───╯  ╰────         │   │
│             │  │   0├─────────────────────────────────         │   │
│             │  │    10:00  10:10  10:20  10:30                │   │
│             │  │    -------- Warning 70%  -------- Critical 90%│  │
│             │  └───────────────────────────────────────────────┘   │
│             │                                                      │
│             │  ┌ 현재 ──────┐  ┌ 임계치 ───────────────────┐     │
│             │  │ CPU: 34.2% │  │ ⚠ Warning  >= 70% (30초)  │     │
│             │  │ Load: 2.1  │  │ 🚨 Critical >= 90% (30초)  │     │
│             │  └────────────┘  └───────────────────[편집]───┘     │
│             │                                                      │
│             │  ┌ 프로세스 TOP 10 ───────────────────────────┐     │
│             │  │PID  │이름         │CPU% │MEM(MB)│스레드│상태│     │
│             │  │4512 │sqlservr.exe │15.2 │2,048  │45    │Run │     │
│             │  │1234 │w3wp.exe     │ 8.5 │  512  │12    │Run │     │
│             │  └─────────────────────────────────────────────┘     │
└─────────────┴──────────────────────────────────────────────────────┘
```

### 13-3. 서버 관리 (목록)

```
┌─────────────┬──────────────────────────────────────────────────────┐
│             │  서버 관리                       [+ 서버 등록] [일괄]│
│             │                                                      │
│             │  [검색...        ] [그룹▼] [상태▼] [OS▼]             │
│             │                                                      │
│             │  ┌───────────────────────────────────────────────┐   │
│             │  │ □ │표시명   │IP           │OS  │그룹│상태  │액션│  │
│             │  │ □ │WEB-01  │192.168.1.10│Win │WEB │🟢정상│✏🗑│  │
│             │  │ □ │WAS-01  │192.168.1.11│Win │WAS │🟡경고│✏🗑│  │
│             │  │ □ │DB-01   │192.168.1.30│Win │DB  │🔴위험│✏🗑│  │
│             │  │ □ │WEB-LNX │192.168.1.50│Lnx │WEB │🟢정상│✏🗑│  │
│             │  │ □ │DEV-01  │192.168.1.90│Win │DEV │⚫오프│✏🗑│  │
│             │  └───────────────────────────────────────────────┘   │
│             │                                                      │
│             │  선택된 2개: [일괄 그룹 변경] [일괄 삭제]             │
│             │                                                      │
│             │  ◀ 1 2 3 ▶  │  25/50/100 행                        │
└─────────────┴──────────────────────────────────────────────────────┘
```

### 13-4. 설정 페이지

```
┌─────────────┬──────────────────────────────────────────────────────┐
│             │  설정                                                │
│             │                                                      │
│             │  [일반] [수집] [보존정책] [기본임계치] [외부연동]       │
│             │                                                      │
│             │  ── 수집 설정 ──                                     │
│             │                                                      │
│             │  메트릭 수집 주기    [ 3  ] 초                       │
│             │  프로세스 수집 주기  [ 10 ] 초                       │
│             │  서비스 수집 주기    [ 30 ] 초                       │
│             │  로그 수집 주기      [ 30 ] 초                       │
│             │  프로세스 수집 개수  [ 30 ] 개 (상위 N개)             │
│             │                                                      │
│             │  ── 보존 정책 ──                                     │
│             │                                                      │
│             │  Raw 데이터 보존     [ 24  ] 시간                    │
│             │  5분 집계 보존       [ 30  ] 일                      │
│             │  1시간 집계 보존     [ 365 ] 일                      │
│             │  로그 보존           [ 7   ] 일                      │
│             │                                                      │
│             │                               [기본값복원] [저장]    │
└─────────────┴──────────────────────────────────────────────────────┘
```

---

## 14. 프로젝트 구조

```
servereye/
├── README.md
├── pyproject.toml                        # Python 프로젝트 설정
├── requirements.txt
├── build.py                              # PyInstaller 빌드 스크립트
├── installer.iss                         # Inno Setup 스크립트
│
├── backend/
│   ├── main.py                           # 진입점: 트레이 + FastAPI 시작
│   ├── config.py                         # 설정 관리
│   ├── tray.py                           # 시스템 트레이 (pystray)
│   │
│   ├── api/                              # FastAPI 라우터
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── servers.py
│   │   ├── metrics.py
│   │   ├── alerts.py
│   │   ├── alert_rules.py
│   │   ├── health_checks.py
│   │   ├── reports.py
│   │   ├── settings.py
│   │   ├── users.py
│   │   ├── dashboard.py
│   │   └── websocket.py
│   │
│   ├── core/                             # 핵심 비즈니스 로직
│   │   ├── __init__.py
│   │   ├── collector.py                  # 수집 오케스트레이터
│   │   ├── collector_winrm.py            # Windows WinRM 수집
│   │   ├── collector_ssh.py              # Linux SSH 수집
│   │   ├── connection_pool.py            # WinRM/SSH 연결 풀
│   │   ├── alert_engine.py               # 임계치 판단 + 알림 생성
│   │   ├── aggregator.py                 # 5분/1시간 집계
│   │   ├── anomaly.py                    # AI 이상탐지
│   │   ├── notifier.py                   # Webhook 발송 (Slack/Teams/Webex)
│   │   ├── report_gen.py                 # 엑셀 리포트 생성
│   │   ├── health_checker.py             # 헬스체크 (ping/tcp/http)
│   │   ├── ws_manager.py                 # WebSocket 연결 관리
│   │   └── crypto.py                     # AES 암/복호화 (비밀번호)
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py                   # SQLAlchemy 엔진/세션
│   │   ├── models.py                     # ORM 모델
│   │   ├── schemas.py                    # Pydantic 스키마
│   │   └── init_db.py                    # 테이블 생성 + 시드
│   │
│   ├── scheduler/
│   │   ├── __init__.py
│   │   └── jobs.py                       # APScheduler 작업
│   │
│   └── assets/
│       ├── icon.ico                      # 트레이/설치 아이콘
│       ├── icon_green.ico                # 정상 상태
│       ├── icon_yellow.ico               # 경고 상태
│       ├── icon_red.ico                  # 위험 상태
│       └── icon_gray.ico                 # 중지 상태
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                       # Router
│       │
│       ├── api/
│       │   ├── client.ts                # axios 인스턴스
│       │   ├── websocket.ts             # WebSocket 클라이언트
│       │   └── hooks/                   # TanStack Query 훅
│       │       ├── useServers.ts
│       │       ├── useMetrics.ts
│       │       ├── useAlerts.ts
│       │       ├── useHealthChecks.ts
│       │       ├── useReports.ts
│       │       ├── useSettings.ts
│       │       └── useUsers.ts
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   └── Layout.tsx
│       │   ├── ui/                      # 기본 UI (shadcn 스타일)
│       │   │   ├── Button.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Select.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Toggle.tsx
│       │   │   ├── Tabs.tsx
│       │   │   ├── Toast.tsx
│       │   │   └── DateRangePicker.tsx
│       │   ├── charts/
│       │   │   ├── RealtimeChart.tsx
│       │   │   ├── MiniGauge.tsx
│       │   │   ├── SparkLine.tsx
│       │   │   └── DiskBar.tsx
│       │   ├── dashboard/
│       │   │   ├── InfraSummary.tsx
│       │   │   ├── ServerCard.tsx
│       │   │   ├── AlertPanel.tsx
│       │   │   └── FilterBar.tsx
│       │   ├── server-detail/
│       │   │   ├── OverviewTab.tsx
│       │   │   ├── CpuTab.tsx
│       │   │   ├── MemoryTab.tsx
│       │   │   ├── DiskTab.tsx
│       │   │   ├── NetworkTab.tsx
│       │   │   ├── ServiceTab.tsx
│       │   │   ├── ProcessTab.tsx
│       │   │   ├── LogTab.tsx
│       │   │   └── HealthCheckTab.tsx
│       │   └── common/
│       │       ├── StatusBadge.tsx
│       │       ├── TimeRangeSelector.tsx
│       │       ├── ExportButton.tsx
│       │       ├── ConfirmDialog.tsx
│       │       └── EmptyState.tsx
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── ServerList.tsx
│       │   ├── ServerDetail.tsx
│       │   ├── Alerts.tsx
│       │   ├── AlertRules.tsx
│       │   ├── Reports.tsx
│       │   ├── Settings.tsx
│       │   ├── Users.tsx
│       │   ├── Login.tsx
│       │   └── SetupWizard.tsx          # 초기 설정 마법사
│       │
│       ├── stores/
│       │   ├── authStore.ts
│       │   ├── dashboardStore.ts
│       │   └── settingsStore.ts
│       │
│       ├── types/
│       │   └── index.ts                 # 전체 TypeScript 타입
│       │
│       └── utils/
│           ├── format.ts                # 숫자, 날짜, 바이트 포맷
│           └── constants.ts             # 상수
│
└── docs/
    ├── INSTALL.md
    └── TROUBLESHOOTING.md
```

---

## 15. Git 컨벤션

### 15-1. 브랜치 전략

```
main              ← 릴리즈 (태그 v1.0.0 등)
  └─ develop      ← 개발 통합
       ├─ feat/dashboard-main
       ├─ feat/server-crud
       ├─ feat/alert-engine
       ├─ feat/report-export
       ├─ fix/websocket-reconnect
       └─ chore/build-config
```

| 접두사 | 용도 |
|--------|------|
| `feat/` | 새 기능 |
| `fix/` | 버그 수정 |
| `refactor/` | 리팩토링 |
| `chore/` | 빌드, 설정, 의존성 |
| `docs/` | 문서 |

### 15-2. 커밋 메시지 규칙

**형식**: `type: 한글 또는 영문 설명`

```
feat: 대시보드 서버 카드 그리드 구현
feat: 서버 등록/수정/삭제 API 및 폼 추가
feat: WebSocket 실시간 메트릭 스트림 연동
feat: 알림 엔진 임계치 판단 로직 구현
feat: 엑셀 리포트 생성 및 다운로드 기능
feat: 시스템 트레이 아이콘 및 메뉴 구현
feat: WinRM 원격 수집 모듈 구현
feat: SSH 원격 수집 모듈 구현
fix: 서버 상세 차트 기간 변경 시 데이터 깜빡임 수정
fix: 알림 쿨다운 타이머 초기화 누락 수정
fix: WinRM 세션 타임아웃 후 재연결 처리
refactor: 수집 엔진 비동기 구조 개선
refactor: 테이블 필터 컴포넌트 공통화
chore: PyInstaller 빌드 설정 추가
chore: Inno Setup 설치 스크립트 작성
chore: 프로덕션 빌드 최적화
docs: API 명세 업데이트
```

**절대 금지 사항**:
```
❌ "AI로 생성", "Claude 작성", "GPT 생성" 등 AI 관련 언급 금지
❌ "자동 생성", "auto-generated" 등의 표현 금지
❌ 영문 커밋 시에도 AI/LLM/Claude/GPT/Copilot 단어 사용 금지
```

### 15-3. PR 규칙

```
PR 제목: [feat] 대시보드 서버 카드 실시간 업데이트 구현

## 변경 사항
- 서버 카드 컴포넌트 구현 (CPU/MEM/DISK 게이지, 스파크라인)
- WebSocket 연동으로 3초 실시간 업데이트
- 그룹 필터, 상태 필터, 검색 기능

## 테스트
- [x] 20대 서버 동시 모니터링 확인
- [x] WebSocket 재연결 테스트
- [x] 다크 모드 확인
```

### 15-4. 태그 & 릴리즈

```
v1.0.0    Phase 1 완료 (MVP)
v1.1.0    Phase 2 완료 (리포트, 알림 확장)
v1.2.0    Phase 3 완료 (AI, 외부연동)
v2.0.0    대규모 변경 시

태그 명령:
git tag -a v1.0.0 -m "v1.0.0 — 서버 모니터링 대시보드 MVP"
git push origin v1.0.0
```

### 15-5. .gitignore

```gitignore
# Python
__pycache__/
*.pyc
*.pyd
*.egg-info/
dist/
build/
*.spec

# Node
node_modules/
frontend/dist/

# IDE
.vscode/
.idea/
*.swp

# Data
*.db
*.db-wal
*.db-shm
*.log
reports/

# Environment
.env
.env.local
config.ini

# Build artifacts
*.exe
Output/
```

---

## 16. 개발 로드맵

### Step 1: 개발

#### Phase 1 — 기반 구축 및 핵심 수집

| 순서 | 영역 | 작업 내용 |
|------|------|----------|
| **1** | 프로젝트 셋업 | Git 저장소 초기화, 모노레포 구조 생성 (`/backend`, `/frontend`), `.gitignore`·`README.md` 작성 |
| | 백엔드 | FastAPI 프로젝트 골격 생성, SQLAlchemy 2.0 + aiosqlite 연동, Alembic 마이그레이션 초기 셋업 |
| | DB | 전체 스키마 생성 (servers, metrics_raw/5min/hourly, alert_rules, alert_history 등 전 테이블), SQLite WAL 모드·인덱스·pragma 적용 |
| | 프론트엔드 | React 18 + TypeScript + Vite 프로젝트 생성, Tailwind CSS + shadcn/ui 설정, 라우터 구성, AppLayout·Sidebar·Header 컴포넌트 |
| **2** | 백엔드 | WinRM 수집 모듈 구현 (CPU/MEM/DISK/NET/프로세스/서비스), SSH 수집 모듈 구현, asyncio 기반 병렬 수집 엔진 |
| | 백엔드 | 서버 CRUD API (`POST/GET/PUT/DELETE /api/v1/servers`), 접속 테스트 API (`POST /api/v1/servers/test-connection`) |
| | 프론트엔드 | 서버 관리 페이지 (목록 테이블 + 등록/수정 모달 + 삭제 확인), 접속 테스트 버튼 연동 |
| **3** | 백엔드 | 메트릭 저장 API, 메트릭 조회 API (latest/history), WebSocket 서버 (`/ws/metrics`) |
| | 프론트엔드 | 대시보드 메인: InfraSummary 카드, ServerCard 그리드, 그룹 필터바, 상태별 필터 |
| | 프론트엔드 | WebSocket 연동 (useWebSocket 훅), Recharts 기반 실시간 미니 차트 |

**Phase 1 완료 기준**: 서버 등록 → WinRM/SSH 접속 테스트 → 실시간 메트릭 수집 → 대시보드 카드에 CPU/MEM/DISK 표시

#### Phase 2 — 상세 모니터링 및 알림

| 순서 | 영역 | 작업 내용 |
|------|------|----------|
| **4** | 백엔드 | 서버 상세 메트릭 API (탭별: CPU/MEM/DISK/NET), 프로세스 목록 API, 서비스 목록 API |
| | 프론트엔드 | 서버 상세 페이지 전체 탭 구현 (📋개요, 💻CPU, 🧠메모리, 💾디스크, 🌐네트워크, ⚙️서비스, 📜로그) |
| | 프론트엔드 | Recharts 시계열 차트 (시간 범위 셀렉터: 1h/6h/24h/7d/30d), 프로세스/서비스 테이블 |
| **5** | 백엔드 | 알림 엔진 구현 (임계치 비교 → 지속시간 체크 → 알림 생성 → 자동 해제), 알림 CRUD API |
| | 백엔드 | 임계치 규칙 CRUD API, 기본 프리셋 적용 로직 |
| | 프론트엔드 | 알림 실시간 패널 (우측 슬라이드), 알림 이력 페이지 (필터: 심각도/서버/기간/상태), 알림 확인(Acknowledge) 버튼 |
| | 프론트엔드 | 임계치 설정 페이지 (글로벌 기본값 + 서버별 오버라이드 테이블) |
| **6** | 백엔드 | 로그 수집 모듈 (Windows Event Log via WinRM, Linux syslog/journalctl via SSH), 로그 WebSocket 스트리밍 |
| | 백엔드 | 헬스체크 엔진 (PING/TCP/HTTP), 헬스체크 CRUD API, 수동 실행 API |
| | 프론트엔드 | 로그 뷰어 (실시간 스트리밍 + 레벨 필터 + 키워드 검색), 헬스체크 UI (목록 + 결과 + "지금 체크" 버튼) |

**Phase 2 완료 기준**: 전 탭 모니터링 동작, 임계치 초과 시 알림 팝업, 로그 실시간 확인, 헬스체크 수동/자동 실행

#### Phase 3 — 운영 도구 및 리포트

| 순서 | 영역 | 작업 내용 |
|------|------|----------|
| **7** | 백엔드 | 엑셀 리포트 생성 엔진 (openpyxl), 기간별 데이터 쿼리·집계, 리포트 다운로드 API |
| | 백엔드 | 데이터 집계 스케줄러 (raw→5min→hourly), 데이터 정리 스케줄러 (보존 기간 초과 삭제) |
| | 프론트엔드 | 리포트 페이지 (리포트 유형 선택, 기간 선택 DateRangePicker, 서버 선택, 생성·다운로드) |
| **8** | 백엔드 | 전역 설정 API (수집 주기/보존 기간/임계치 기본값 등), 감사 로그 API |
| | 백엔드 | Webhook 발송 모듈 (Slack/Teams/Webex — 연동 키 미입력 시 비활성), JWT 인증 (로그인/로그아웃/토큰 갱신) |
| | 프론트엔드 | 설정 페이지 전체 (수집 설정, 보존 정책, 임계치 기본값, 외부 연동, 사용자 관리), 감사 로그 뷰어 |
| **9** | 백엔드 | 서버 비교 API (2~4대 동일 시간대 메트릭), AI 이상탐지 (Isolation Forest), 용량 예측 (LinearRegression) |
| | 프론트엔드 | 서버 비교 페이지 (서버 선택 → 오버레이 차트), 이상탐지 배지, 디스크 예측선 표시 |
| | 프론트엔드 | 다크 모드 토글, 대시보드 자동 순환 (키오스크 모드), 로그인 페이지 |

**Phase 3 완료 기준**: 엑셀 리포트 생성·다운로드, 설정 변경 즉시 반영, 감사 로그 기록, AI 이상탐지 배지 표시

#### Phase 4 — 데스크톱 패키징

| 순서 | 영역 | 작업 내용 |
|------|------|----------|
| **10** | 데스크톱 | 시스템 트레이 (pystray): 아이콘 상태 표시 (🟢정상/🟡경고/🔴위험), 우클릭 메뉴 (대시보드 열기/수집 일시정지/종료) |
| | 데스크톱 | 백엔드 + 프론트엔드 통합 실행 스크립트, 자동 브라우저 오픈 |
| **11** | 패키징 | PyInstaller로 단일 실행 파일 빌드 (`ServerEye.exe`), Inno Setup 설치 프로그램 제작 |
| | 패키징 | 초기 설정 위자드 (관리자 계정 생성 → 첫 서버 등록 → 접속 테스트), Windows 시작 프로그램 등록 옵션 |

**Phase 4 완료 기준**: `ServerEyeSetup.exe` 더블클릭 → 설치 → 트레이 아이콘 → 브라우저 대시보드 자동 오픈

---

### Step 2: 설계서 대비 구현 검증

본 설계서의 **모든 섹션을 하나씩 대조**하며 누락·불일치 항목을 점검한다.

| 검증 항목 | 체크 내용 | 확인 방법 |
|-----------|----------|----------|
| **DB 스키마** (§3) | 전 테이블·컬럼·인덱스가 실제 DB와 일치하는가 | `sqlite3 servereye.db ".schema"` 출력과 설계서 비교 |
| **수집 항목** (§4) | CPU/MEM/DISK/NET/프로세스/서비스/로그 전 항목이 수집되는가 | 실제 서버 1대 연결 후 `metrics_raw` 레코드 컬럼 확인 |
| **API 엔드포인트** (§6) | 전체 엔드포인트가 Swagger UI에 표시되는가 | `/docs` 접속 → 설계서 §6 표와 1:1 대조 |
| **WebSocket** (§7) | 메시지 타입·페이로드가 설계서와 일치하는가 | 브라우저 DevTools Network WS 탭에서 메시지 확인 |
| **대시보드 UI** (§8) | InfraSummary 4개 카드, ServerCard, 필터바, 알림 패널 | 화면 캡처 → 설계서 와이어프레임과 비교 |
| **서버 상세 탭** (§9) | 7개 탭 전부 진입·데이터 표시 | 각 탭 클릭 → 차트·테이블 렌더링 확인 |
| **알림 시스템** (§10) | 임계치 초과 → 알림 생성 → 자동 해제 흐름 | CPU 부하 발생 → 알림 패널 표시 → 부하 해제 → Resolved 확인 |
| **서버 관리** (§11) | 등록/수정/삭제/그룹 관리/일괄 작업 | 서버 3대 등록 → 정보 수정 → 1대 삭제 → 그룹 변경 |
| **설정 페이지** (§12) | 수집 주기/보존 기간/임계치/연동 설정 변경 즉시 반영 | 수집 주기 10초로 변경 → 실제 수집 간격 확인 |
| **리포트** (§13) | 기간 선택 → 엑셀 생성 → 다운로드 → 파일 열기 | 7일 리포트 생성 → 엑셀 시트별 데이터 확인 |
| **디자인 가이드** (§14) | 컬러·타이포·간격·컴포넌트가 가이드와 일치하는가 | 전 페이지 스크린샷 → 가이드 대조 |
| **Git 가이드** (§15) | 커밋 메시지 컨벤션 준수, AI 관련 언급 없음 | `git log --oneline -50` 출력 검토 |
| **데스크톱 패키징** | 설치 → 실행 → 트레이 → 대시보드 오픈 | 클린 Windows PC에서 설치 프로그램 실행 |

**산출물**: 검증 체크리스트 (Excel) — 항목별 ✅통과 / ❌미통과 / 비고

---

### Step 3: 기능 테스트 및 버그 수정

#### 3-1. 기능 테스트 시나리오

| # | 시나리오 | 테스트 절차 | 기대 결과 |
|---|---------|-----------|----------|
| F-01 | 서버 등록 | 서버 관리 → 신규 등록 → 접속 테스트 → 저장 | 서버 목록에 추가, 수집 즉시 시작 |
| F-02 | 서버 수정 | 서버 선택 → IP 변경 → 접속 테스트 → 저장 | 변경된 IP로 수집 전환 |
| F-03 | 서버 삭제 | 서버 선택 → 삭제 → 확인 | 목록 제거, 수집 중지, 관련 데이터 보존(설정 가능) |
| F-04 | 실시간 모니터링 | 대시보드 접속 → 30초 관찰 | 서버 카드 메트릭이 3초마다 갱신 |
| F-05 | 알림 발생 | 테스트 서버 CPU 부하 발생 → 대시보드 관찰 | 알림 패널에 Warning/Critical 알림 표시, 알림음 |
| F-06 | 알림 확인 | 활성 알림 → Acknowledge 클릭 | 상태 변경, 확인자·시간 기록 |
| F-07 | 알림 자동 해제 | CPU 부하 해제 → 대시보드 관찰 | 알림 상태 Resolved로 자동 전환 |
| F-08 | 임계치 변경 | 설정 → CPU Critical 50%로 변경 → 저장 | 즉시 반영, 50% 초과 시 알림 발생 |
| F-09 | 서버 상세 탭 전환 | 서버 클릭 → 7개 탭 순차 진입 | 각 탭 데이터·차트 정상 렌더링, 로딩 없이 전환 |
| F-10 | 로그 실시간 | 서버 상세 → 로그 탭 → 로그 발생 | 실시간 스트리밍, 레벨 필터 동작 |
| F-11 | 헬스체크 수동 | 서버 상세 → 헬스체크 → "지금 체크" | 즉시 실행, 결과(성공/실패/응답시간) 표시 |
| F-12 | 엑셀 리포트 | 리포트 → 기간 7일 → 서버 전체 → 생성 | .xlsx 다운로드, 시트별 데이터 정확 |
| F-13 | 필터 조합 | 대시보드 → 그룹 "WEB" + 상태 "Warning" | 해당 조건 서버만 표시 |
| F-14 | 다크 모드 | 설정 → 다크 모드 ON | 전 페이지 다크 테마 적용, 차트 색상 유지 |
| F-15 | 연동 설정 | 설정 → Slack Webhook URL 입력 → 테스트 | 테스트 메시지 발송 성공 확인 |
| F-16 | 30대 서버 동시 | 30대 서버 등록 → 대시보드 | 카드 전체 표시, WebSocket 끊김 없음, 3초 갱신 유지 |
| F-17 | 데스크톱 설치 | `ServerEyeSetup.exe` 실행 → 설치 완료 | 트레이 아이콘 표시, 브라우저 자동 오픈 |
| F-18 | 키오스크 모드 | 대시보드 → 전체화면 → 자동 순환 ON | 서버별 상세 자동 전환, ESC로 해제 |

#### 3-2. 비기능 테스트

| # | 항목 | 테스트 방법 | 기준 |
|---|------|-----------|------|
| NF-01 | 응답 시간 | API 응답 시간 측정 (30대 서버 기준) | 95% 요청 < 200ms |
| NF-02 | WebSocket 안정성 | 24시간 연속 접속 | 끊김 0회 (자동 재연결 포함) |
| NF-03 | 메모리 사용량 | 30대 서버 24시간 운영 후 프로세스 메모리 | < 500MB |
| NF-04 | SQLite 용량 | 30대 서버 30일 운영 후 DB 파일 크기 | < 200MB |
| NF-05 | 동시 브라우저 | 3개 브라우저 탭 동시 접속 | 전부 실시간 갱신 정상 |
| NF-06 | 브라우저 호환 | Chrome/Edge/Firefox 최신 버전 | 레이아웃·기능 정상 |

#### 3-3. 버그 수정

- 테스트 중 발견된 버그는 **즉시 GitHub Issue** 등록 (라벨: `bug`, 심각도: `critical`/`major`/`minor`)
- Critical: 발견 즉시 수정, Major: 당일 내 수정, Minor: Step 3 종료 전 수정
- 수정 후 해당 테스트 시나리오 **재실행하여 확인**

---

### Step 4: 패키징 및 설치 프로그램 최종 확인

| 작업 | 상세 |
|------|------|
| **PyInstaller 최종 빌드** | `--onedir` 모드, 리소스(DB 초기파일, 프론트엔드 빌드, 아이콘) 포함 확인 |
| **Inno Setup 설치 프로그램** | 설치 경로 선택, 바탕화면 바로가기, 시작 프로그램 등록 옵션, 라이선스 표시 |
| **클린 PC 테스트** | Python/Node 미설치 Windows 10/11 PC에서 설치 → 실행 → 서버 등록 → 모니터링 확인 |
| **업데이트 시나리오** | 기존 설치 위에 재설치 → DB 보존 확인, 설정 유지 확인 |
| **제거 테스트** | 프로그램 제거 → 잔여 파일 확인 (DB/설정은 선택적 보존) |

---

### Step 5: 최종 검토 및 문서화

| 작업 | 산출물 |
|------|--------|
| **사용자 매뉴얼** | `docs/user-guide.md` — 설치, 초기 설정, 서버 등록, 대시보드 사용법, 알림 관리, 리포트, 설정 (스크린샷 포함) |
| **운영 가이드** | `docs/admin-guide.md` — 임계치 튜닝 가이드, 데이터 백업/복구, 트러블슈팅 FAQ, 로그 확인 방법 |
| **API 문서** | FastAPI Swagger 자동 생성 (`/docs`) + `docs/api-reference.md` 보충 설명 |
| **CHANGELOG** | `CHANGELOG.md` — 버전별 변경 이력 |
| **최종 코드 리뷰** | 전체 코드 Lint(ruff/eslint) 통과, 미사용 코드 제거, 주석 정리 |
| **릴리스 태깅** | `git tag v1.0.0` → 최종 릴리스 |

---

### 전체 순서 요약

| 단계 | 내용 |
|------|------|
| **Step 1** | 개발 (Phase 1~4, 총 11단계 순차 진행) |
| **Step 2** | 설계서 전 섹션 대비 구현 검증 |
| **Step 3** | 기능·비기능 테스트 및 버그 수정 |
| **Step 4** | 패키징 및 설치 프로그램 최종 확인 |
| **Step 5** | 최종 검토 및 문서화, 릴리스 |

---

## 17. 로고 및 아이콘 적용

ServerEye의 브랜드 아이덴티티에 부합하는 로고 및 아이콘을 제작하여, 아래 모든 영역에 일괄 적용한다.

| 적용 영역 | 규격 | 비고 |
|-----------|------|------|
| **브라우저 파비콘** | 16×16 / 32×32 / 48×48 (favicon.ico) | 멀티 사이즈 ICO 파일 |
| **브라우저 탭 타이틀바** | 페이지 제목 좌측 아이콘 | `<link rel="icon">` 적용 |
| **데스크톱 실행 파일** | 256×256 (ServerEye.exe) | 탐색기·작업 표시줄 표시용 |
| **시스템 트레이** | 16×16 / 32×32 | 상태별 컬러 변형 포함 (정상/경고/위험) |
| **Windows 설치 프로그램** | 설치 위자드 헤더 / 바탕화면 바로가기 | Inno Setup 리소스 |
| **로그인 페이지** | 중앙 로고 | SVG 원본 사용 |
| **사이드바 상단** | 좌측 내비게이션 상단 고정 | SVG, 축소 시 아이콘만 표시 |

- 로고 원본은 **SVG**로 제작하고, 각 규격별 PNG/ICO를 파생한다.
- 디자인 가이드(§14)의 포인트 컬러 및 톤을 준수한다.

---

## 부록 A: 수집 성능 추정

| 항목 | 값 |
|------|------|
| 서버 1대 WinRM 수집 (메트릭) | ~0.5~1초 |
| 서버 1대 SSH 수집 (메트릭) | ~0.3~0.5초 |
| 30대 동시 수집 (asyncio) | ~1~2초 (병렬) |
| 3초 주기 충족 여부 | ✅ 충분 |
| SQLite INSERT/sec | ~5,000~10,000 (WAL 모드) |
| 30대 × 1 row / 3초 = 10 row/sec | ✅ 충분 |

---
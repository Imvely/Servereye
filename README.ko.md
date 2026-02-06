# ServerEye

**Windows & Linux 에이전트리스 서버 모니터링**

ServerEye는 대상 서버에 별도의 에이전트를 설치하지 않고 Windows(WinRM)와 Linux(SSH)를 원격으로 모니터링하는 데스크톱 애플리케이션입니다. 20~30대 규모의 중소 인프라에 최적화되어 있으며, 시스템 트레이 아이콘과 모던 웹 UI를 제공합니다.

> [English README](README.md)

---

## 스크린샷

> _추후 추가 예정_

---

## 주요 기능

- **에이전트리스 모니터링** -- 대상 서버에 소프트웨어 설치 불필요, WinRM(Windows) / SSH(Linux) 사용
- **실시간 대시보드** -- WebSocket 기반 CPU, 메모리, 디스크 실시간 현황 카드
- **상세 서버 메트릭** -- CPU, 메모리, 디스크, 네트워크, 프로세스, 서비스, 이벤트 로그
- **카드/테이블 뷰** -- 시각적 카드 뷰와 데이터 밀도 높은 테이블 뷰 전환
- **그룹 & 태그 관리** -- 서버를 그룹별/태그별로 분류
- **알림 시스템** -- 임계치 기반 알림, 지속시간·쿨다운 설정 가능
- **웹훅 알림** -- Slack, Microsoft Teams, Webex로 알림 전송
- **헬스체크** -- PING, TCP, HTTP 가용성 점검
- **엑셀 리포트** -- 기간별 모니터링 보고서 자동 생성 및 다운로드
- **사용자 관리** -- 역할 기반 접근 제어 (Admin, Operator, Viewer)
- **유지보수 모드** -- 예정된 작업 시간 동안 알림 억제
- **다크 모드** -- 라이트/다크 테마 전환
- **시스템 트레이** -- 백그라운드 실행, 상태별 색상 트레이 아이콘
- **데이터 집계** -- 5분/1시간 단위 자동 집계, 보존 기간 설정 가능

---

## 기술 스택

### 백엔드

| 기술 | 버전 | 용도 |
|---|---|---|
| Python | 3.11+ | 런타임 |
| FastAPI | 0.110 | REST API & WebSocket 서버 |
| SQLAlchemy | 2.0 | 비동기 ORM |
| SQLite (aiosqlite) | - | 임베디드 데이터베이스 |
| Paramiko | 3.4 | SSH 클라이언트 (Linux) |
| pywinrm | 0.4 | WinRM 클라이언트 (Windows) |
| APScheduler | 3.10 | 백그라운드 작업 스케줄링 |
| openpyxl | 3.1 | 엑셀 리포트 생성 |
| scikit-learn | 1.5 | 이상 탐지 (AI) |
| pystray | 0.19 | 시스템 트레이 연동 |
| python-jose | 3.3 | JWT 인증 |
| passlib | 1.7 | 비밀번호 해시 |
| httpx | 0.27 | 비동기 HTTP 클라이언트 |

### 프론트엔드

| 기술 | 버전 | 용도 |
|---|---|---|
| React | 19 | UI 프레임워크 |
| TypeScript | 5.9 | 타입 안전 JavaScript |
| Vite | 7.2 | 빌드 도구 & 개발 서버 |
| Tailwind CSS | v4 | 유틸리티 CSS 프레임워크 |
| Recharts | 3.7 | 차트 컴포넌트 |
| TanStack Query | 5.x | 서버 상태 관리 |
| Zustand | 5.0 | 클라이언트 상태 관리 |
| AG Grid | 35.x | 데이터 그리드 |
| React Router | 6.x | 클라이언트 라우팅 |
| Axios | 1.x | HTTP 클라이언트 |
| Lucide React | - | 아이콘 라이브러리 |
| Headless UI | 2.x | 접근성 UI 프리미티브 |

---

## 빠른 시작

### 사전 요구사항

- **Python 3.11+** (PATH에 등록)
- **Node.js 18+** 및 npm

### 1. 저장소 클론

```bash
git clone <저장소-URL>
cd server-monitoring
```

### 2. 백엔드 의존성 설치

```bash
# 가상환경 생성 (권장)
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS

# 패키지 설치
pip install -r requirements.txt
```

### 3. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. 서버 실행

```bash
python -m backend.main
```

브라우저가 자동으로 `http://localhost:52800` 을 엽니다.

### 5. 기본 로그인 정보

| 항목 | 값 |
|------|------|
| 아이디 | `admin` |
| 비밀번호 | `admin` |

> 첫 로그인 후 반드시 비밀번호를 변경하세요.

---

## 프로젝트 구조

```
server-monitoring/
├── backend/                    # Python 백엔드 (FastAPI)
│   ├── main.py                 # 애플리케이션 진입점
│   ├── config.py               # 설정 및 경로 관리
│   ├── run.py                  # 통합 런처 (트레이 + 서버)
│   ├── tray.py                 # 시스템 트레이 아이콘
│   ├── api/                    # API 라우트 핸들러
│   │   ├── auth.py             # 인증 (JWT)
│   │   ├── servers.py          # 서버 CRUD & 연결 테스트
│   │   ├── dashboard.py        # 대시보드 데이터 집계
│   │   ├── metrics.py          # 메트릭 조회
│   │   ├── alerts.py           # 알림 이력
│   │   ├── alert_rules.py      # 알림 규칙 관리
│   │   ├── health_checks.py    # 헬스체크 설정 & 결과
│   │   ├── reports.py          # 리포트 생성 & 다운로드
│   │   ├── settings.py         # 앱 설정
│   │   ├── users.py            # 사용자 관리
│   │   └── websocket.py        # WebSocket 실시간 업데이트
│   ├── core/                   # 핵심 비즈니스 로직
│   │   ├── collector.py        # 메트릭 수집 엔진
│   │   ├── collector_ssh.py    # SSH 수집기 (Linux)
│   │   ├── collector_winrm.py  # WinRM 수집기 (Windows)
│   │   ├── connection_pool.py  # 연결 풀 관리
│   │   ├── alert_engine.py     # 알림 평가 엔진
│   │   ├── notifier.py         # 웹훅 알림 발송
│   │   ├── health_checker.py   # 헬스체크 실행기
│   │   ├── aggregator.py       # 메트릭 데이터 집계
│   │   ├── anomaly.py          # 이상 탐지 (ML)
│   │   ├── report_gen.py       # 엑셀 리포트 생성기
│   │   ├── ws_manager.py       # WebSocket 연결 관리
│   │   └── crypto.py           # AES 자격증명 암호화
│   ├── db/                     # 데이터베이스 계층
│   │   ├── database.py         # 비동기 SQLAlchemy 엔진
│   │   ├── models.py           # ORM 모델 (13개 테이블)
│   │   ├── schemas.py          # Pydantic 스키마
│   │   └── init_db.py          # DB 초기화 & 시드 데이터
│   └── scheduler/              # 백그라운드 작업
│       └── jobs.py             # APScheduler 작업 정의
├── frontend/                   # React 프론트엔드
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx            # React 진입점
│       ├── App.tsx             # 루트 컴포넌트 & 라우팅
│       ├── api/                # API 계층
│       │   ├── client.ts       # Axios 인스턴스
│       │   ├── websocket.ts    # WebSocket 클라이언트
│       │   └── hooks/          # TanStack Query 훅 (7개)
│       ├── components/         # 재사용 컴포넌트
│       │   ├── charts/         # 차트 (Recharts)
│       │   ├── common/         # 공통 컴포넌트
│       │   ├── dashboard/      # 대시보드 전용
│       │   ├── layout/         # 레이아웃 (Header, Sidebar)
│       │   ├── server-detail/  # 서버 상세 탭
│       │   └── ui/             # 기본 UI 컴포넌트 (10개)
│       ├── pages/              # 페이지 (9개)
│       ├── stores/             # Zustand 상태 스토어
│       ├── types/              # TypeScript 타입
│       └── utils/              # 유틸리티 함수
├── data/                       # 런타임 데이터 (자동 생성)
│   ├── servereye.db            # SQLite 데이터베이스
│   ├── servereye.log           # 애플리케이션 로그
│   └── reports/                # 생성된 엑셀 리포트
├── docs/
│   └── user-guide.md           # 사용자 가이드
├── servereye.spec              # PyInstaller 빌드 스펙
├── installer.iss               # Inno Setup 설치 스크립트
├── requirements.txt            # Python 의존성
├── README.md                   # English README
└── README.ko.md                # 이 파일
```

---

## 개발 환경 설정

### 백엔드

```bash
# 가상환경 생성 및 활성화
python -m venv venv
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 백엔드 실행
python -m backend.main
```

백엔드는 `http://localhost:52800`에서 시작되며, `frontend/dist/` 폴더가 있으면 프론트엔드도 함께 서빙합니다.

### 프론트엔드

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 (HMR)
npm run dev

# 프로덕션 빌드
npm run build

# 타입 체크
npx tsc --noEmit
```

개발 서버는 `http://localhost:5173`에서 실행되며, API 요청은 백엔드로 프록시됩니다.

---

## 빌드 & 패키징

### 프론트엔드 프로덕션 빌드

```bash
cd frontend
npm run build
```

빌드 결과물은 `frontend/dist/`에 생성되며 FastAPI 백엔드가 자동으로 서빙합니다.

### 데스크톱 앱 패키징

```bash
# 1. 프론트엔드 빌드
cd frontend && npm run build && cd ..

# 2. PyInstaller로 exe 생성
pip install pyinstaller
pyinstaller servereye.spec

# 3. Inno Setup으로 설치 프로그램 생성
iscc installer.iss
```

생성된 `ServerEye_Setup_v1.0.0.exe`를 배포합니다.

### 실행 옵션

```bash
python -m backend.main [옵션]

옵션:
  --port=PORT       서버 포트 설정 (기본값: 52800)
  --minimized       브라우저 자동 열기 없이 시작
```

---

## 다른 PC에서 실행하기

아래 가이드를 따라 다른 컴퓨터에서도 ServerEye를 실행할 수 있습니다.

### 사전 준비

1. **Python 3.11 이상** 설치 -- [python.org](https://www.python.org/downloads/)
   - 설치 시 **"Add Python to PATH"** 반드시 체크
2. **Node.js 18 이상** 설치 -- [nodejs.org](https://nodejs.org/)
3. **Git** 설치 -- [git-scm.com](https://git-scm.com/)

### 단계별 설치

```bash
# 1. 프로젝트 클론
git clone <저장소-URL>
cd server-monitoring

# 2. Python 가상환경 생성 및 활성화
python -m venv venv
venv\Scripts\activate

# 3. 백엔드 의존성 설치
pip install -r requirements.txt

# 4. 프론트엔드 빌드
cd frontend
npm install
npm run build
cd ..

# 5. 서버 실행
python -m backend.main
```

### 확인 사항

| 항목 | 확인 방법 |
|------|----------|
| 서버 실행 확인 | 브라우저에서 `http://localhost:52800` 접속 |
| 로그인 | ID: `admin` / PW: `admin` |
| DB 파일 위치 | `data/servereye.db` (자동 생성) |
| 로그 파일 위치 | `data/servereye.log` |
| 리포트 저장 위치 | `data/reports/` |

### 문제 해결

| 증상 | 원인 및 해결 |
|------|-------------|
| `pip install` 실패 | Python 3.11+ 확인. `python --version`으로 확인 |
| `npm run build` 실패 | Node.js 18+ 확인. `node --version`으로 확인 |
| 포트 충돌 (52800) | `python -m backend.main --port=8080` 으로 변경 |
| DB 초기화 오류 | `data/servereye.db` 삭제 후 재시작 (자동 재생성) |
| 페이지 로드 안됨 | `frontend/dist/` 존재 확인. 없으면 `cd frontend && npm run build` |

---

## 라이선스

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.

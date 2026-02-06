# ServerEye 개발 진행 현황

## Phase 1 — 기반 구축 및 핵심 수집 ✅

### 완료된 작업

#### 프로젝트 셋업
- [x] Git 저장소 초기화, 모노레포 구조 생성 (`/backend`, `/frontend`)
- [x] `.gitignore`, `requirements.txt` 작성

#### 백엔드
- [x] FastAPI 프로젝트 골격 생성 (main.py, config.py)
- [x] SQLAlchemy 2.0 + aiosqlite 연동 (database.py)
- [x] 전체 DB 스키마 생성 (models.py) — 13개 테이블
- [x] Pydantic 스키마 정의 (schemas.py) — 전체 요청/응답 모델
- [x] DB 초기화 + 시드 데이터 (init_db.py)
- [x] AES-256 암호화 모듈 (crypto.py)
- [x] WebSocket 매니저 (ws_manager.py)
- [x] 연결 풀 관리 (connection_pool.py)
- [x] WinRM 수집 모듈 (collector_winrm.py)
- [x] SSH 수집 모듈 (collector_ssh.py)
- [x] 비동기 수집 엔진 (collector.py)
- [x] 알림 엔진 (alert_engine.py)
- [x] 알림 발송 모듈 — Slack/Teams/Webex (notifier.py)
- [x] 데이터 집계/정리 (aggregator.py)
- [x] 헬스체크 엔진 (health_checker.py)
- [x] 엑셀 리포트 생성 (report_gen.py)
- [x] AI 이상탐지/예측 (anomaly.py)
- [x] 전체 API 라우터 구현 (11개)
- [x] 스케줄러 설정 (scheduler/jobs.py)

#### 프론트엔드
- [x] React 18 + TypeScript + Vite 프로젝트 생성
- [x] Tailwind CSS v4 설정, 커스텀 테마
- [x] 라우터 구성 (App.tsx, 9개 라우트)
- [x] Axios API 클라이언트 + JWT 인터셉터
- [x] WebSocket 커스텀 훅
- [x] Zustand 스토어 3개 (auth, dashboard, settings)
- [x] TanStack Query 훅 7개
- [x] UI 컴포넌트 10개 (Button, Badge, Card, Input, Select, Modal, Toggle, Tabs, Toast, DateRangePicker)
- [x] 공통 컴포넌트 5개 (StatusBadge, TimeRangeSelector, ExportButton, ConfirmDialog, EmptyState)
- [x] 레이아웃 컴포넌트 3개 (Layout, Header, Sidebar)
- [x] 차트 컴포넌트 4개 (RealtimeChart, MiniGauge, SparkLine, DiskBar)
- [x] 대시보드 컴포넌트 4개 (InfraSummaryCards, ServerCard, AlertPanel, FilterBar)
- [x] 서버 상세 탭 컴포넌트 5개 (MetricTab, ProcessTab, ServiceTab, LogTab, AlertTab)
- [x] 전체 페이지 9개 (Login, Dashboard, ServerList, ServerDetail, Alerts, AlertRules, Reports, Settings, Users)
- [x] TypeScript 빌드 성공 (0 errors)

### 테스트 결과
- [x] Python 전체 파일 구문 검사 통과
- [x] TypeScript 타입 체크 통과
- [x] Vite 프로덕션 빌드 성공

---

## Phase 2 — 상세 모니터링 및 알림 ⏳

### 남은 작업
- [ ] 서버 상세 메트릭 API 보강 (탭별 최적화)
- [ ] 프로세스/서비스 목록 API 세부 구현
- [ ] 알림 실시간 패널 WebSocket 연동
- [ ] 임계치 설정 서버별 오버라이드
- [ ] 로그 WebSocket 스트리밍
- [ ] 헬스체크 수동 실행 API 연동

## Phase 3 — 운영 도구 및 리포트 ⏳

## Phase 4 — 데스크톱 패키징 ⏳

---

## 발견된 이슈
- 없음

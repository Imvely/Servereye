"""ServerEye 시스템 트레이 아이콘 (pystray + PIL)"""
import logging
import os
import subprocess
import sys
import threading
import time
import webbrowser
from typing import Optional

import pystray
from PIL import Image, ImageDraw

from backend.config import DEFAULT_PORT, DATA_DIR, LOG_PATH, REPORTS_DIR

logger = logging.getLogger(__name__)

# 트레이 아이콘 상태 상수
STATE_NORMAL = "normal"       # 초록 — 모든 서버 정상
STATE_WARNING = "warning"     # 노랑 — 1+ Warning
STATE_CRITICAL = "critical"   # 빨강 — 1+ Critical
STATE_PAUSED = "paused"       # 회색 — 수집 일시 중지

# 상태별 색상 (border, fill)
_STATE_COLORS = {
    STATE_NORMAL:   {"border": "#22c55e", "fill": "#166534"},   # 초록
    STATE_WARNING:  {"border": "#eab308", "fill": "#854d0e"},   # 노랑
    STATE_CRITICAL: {"border": "#ef4444", "fill": "#991b1b"},   # 빨강
    STATE_PAUSED:   {"border": "#9ca3af", "fill": "#4b5563"},   # 회색
}


def _create_icon_image(state: str, size: int = 30) -> Image.Image:
    """상태에 따른 트레이 아이콘 이미지 생성 (원형)"""
    colors = _STATE_COLORS.get(state, _STATE_COLORS[STATE_NORMAL])
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 외곽 원 (border)
    draw.ellipse([1, 1, size - 2, size - 2], fill=colors["border"])
    # 내부 원 (fill) — 약간 안쪽
    inner_margin = max(4, size // 6)
    draw.ellipse(
        [inner_margin, inner_margin, size - 1 - inner_margin, size - 1 - inner_margin],
        fill=colors["fill"],
    )
    # 중앙에 "S" 글자 표시 (작은 흰 점으로 대체하여 심플하게)
    center = size // 2
    dot_r = max(2, size // 10)
    draw.ellipse(
        [center - dot_r, center - dot_r, center + dot_r, center + dot_r],
        fill="white",
    )
    return img


class ServerEyeTray:
    """시스템 트레이 아이콘 관리"""

    def __init__(self, port: int = DEFAULT_PORT):
        self.port = port
        self._base_url = f"http://localhost:{self.port}"
        self._state = STATE_NORMAL
        self._paused = False
        self._active_alert_count = 0
        self._icon: Optional[pystray.Icon] = None
        self._stop_event = threading.Event()
        self._status_thread: Optional[threading.Thread] = None
        # 외부에서 주입할 콜백
        self.on_restart_collection = None   # callable
        self.on_toggle_pause = None         # callable -> bool (새 paused 상태)
        self.on_exit = None                 # callable

    # ------------------------------------------------------------------
    # 아이콘 생성 / 시작 / 종료
    # ------------------------------------------------------------------

    def start(self):
        """트레이 아이콘을 현재 스레드에서 실행 (blocking)"""
        logger.info("Starting system tray icon...")
        self._icon = pystray.Icon(
            name="ServerEye",
            icon=_create_icon_image(self._state),
            title=self._build_tooltip(),
            menu=self._build_menu(),
        )
        # 더블클릭 기본 동작
        self._icon.default_action = self._on_open_dashboard

        # 상태 폴링 스레드 시작
        self._stop_event.clear()
        self._status_thread = threading.Thread(
            target=self._status_poll_loop, daemon=True
        )
        self._status_thread.start()

        self._icon.run()

    def stop(self):
        """트레이 아이콘 종료"""
        self._stop_event.set()
        if self._icon:
            try:
                self._icon.stop()
            except Exception:
                pass
        logger.info("System tray icon stopped.")

    # ------------------------------------------------------------------
    # 상태 갱신
    # ------------------------------------------------------------------

    def update_state(self, state: str, alert_count: int = 0):
        """외부에서 트레이 상태를 갱신"""
        self._state = state
        self._active_alert_count = alert_count
        if self._icon:
            self._icon.icon = _create_icon_image(state)
            self._icon.title = self._build_tooltip()
            # 메뉴 재생성 (알림 카운트 반영)
            self._icon.menu = self._build_menu()

    def _build_tooltip(self) -> str:
        labels = {
            STATE_NORMAL: "ServerEye — 정상",
            STATE_WARNING: f"ServerEye — 경고 {self._active_alert_count}건",
            STATE_CRITICAL: f"ServerEye — 위험 {self._active_alert_count}건",
            STATE_PAUSED: "ServerEye — 수집 일시 중지",
        }
        return labels.get(self._state, "ServerEye")

    # ------------------------------------------------------------------
    # 컨텍스트 메뉴
    # ------------------------------------------------------------------

    def _build_menu(self) -> pystray.Menu:
        pause_label = "\u23f8\ufe0f 수집 일시 중지" if not self._paused else "\u25b6\ufe0f 수집 재개"
        alert_label = f"\U0001f514 알림 ({self._active_alert_count})"

        return pystray.Menu(
            pystray.MenuItem("\U0001f4ca 대시보드 열기", self._on_open_dashboard, default=True),
            pystray.MenuItem("\u2699\ufe0f 설정", self._on_open_settings),
            pystray.MenuItem("\U0001f4cb 서버 관리", self._on_open_servers),
            pystray.MenuItem(alert_label, self._on_open_alerts),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("\U0001f4ca 리포트 생성", self._on_open_reports),
            pystray.MenuItem("\U0001f4c1 데이터 폴더 열기", self._on_open_data_dir),
            pystray.MenuItem("\U0001f4dd 로그 파일 보기", self._on_open_log),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("\U0001f504 수집 재시작", self._on_restart_collection),
            pystray.MenuItem(pause_label, self._on_toggle_pause),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("\u274c 종료", self._on_exit),
        )

    # ------------------------------------------------------------------
    # 메뉴 액션
    # ------------------------------------------------------------------

    def _on_open_dashboard(self, icon=None, item=None):
        webbrowser.open(self._base_url)

    def _on_open_settings(self, icon=None, item=None):
        webbrowser.open(f"{self._base_url}/settings")

    def _on_open_servers(self, icon=None, item=None):
        webbrowser.open(f"{self._base_url}/servers")

    def _on_open_alerts(self, icon=None, item=None):
        webbrowser.open(f"{self._base_url}/alerts")

    def _on_open_reports(self, icon=None, item=None):
        webbrowser.open(f"{self._base_url}/reports")

    def _on_open_data_dir(self, icon=None, item=None):
        """데이터 폴더를 Windows 탐색기로 열기"""
        data_path = str(DATA_DIR)
        try:
            os.startfile(data_path)
        except AttributeError:
            # os.startfile은 Windows 전용 — 다른 플랫폼 대비
            subprocess.Popen(["explorer", data_path])
        except Exception as e:
            logger.error(f"데이터 폴더 열기 실패: {e}")

    def _on_open_log(self, icon=None, item=None):
        """로그 파일을 기본 텍스트 편집기로 열기"""
        log_path = str(LOG_PATH)
        try:
            os.startfile(log_path)
        except AttributeError:
            subprocess.Popen(["notepad", log_path])
        except Exception as e:
            logger.error(f"로그 파일 열기 실패: {e}")

    def _on_restart_collection(self, icon=None, item=None):
        """수집 재시작 콜백 호출"""
        logger.info("Tray: 수집 재시작 요청")
        if self.on_restart_collection:
            self.on_restart_collection()

    def _on_toggle_pause(self, icon=None, item=None):
        """수집 일시 중지 / 재개 토글"""
        logger.info("Tray: 수집 일시 중지/재개 요청")
        if self.on_toggle_pause:
            self._paused = self.on_toggle_pause()
        else:
            self._paused = not self._paused

        if self._paused:
            self.update_state(STATE_PAUSED, self._active_alert_count)
        else:
            # 일시 중지 해제 시 즉시 상태 체크
            self._check_status()

        # 메뉴 라벨 갱신
        if self._icon:
            self._icon.menu = self._build_menu()

    def _on_exit(self, icon=None, item=None):
        """앱 종료"""
        logger.info("Tray: 종료 요청")
        self.stop()
        if self.on_exit:
            self.on_exit()

    # ------------------------------------------------------------------
    # 주기적 상태 폴링 (별도 스레드)
    # ------------------------------------------------------------------

    def _status_poll_loop(self):
        """10초마다 서버 상태를 확인하여 아이콘 색상 갱신"""
        while not self._stop_event.is_set():
            try:
                if not self._paused:
                    self._check_status()
            except Exception as e:
                logger.debug(f"Tray status check error: {e}")
            self._stop_event.wait(10)

    def _check_status(self):
        """DB에서 활성 알림 조회하여 트레이 상태 결정

        이 메서드는 별도 스레드에서 실행되므로 동기 SQLite 직접 접근을 사용한다.
        (async session은 이벤트 루프 바깥에서 사용할 수 없음)
        """
        import sqlite3
        from backend.config import DB_PATH

        try:
            conn = sqlite3.connect(str(DB_PATH), timeout=5)
            cursor = conn.cursor()

            # 미해결 알림 개수 (severity별)
            cursor.execute(
                "SELECT severity, COUNT(*) FROM alert_history "
                "WHERE resolved_at IS NULL GROUP BY severity"
            )
            rows = cursor.fetchall()
            conn.close()

            critical_count = 0
            warning_count = 0
            for severity, cnt in rows:
                if severity == "critical":
                    critical_count += cnt
                elif severity == "warning":
                    warning_count += cnt

            total = critical_count + warning_count

            if critical_count > 0:
                self.update_state(STATE_CRITICAL, total)
            elif warning_count > 0:
                self.update_state(STATE_WARNING, total)
            else:
                self.update_state(STATE_NORMAL, 0)

        except Exception as e:
            logger.debug(f"Tray DB status check failed: {e}")

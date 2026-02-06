"""Windows WinRM 수집 모듈"""
import json
import logging
from typing import Optional
from backend.core.connection_pool import winrm_pool

logger = logging.getLogger(__name__)

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


def collect_winrm_metrics(server) -> Optional[dict]:
    """WinRM을 통해 Windows 서버 메트릭 수집"""
    try:
        session = winrm_pool.get_session(server)

        result = {}

        # CPU
        try:
            resp = session.run_ps(COMMANDS_WINDOWS["cpu"])
            if resp.status_code == 0:
                result['cpu_usage_pct'] = float(resp.std_out.decode().strip())
        except Exception as e:
            logger.warning(f"WinRM CPU collect error for {server.ip_address}: {e}")

        # Memory
        try:
            resp = session.run_ps(COMMANDS_WINDOWS["memory"])
            if resp.status_code == 0:
                mem_data = json.loads(resp.std_out.decode())
                result['mem_total_mb'] = mem_data.get('total_mb')
                result['mem_used_mb'] = mem_data.get('used_mb')
                result['mem_usage_pct'] = mem_data.get('usage_pct')
        except Exception as e:
            logger.warning(f"WinRM Memory collect error for {server.ip_address}: {e}")

        # Disk
        try:
            resp = session.run_ps(COMMANDS_WINDOWS["disk"])
            if resp.status_code == 0:
                disk_data = resp.std_out.decode().strip()
                result['disk_json'] = disk_data
        except Exception as e:
            logger.warning(f"WinRM Disk collect error for {server.ip_address}: {e}")

        # Network
        try:
            resp = session.run_ps(COMMANDS_WINDOWS["network"])
            if resp.status_code == 0:
                result['net_json'] = resp.std_out.decode().strip()
        except Exception as e:
            logger.warning(f"WinRM Network collect error for {server.ip_address}: {e}")

        # Uptime
        try:
            resp = session.run_ps(COMMANDS_WINDOWS["uptime"])
            if resp.status_code == 0:
                result['uptime_seconds'] = int(float(resp.std_out.decode().strip()))
        except Exception as e:
            logger.warning(f"WinRM Uptime collect error for {server.ip_address}: {e}")

        return result

    except Exception as e:
        logger.error(f"WinRM connection failed for {server.ip_address}: {e}")
        winrm_pool.remove(server.server_id)
        return None


def collect_winrm_processes(server) -> Optional[list]:
    """WinRM을 통해 프로세스 목록 수집"""
    try:
        session = winrm_pool.get_session(server)
        resp = session.run_ps(COMMANDS_WINDOWS["processes"])
        if resp.status_code == 0:
            data = json.loads(resp.std_out.decode())
            if isinstance(data, dict):
                data = [data]
            return data
        return None
    except Exception as e:
        logger.error(f"WinRM process collect error for {server.ip_address}: {e}")
        return None


def collect_winrm_services(server) -> Optional[list]:
    """WinRM을 통해 서비스 목록 수집"""
    try:
        session = winrm_pool.get_session(server)
        resp = session.run_ps(COMMANDS_WINDOWS["services"])
        if resp.status_code == 0:
            data = json.loads(resp.std_out.decode())
            if isinstance(data, dict):
                data = [data]
            return data
        return None
    except Exception as e:
        logger.error(f"WinRM service collect error for {server.ip_address}: {e}")
        return None


def collect_winrm_logs(server) -> Optional[list]:
    """WinRM을 통해 이벤트 로그 수집"""
    try:
        session = winrm_pool.get_session(server)
        resp = session.run_ps(COMMANDS_WINDOWS["event_logs"])
        if resp.status_code == 0:
            data = json.loads(resp.std_out.decode())
            if isinstance(data, dict):
                data = [data]
            return data
        return None
    except Exception as e:
        logger.error(f"WinRM log collect error for {server.ip_address}: {e}")
        return None


def collect_winrm_sysinfo(server) -> Optional[dict]:
    """WinRM을 통해 시스템 정보 수집"""
    try:
        session = winrm_pool.get_session(server)
        resp = session.run_ps(COMMANDS_WINDOWS["sysinfo"])
        if resp.status_code == 0:
            return json.loads(resp.std_out.decode())
        return None
    except Exception as e:
        logger.error(f"WinRM sysinfo collect error for {server.ip_address}: {e}")
        return None


def test_winrm_connection(ip: str, port: int, user: str, password: str, use_ssl: bool = False) -> dict:
    """WinRM 접속 테스트"""
    try:
        import winrm
        protocol = "https" if use_ssl else "http"
        session = winrm.Session(
            f"{protocol}://{ip}:{port}/wsman",
            auth=(user, password),
            transport='ntlm',
            read_timeout_sec=10,
            operation_timeout_sec=8
        )
        resp = session.run_ps("$env:COMPUTERNAME")
        if resp.status_code == 0:
            hostname = resp.std_out.decode().strip()
            return {"success": True, "message": f"연결 성공 (호스트: {hostname})"}
        return {"success": False, "message": f"명령 실행 실패: {resp.std_err.decode()}"}
    except Exception as e:
        return {"success": False, "message": f"연결 실패: {str(e)}"}

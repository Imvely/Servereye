"""Linux SSH 수집 모듈"""
import json
import logging
import re
from typing import Optional
from backend.core.connection_pool import ssh_pool

logger = logging.getLogger(__name__)

COMMANDS_LINUX = {
    "cpu": "top -bn1 | grep 'Cpu(s)' | awk '{print 100-$8}'",
    "loadavg": "cat /proc/loadavg | awk '{print $1,$2,$3}'",
    "memory": "free -m | awk '/Mem:/{printf \"{\\\"total_mb\\\":%s,\\\"used_mb\\\":%s,\\\"free_mb\\\":%s,\\\"usage_pct\\\":%.1f}\", $2,$3,$4,$3/$2*100}'",
    "swap": "free -m | awk '/Swap:/{print $2,$3}'",
    "disk": "df -BG --output=target,size,used,avail,pcent -x tmpfs -x devtmpfs | tail -n+2",
    "disk_io": "cat /proc/diskstats",
    "network": "cat /proc/net/dev | tail -n+3",
    "net_conn": "ss -tun state established | wc -l",
    "processes": "ps aux --sort=-%cpu | head -31 | tail -30",
    "services": "systemctl list-units --type=service --state=running,failed --no-pager --plain",
    "uptime": "cat /proc/uptime | awk '{print int($1)}'",
    "logs": "journalctl --since '30 seconds ago' --no-pager -o json --priority=0..4 2>/dev/null || echo '[]'",
    "sysinfo": "echo $(uname -r) && nproc && free -m | awk '/Mem:/{print $2}' && cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2"
}


def _exec_ssh(server, command: str) -> Optional[str]:
    """SSH 명령 실행"""
    try:
        client = ssh_pool.get_client(server)
        stdin, stdout, stderr = client.exec_command(command, timeout=15)
        output = stdout.read().decode().strip()
        return output
    except Exception as e:
        logger.warning(f"SSH exec error for {server.ip_address}: {e}")
        ssh_pool.remove(server.server_id)
        return None


def collect_ssh_metrics(server) -> Optional[dict]:
    """SSH를 통해 Linux 서버 메트릭 수집"""
    result = {}

    # CPU
    try:
        cpu_out = _exec_ssh(server, COMMANDS_LINUX["cpu"])
        if cpu_out:
            result['cpu_usage_pct'] = float(cpu_out)
    except Exception as e:
        logger.warning(f"SSH CPU error: {e}")

    # Load Average
    try:
        load_out = _exec_ssh(server, COMMANDS_LINUX["loadavg"])
        if load_out:
            parts = load_out.split()
            result['cpu_load_1m'] = float(parts[0])
            result['cpu_load_5m'] = float(parts[1])
            result['cpu_load_15m'] = float(parts[2])
    except Exception as e:
        logger.warning(f"SSH LoadAvg error: {e}")

    # Memory
    try:
        mem_out = _exec_ssh(server, COMMANDS_LINUX["memory"])
        if mem_out:
            mem_data = json.loads(mem_out)
            result['mem_total_mb'] = mem_data.get('total_mb')
            result['mem_used_mb'] = mem_data.get('used_mb')
            result['mem_usage_pct'] = mem_data.get('usage_pct')
    except Exception as e:
        logger.warning(f"SSH Memory error: {e}")

    # Swap
    try:
        swap_out = _exec_ssh(server, COMMANDS_LINUX["swap"])
        if swap_out:
            parts = swap_out.split()
            if len(parts) >= 2:
                result['swap_total_mb'] = int(parts[0])
                result['swap_used_mb'] = int(parts[1])
    except Exception as e:
        logger.warning(f"SSH Swap error: {e}")

    # Disk
    try:
        disk_out = _exec_ssh(server, COMMANDS_LINUX["disk"])
        if disk_out:
            disks = []
            for line in disk_out.strip().split('\n'):
                parts = line.split()
                if len(parts) >= 5:
                    mount = parts[0]
                    total_gb = float(parts[1].replace('G', ''))
                    used_gb = float(parts[2].replace('G', ''))
                    free_gb = float(parts[3].replace('G', ''))
                    usage_pct = float(parts[4].replace('%', ''))
                    disks.append({
                        "mount": mount,
                        "total_gb": total_gb,
                        "used_gb": used_gb,
                        "free_gb": free_gb,
                        "usage_pct": usage_pct
                    })
            result['disk_json'] = json.dumps(disks)
    except Exception as e:
        logger.warning(f"SSH Disk error: {e}")

    # Network connections
    try:
        conn_out = _exec_ssh(server, COMMANDS_LINUX["net_conn"])
        if conn_out:
            result['net_connections'] = int(conn_out)
    except Exception as e:
        logger.warning(f"SSH NetConn error: {e}")

    # Network interfaces
    try:
        net_out = _exec_ssh(server, COMMANDS_LINUX["network"])
        if net_out:
            interfaces = []
            for line in net_out.strip().split('\n'):
                parts = line.split()
                if len(parts) >= 10:
                    iface = parts[0].rstrip(':')
                    recv_bytes = int(parts[1])
                    sent_bytes = int(parts[9])
                    interfaces.append({
                        "iface": iface,
                        "recv_bytes": recv_bytes,
                        "sent_bytes": sent_bytes
                    })
            result['net_json'] = json.dumps(interfaces)
    except Exception as e:
        logger.warning(f"SSH Network error: {e}")

    # Uptime
    try:
        uptime_out = _exec_ssh(server, COMMANDS_LINUX["uptime"])
        if uptime_out:
            result['uptime_seconds'] = int(uptime_out)
    except Exception as e:
        logger.warning(f"SSH Uptime error: {e}")

    # Process count
    try:
        proc_count = _exec_ssh(server, "ps aux | wc -l")
        if proc_count:
            result['process_count'] = int(proc_count) - 1
    except Exception:
        pass

    return result if result else None


def collect_ssh_processes(server) -> Optional[list]:
    """SSH를 통해 프로세스 목록 수집"""
    try:
        output = _exec_ssh(server, COMMANDS_LINUX["processes"])
        if not output:
            return None
        processes = []
        for line in output.strip().split('\n'):
            parts = line.split(None, 10)
            if len(parts) >= 11:
                processes.append({
                    "username": parts[0],
                    "pid": int(parts[1]),
                    "cpu_pct": float(parts[2]),
                    "mem_pct": float(parts[3]),
                    "mem_mb": round(int(parts[5]) / 1024, 1) if parts[5].isdigit() else 0,
                    "status": parts[7],
                    "name": parts[10].split()[0] if parts[10] else "",
                    "command_line": parts[10]
                })
        return processes
    except Exception as e:
        logger.error(f"SSH process collect error: {e}")
        return None


def collect_ssh_services(server) -> Optional[list]:
    """SSH를 통해 서비스 목록 수집"""
    try:
        output = _exec_ssh(server, COMMANDS_LINUX["services"])
        if not output:
            return None
        services = []
        for line in output.strip().split('\n'):
            parts = line.split(None, 4)
            if len(parts) >= 3 and parts[0].endswith('.service'):
                services.append({
                    "service_name": parts[0],
                    "display_name": parts[0].replace('.service', ''),
                    "status": "running" if parts[2] == "running" else parts[2],
                    "start_type": "auto"
                })
        return services
    except Exception as e:
        logger.error(f"SSH service collect error: {e}")
        return None


def collect_ssh_logs(server) -> Optional[list]:
    """SSH를 통해 로그 수집"""
    try:
        output = _exec_ssh(server, COMMANDS_LINUX["logs"])
        if not output or output == '[]':
            return []
        logs = []
        for line in output.strip().split('\n'):
            try:
                entry = json.loads(line)
                priority = int(entry.get('PRIORITY', 6))
                if priority <= 3:
                    level = 'ERROR'
                elif priority <= 4:
                    level = 'WARN'
                else:
                    level = 'INFO'
                logs.append({
                    "log_source": entry.get('SYSLOG_IDENTIFIER', 'syslog'),
                    "log_level": level,
                    "message": entry.get('MESSAGE', ''),
                    "occurred_at": entry.get('__REALTIME_TIMESTAMP', '')
                })
            except (json.JSONDecodeError, KeyError):
                continue
        return logs
    except Exception as e:
        logger.error(f"SSH log collect error: {e}")
        return None


def collect_ssh_sysinfo(server) -> Optional[dict]:
    """SSH를 통해 시스템 정보 수집"""
    try:
        output = _exec_ssh(server, COMMANDS_LINUX["sysinfo"])
        if not output:
            return None
        lines = output.strip().split('\n')
        if len(lines) >= 3:
            return {
                "os_version": f"Linux {lines[0]}",
                "cpu_cores": int(lines[1]),
                "total_memory_mb": int(lines[2]),
                "cpu_model": lines[3].strip() if len(lines) > 3 else ""
            }
        return None
    except Exception as e:
        logger.error(f"SSH sysinfo error: {e}")
        return None


def test_ssh_connection(ip: str, port: int, user: str, password: str, key_path: str = None) -> dict:
    """SSH 접속 테스트"""
    try:
        import paramiko
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        connect_kwargs = {
            "hostname": ip,
            "port": port,
            "username": user,
            "password": password,
            "timeout": 10,
            "allow_agent": False,
            "look_for_keys": False,
        }
        if key_path:
            connect_kwargs["key_filename"] = key_path
        client.connect(**connect_kwargs)
        stdin, stdout, stderr = client.exec_command("hostname")
        hostname = stdout.read().decode().strip()
        client.close()
        return {"success": True, "message": f"연결 성공 (호스트: {hostname})"}
    except Exception as e:
        return {"success": False, "message": f"연결 실패: {str(e)}"}

"""메트릭 및 프로세스/서비스 API 라우터"""
import json
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import MetricLatest

router = APIRouter(prefix="/api/v1/servers", tags=["metrics"])


@router.get("/{server_id}/metrics/latest", response_model=MetricLatest)
async def get_latest_metrics(server_id: int):
    """서버 최신 메트릭 조회"""
    try:
        async with async_session() as session:
            # 서버 존재 여부 확인
            srv = await session.execute(
                text("SELECT server_id FROM servers WHERE server_id=:sid AND is_active=1"),
                {"sid": server_id}
            )
            if not srv.fetchone():
                raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

            result = await session.execute(
                text("""SELECT server_id, collected_at,
                    cpu_usage_pct, cpu_load_1m, cpu_load_5m, cpu_load_15m,
                    mem_total_mb, mem_used_mb, mem_usage_pct,
                    swap_total_mb, swap_used_mb,
                    disk_json, disk_read_mbps, disk_write_mbps,
                    net_json, net_connections, process_count, uptime_seconds
                    FROM metrics_raw
                    WHERE server_id=:sid
                    ORDER BY collected_at DESC LIMIT 1"""),
                {"sid": server_id}
            )
            row = result.fetchone()

        if not row:
            # 메트릭이 없으면 빈 응답
            return MetricLatest(server_id=server_id)

        return MetricLatest(
            server_id=row[0],
            collected_at=row[1],
            cpu_usage_pct=row[2],
            cpu_load_1m=row[3],
            cpu_load_5m=row[4],
            cpu_load_15m=row[5],
            mem_total_mb=row[6],
            mem_used_mb=row[7],
            mem_usage_pct=row[8],
            swap_total_mb=row[9],
            swap_used_mb=row[10],
            disk_json=row[11],
            disk_read_mbps=row[12],
            disk_write_mbps=row[13],
            net_json=row[14],
            net_connections=row[15],
            process_count=row[16],
            uptime_seconds=row[17]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"최신 메트릭 조회 실패: {str(e)}")


@router.get("/{server_id}/metrics/history")
async def get_metrics_history(
    server_id: int,
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    interval: str = Query("5min", description="raw|5min|hourly")
):
    """서버 메트릭 이력 조회"""
    try:
        async with async_session() as session:
            # 서버 존재 여부 확인
            srv = await session.execute(
                text("SELECT server_id FROM servers WHERE server_id=:sid AND is_active=1"),
                {"sid": server_id}
            )
            if not srv.fetchone():
                raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

        if interval not in ("raw", "5min", "hourly"):
            raise HTTPException(status_code=400, detail="interval은 raw, 5min, hourly 중 하나여야 합니다")

        params = {"sid": server_id}
        time_filter = ""
        if date_from:
            time_filter += " AND {time_col} >= :df"
            params["df"] = date_from
        if date_to:
            time_filter += " AND {time_col} <= :dt"
            params["dt"] = date_to

        if interval == "raw":
            time_col = "collected_at"
            query = f"""SELECT collected_at as time,
                cpu_usage_pct as cpu, mem_usage_pct as mem,
                disk_read_mbps as disk_read, disk_write_mbps as disk_write,
                net_connections, process_count
                FROM metrics_raw
                WHERE server_id=:sid {time_filter.format(time_col=time_col)}
                ORDER BY collected_at"""
        elif interval == "5min":
            time_col = "bucket_time"
            query = f"""SELECT bucket_time as time,
                cpu_avg as cpu, cpu_max, cpu_min,
                mem_avg_pct as mem, mem_max_pct,
                disk_read_avg as disk_read, disk_write_avg as disk_write,
                net_in_avg, net_out_avg, sample_count
                FROM metrics_5min
                WHERE server_id=:sid {time_filter.format(time_col=time_col)}
                ORDER BY bucket_time"""
        else:  # hourly
            time_col = "bucket_time"
            query = f"""SELECT bucket_time as time,
                cpu_avg as cpu, cpu_max, cpu_p95,
                mem_avg_pct as mem, mem_max_pct,
                disk_read_avg as disk_read, disk_write_avg as disk_write,
                net_in_avg, net_out_avg,
                alert_count, downtime_sec, sample_count
                FROM metrics_hourly
                WHERE server_id=:sid {time_filter.format(time_col=time_col)}
                ORDER BY bucket_time"""

        async with async_session() as session:
            result = await session.execute(text(query), params)
            rows = result.fetchall()
            columns = result.keys()

        data = []
        for row in rows:
            item = {}
            for idx, col in enumerate(columns):
                item[col] = row[idx]
            data.append(item)

        return {"server_id": server_id, "interval": interval, "count": len(data), "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메트릭 이력 조회 실패: {str(e)}")


@router.get("/{server_id}/processes")
async def get_processes(
    server_id: int,
    sort: str = Query("cpu_pct", description="cpu_pct|mem_mb|mem_pct|name"),
    limit: int = Query(50, ge=1, le=200)
):
    """서버 프로세스 목록 조회"""
    try:
        async with async_session() as session:
            # 서버 존재 여부 확인
            srv = await session.execute(
                text("SELECT server_id FROM servers WHERE server_id=:sid AND is_active=1"),
                {"sid": server_id}
            )
            if not srv.fetchone():
                raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

            allowed_sorts = {"cpu_pct", "mem_mb", "mem_pct", "name", "pid"}
            if sort not in allowed_sorts:
                sort = "cpu_pct"

            order_dir = "DESC" if sort in ("cpu_pct", "mem_mb", "mem_pct") else "ASC"

            result = await session.execute(
                text(f"""SELECT pid, name, username, cpu_pct, mem_mb, mem_pct,
                    thread_count, status, command_line, updated_at
                    FROM process_snapshot
                    WHERE server_id=:sid
                    ORDER BY {sort} {order_dir}
                    LIMIT :lim"""),
                {"sid": server_id, "lim": limit}
            )
            rows = result.fetchall()

        processes = []
        for r in rows:
            processes.append({
                "pid": r[0],
                "name": r[1],
                "username": r[2],
                "cpu_pct": r[3],
                "mem_mb": r[4],
                "mem_pct": r[5],
                "thread_count": r[6],
                "status": r[7],
                "command_line": r[8],
                "updated_at": r[9]
            })

        return {"server_id": server_id, "count": len(processes), "processes": processes}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프로세스 목록 조회 실패: {str(e)}")


@router.get("/{server_id}/services")
async def get_services(
    server_id: int,
    status_filter: str = Query(None, alias="status"),
    search: str = None
):
    """서버 서비스 목록 조회"""
    try:
        async with async_session() as session:
            # 서버 존재 여부 확인
            srv = await session.execute(
                text("SELECT server_id FROM servers WHERE server_id=:sid AND is_active=1"),
                {"sid": server_id}
            )
            if not srv.fetchone():
                raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

            conditions = ["server_id=:sid"]
            params = {"sid": server_id}

            if status_filter:
                conditions.append("status=:st")
                params["st"] = status_filter
            if search:
                conditions.append("(service_name LIKE :search OR display_name LIKE :search)")
                params["search"] = f"%{search}%"

            where = " AND ".join(conditions)

            result = await session.execute(
                text(f"""SELECT service_name, display_name, status, start_type,
                    pid, mem_mb, updated_at
                    FROM service_status
                    WHERE {where}
                    ORDER BY service_name"""),
                params
            )
            rows = result.fetchall()

        services = []
        for r in rows:
            services.append({
                "service_name": r[0],
                "display_name": r[1],
                "status": r[2],
                "start_type": r[3],
                "pid": r[4],
                "mem_mb": r[5],
                "updated_at": r[6]
            })

        return {"server_id": server_id, "count": len(services), "services": services}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서비스 목록 조회 실패: {str(e)}")

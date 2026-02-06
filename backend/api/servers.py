"""서버 관리 API 라우터"""
import json
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import (
    CreateServerRequest, UpdateServerRequest, ServerDetail,
    ServerSummary, ServerListResponse, TestConnectionRequest,
    MaintenanceRequest, MessageResponse
)
from backend.core.crypto import encrypt
from backend.core.collector import collector_engine

router = APIRouter(prefix="/api/v1/servers", tags=["servers"])


@router.get("", response_model=ServerListResponse)
async def list_servers(
    group: str = None,
    status: str = None,
    search: str = None,
    sort: str = "display_name",
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200)
):
    """서버 목록 조회"""
    conditions = ["s.is_active=1"]
    params = {}

    if group:
        conditions.append("s.group_name=:group")
        params["group"] = group
    if status:
        conditions.append("s.status=:status")
        params["status"] = status
    if search:
        conditions.append("(s.display_name LIKE :search OR s.ip_address LIKE :search OR s.hostname LIKE :search)")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)
    offset = (page - 1) * size
    params["limit"] = size
    params["offset"] = offset

    allowed_sorts = {"display_name", "ip_address", "status", "group_name", "os_type", "last_collected_at"}
    if sort not in allowed_sorts:
        sort = "display_name"

    async with async_session() as session:
        count_result = await session.execute(
            text(f"SELECT COUNT(*) FROM servers s WHERE {where}"), params
        )
        total = count_result.scalar()

        result = await session.execute(
            text(f"""SELECT s.server_id, s.display_name, s.ip_address, s.os_type,
                s.group_name, s.status, s.last_collected_at,
                (SELECT cpu_usage_pct FROM metrics_raw
                 WHERE server_id=s.server_id ORDER BY collected_at DESC LIMIT 1) as cpu,
                (SELECT mem_usage_pct FROM metrics_raw
                 WHERE server_id=s.server_id ORDER BY collected_at DESC LIMIT 1) as mem,
                (SELECT COUNT(*) FROM alert_history
                 WHERE server_id=s.server_id AND resolved_at IS NULL) as alerts
                FROM servers s
                WHERE {where}
                ORDER BY {sort}
                LIMIT :limit OFFSET :offset"""),
            params
        )
        rows = result.fetchall()

    items = []
    for r in rows:
        items.append(ServerSummary(
            server_id=r[0], display_name=r[1], ip_address=r[2],
            os_type=r[3], group_name=r[4], status=r[5],
            cpu_usage_pct=r[7], mem_usage_pct=r[8],
            disk_max_pct=None, last_collected_at=r[6],
            active_alerts=r[9] or 0
        ))

    return ServerListResponse(items=items, total=total, page=page, size=size)


@router.post("", response_model=ServerDetail)
async def create_server(request: CreateServerRequest):
    """서버 등록"""
    encrypted_pass = encrypt(request.credential_pass)
    tags_json = json.dumps(request.tags)

    async with async_session() as session:
        # 중복 IP 체크
        existing = await session.execute(
            text("SELECT server_id FROM servers WHERE ip_address=:ip AND is_active=1"),
            {"ip": request.ip_address}
        )
        if existing.fetchone():
            raise HTTPException(status_code=400, detail="이미 등록된 IP 주소입니다")

        await session.execute(
            text("""INSERT INTO servers
                (hostname, display_name, ip_address, domain, os_type,
                 credential_user, credential_pass, ssh_port, winrm_port, use_ssl,
                 group_name, location, description, tags)
                VALUES (:hn, :dn, :ip, :dm, :ot, :cu, :cp, :sp, :wp, :ssl,
                        :gn, :loc, :desc, :tags)"""),
            {
                "hn": request.hostname, "dn": request.display_name,
                "ip": request.ip_address, "dm": request.domain,
                "ot": request.os_type, "cu": request.credential_user,
                "cp": encrypted_pass, "sp": request.ssh_port,
                "wp": request.winrm_port, "ssl": 1 if request.use_ssl else 0,
                "gn": request.group_name, "loc": request.location,
                "desc": request.description, "tags": tags_json
            }
        )
        await session.commit()
        result = await session.execute(text("SELECT last_insert_rowid()"))
        server_id = result.scalar()

    # 수집 시작
    await collector_engine.start_server(server_id)

    return await get_server(server_id)


@router.get("/export")
async def export_servers():
    """서버 목록 내보내기"""
    async with async_session() as session:
        result = await session.execute(
            text("""SELECT display_name, ip_address, hostname, os_type,
                group_name, status, credential_user, ssh_port, winrm_port
                FROM servers WHERE is_active=1 ORDER BY display_name""")
        )
        rows = result.fetchall()

    servers = []
    for r in rows:
        servers.append({
            "display_name": r[0], "ip_address": r[1], "hostname": r[2],
            "os_type": r[3], "group_name": r[4], "status": r[5],
            "credential_user": r[6], "ssh_port": r[7], "winrm_port": r[8]
        })
    return servers


@router.post("/import", response_model=MessageResponse)
async def import_servers(servers: list[CreateServerRequest]):
    """서버 일괄 등록"""
    count = 0
    errors = []
    for srv in servers:
        try:
            await create_server(srv)
            count += 1
        except HTTPException as e:
            errors.append(f"{srv.ip_address}: {e.detail}")
        except Exception as e:
            errors.append(f"{srv.ip_address}: {str(e)}")

    msg = f"{count}대 등록 완료"
    if errors:
        msg += f" (실패 {len(errors)}건: {'; '.join(errors[:3])})"
    return MessageResponse(message=msg)


@router.get("/compare")
async def compare_servers(
    ids: str = Query(...),
    metric: str = Query("cpu"),
    date_from: str = None,
    date_to: str = None
):
    """서버 비교"""
    server_ids = [int(x) for x in ids.split(',')]
    if len(server_ids) > 4:
        raise HTTPException(status_code=400, detail="최대 4대까지 비교 가능합니다")

    time_filter = ""
    params = {}
    if date_from:
        time_filter += " AND bucket_time >= :df"
        params["df"] = date_from
    if date_to:
        time_filter += " AND bucket_time <= :dt"
        params["dt"] = date_to

    metric_col = {
        "cpu": "cpu_avg",
        "mem": "mem_avg_pct",
        "disk_read": "disk_read_avg",
        "disk_write": "disk_write_avg"
    }.get(metric, "cpu_avg")

    result_data = {}
    async with async_session() as session:
        for sid in server_ids:
            params["sid"] = sid
            result = await session.execute(
                text(f"""SELECT bucket_time, {metric_col}
                     FROM metrics_5min
                     WHERE server_id=:sid {time_filter}
                     ORDER BY bucket_time"""),
                params
            )
            rows = result.fetchall()

            srv_result = await session.execute(
                text("SELECT display_name FROM servers WHERE server_id=:sid"),
                {"sid": sid}
            )
            name = srv_result.scalar() or f"Server {sid}"

            result_data[name] = [
                {"time": r[0], "value": r[1]} for r in rows
            ]

    return result_data


@router.get("/{server_id}", response_model=ServerDetail)
async def get_server(server_id: int):
    """서버 상세 조회"""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT * FROM servers WHERE server_id=:sid"),
            {"sid": server_id}
        )
        row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

    r = row._mapping
    tags = []
    try:
        tags = json.loads(r['tags']) if r['tags'] else []
    except (json.JSONDecodeError, TypeError):
        pass

    return ServerDetail(
        server_id=r['server_id'], hostname=r['hostname'],
        display_name=r['display_name'], ip_address=r['ip_address'],
        domain=r['domain'], os_type=r['os_type'],
        os_version=r['os_version'], credential_user=r['credential_user'],
        ssh_port=r['ssh_port'], winrm_port=r['winrm_port'],
        use_ssl=bool(r['use_ssl']),
        group_name=r['group_name'], location=r['location'],
        description=r['description'], tags=tags,
        cpu_model=r['cpu_model'], cpu_cores=r['cpu_cores'],
        total_memory_mb=r['total_memory_mb'], disk_info=r['disk_info'],
        status=r['status'], last_collected_at=r['last_collected_at'],
        collect_error=r['collect_error'],
        is_maintenance=bool(r['is_maintenance']),
        maintenance_until=r['maintenance_until'],
        is_active=bool(r['is_active']),
        collect_interval=r['collect_interval'],
        created_at=r['created_at'], updated_at=r['updated_at']
    )


@router.put("/{server_id}", response_model=ServerDetail)
async def update_server(server_id: int, request: UpdateServerRequest):
    """서버 수정"""
    updates = {}
    if request.hostname is not None:
        updates["hostname"] = request.hostname
    if request.display_name is not None:
        updates["display_name"] = request.display_name
    if request.ip_address is not None:
        updates["ip_address"] = request.ip_address
    if request.domain is not None:
        updates["domain"] = request.domain
    if request.os_type is not None:
        updates["os_type"] = request.os_type
    if request.credential_user is not None:
        updates["credential_user"] = request.credential_user
    if request.credential_pass is not None:
        updates["credential_pass"] = encrypt(request.credential_pass)
    if request.ssh_port is not None:
        updates["ssh_port"] = request.ssh_port
    if request.winrm_port is not None:
        updates["winrm_port"] = request.winrm_port
    if request.use_ssl is not None:
        updates["use_ssl"] = 1 if request.use_ssl else 0
    if request.group_name is not None:
        updates["group_name"] = request.group_name
    if request.location is not None:
        updates["location"] = request.location
    if request.description is not None:
        updates["description"] = request.description
    if request.tags is not None:
        updates["tags"] = json.dumps(request.tags)

    if not updates:
        raise HTTPException(status_code=400, detail="변경할 항목이 없습니다")

    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    updates["sid"] = server_id

    async with async_session() as session:
        await session.execute(
            text(f"UPDATE servers SET {set_clause}, updated_at=datetime('now','localtime') WHERE server_id=:sid"),
            updates
        )
        await session.commit()

    # 수집 재시작
    await collector_engine.restart_server(server_id)

    return await get_server(server_id)


@router.delete("/{server_id}", response_model=MessageResponse)
async def delete_server(server_id: int):
    """서버 비활성화"""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT server_id FROM servers WHERE server_id=:sid"),
            {"sid": server_id}
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

        await session.execute(
            text("UPDATE servers SET is_active=0, updated_at=datetime('now','localtime') WHERE server_id=:sid"),
            {"sid": server_id}
        )
        await session.commit()

    await collector_engine.stop_server(server_id)
    return MessageResponse(message="서버가 비활성화되었습니다")


@router.post("/{server_id}/test-connection")
async def test_connection_by_id(server_id: int):
    """등록된 서버의 접속 테스트"""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT * FROM servers WHERE server_id=:sid"),
            {"sid": server_id}
        )
        row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

    r = row._mapping
    from backend.core.crypto import decrypt
    password = decrypt(r['credential_pass'])

    if r['os_type'] == 'windows':
        from backend.core.collector_winrm import test_winrm_connection
        return test_winrm_connection(r['ip_address'], r['winrm_port'], r['credential_user'], password, bool(r['use_ssl']))
    else:
        from backend.core.collector_ssh import test_ssh_connection
        return test_ssh_connection(r['ip_address'], r['ssh_port'], r['credential_user'], password, r.get('ssh_key_path'))


@router.post("/test-connection")
async def test_connection(request: TestConnectionRequest):
    """접속 테스트 (등록 전)"""
    if request.os_type == 'windows':
        from backend.core.collector_winrm import test_winrm_connection
        return test_winrm_connection(
            request.ip_address, request.winrm_port,
            request.credential_user, request.credential_pass, request.use_ssl
        )
    else:
        from backend.core.collector_ssh import test_ssh_connection
        return test_ssh_connection(
            request.ip_address, request.ssh_port,
            request.credential_user, request.credential_pass
        )


@router.post("/{server_id}/maintenance", response_model=MessageResponse)
async def set_maintenance(server_id: int, request: MaintenanceRequest):
    """유지보수 모드 전환"""
    async with async_session() as session:
        await session.execute(
            text("""UPDATE servers SET is_maintenance=:im, maintenance_until=:mu,
                 status=CASE WHEN :im=1 THEN 'maintenance' ELSE 'unknown' END,
                 updated_at=datetime('now','localtime')
                 WHERE server_id=:sid"""),
            {"im": 1 if request.is_maintenance else 0,
             "mu": request.maintenance_until, "sid": server_id}
        )
        await session.commit()

    if request.is_maintenance:
        await collector_engine.stop_server(server_id)
        return MessageResponse(message="유지보수 모드로 전환되었습니다")
    else:
        await collector_engine.start_server(server_id)
        return MessageResponse(message="유지보수 모드가 해제되었습니다")

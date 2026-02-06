"""헬스체크 API 라우터"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import HealthCheckCreate, HealthCheckUpdate, MessageResponse
from backend.core.health_checker import execute_health_check

router = APIRouter(tags=["health-checks"])


@router.get("/api/v1/servers/{server_id}/health-checks")
async def list_health_checks(server_id: int):
    """서버별 헬스체크 목록 조회"""
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
                text("""SELECT hc.check_id, hc.server_id, hc.check_type, hc.check_name,
                    hc.target, hc.interval_sec, hc.timeout_sec, hc.expected_status,
                    hc.is_enabled, hc.created_at,
                    (SELECT is_healthy FROM health_check_results
                     WHERE check_id=hc.check_id ORDER BY checked_at DESC LIMIT 1) as last_healthy,
                    (SELECT response_ms FROM health_check_results
                     WHERE check_id=hc.check_id ORDER BY checked_at DESC LIMIT 1) as last_response_ms,
                    (SELECT checked_at FROM health_check_results
                     WHERE check_id=hc.check_id ORDER BY checked_at DESC LIMIT 1) as last_checked_at
                    FROM health_checks hc
                    WHERE hc.server_id=:sid
                    ORDER BY hc.check_name"""),
                {"sid": server_id}
            )
            rows = result.fetchall()

        checks = []
        for r in rows:
            checks.append({
                "check_id": r[0],
                "server_id": r[1],
                "check_type": r[2],
                "check_name": r[3],
                "target": r[4],
                "interval_sec": r[5],
                "timeout_sec": r[6],
                "expected_status": r[7],
                "is_enabled": bool(r[8]),
                "created_at": r[9],
                "last_healthy": bool(r[10]) if r[10] is not None else None,
                "last_response_ms": r[11],
                "last_checked_at": r[12]
            })

        return {"server_id": server_id, "count": len(checks), "checks": checks}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"헬스체크 목록 조회 실패: {str(e)}")


@router.post("/api/v1/servers/{server_id}/health-checks")
async def create_health_check(server_id: int, request: HealthCheckCreate):
    """헬스체크 생성"""
    try:
        valid_types = ("ping", "tcp", "http")
        if request.check_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"check_type은 {', '.join(valid_types)} 중 하나여야 합니다"
            )

        async with async_session() as session:
            # 서버 존재 여부 확인
            srv = await session.execute(
                text("SELECT server_id FROM servers WHERE server_id=:sid AND is_active=1"),
                {"sid": server_id}
            )
            if not srv.fetchone():
                raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

            await session.execute(
                text("""INSERT INTO health_checks
                    (server_id, check_type, check_name, target,
                     interval_sec, timeout_sec, expected_status, is_enabled)
                    VALUES (:sid, :ct, :cn, :tgt, :isec, :tsec, :es, :ie)"""),
                {
                    "sid": server_id,
                    "ct": request.check_type,
                    "cn": request.check_name or f"{request.check_type}_{request.target}",
                    "tgt": request.target,
                    "isec": request.interval_sec,
                    "tsec": request.timeout_sec,
                    "es": request.expected_status,
                    "ie": 1 if request.is_enabled else 0
                }
            )
            await session.commit()
            result = await session.execute(text("SELECT last_insert_rowid()"))
            check_id = result.scalar()

        return await _get_health_check(check_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"헬스체크 생성 실패: {str(e)}")


@router.put("/api/v1/health-checks/{check_id}")
async def update_health_check(check_id: int, request: HealthCheckUpdate):
    """헬스체크 수정"""
    try:
        updates = {}
        if request.check_type is not None:
            valid_types = ("ping", "tcp", "http")
            if request.check_type not in valid_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"check_type은 {', '.join(valid_types)} 중 하나여야 합니다"
                )
            updates["check_type"] = request.check_type
        if request.check_name is not None:
            updates["check_name"] = request.check_name
        if request.target is not None:
            updates["target"] = request.target
        if request.interval_sec is not None:
            updates["interval_sec"] = request.interval_sec
        if request.timeout_sec is not None:
            updates["timeout_sec"] = request.timeout_sec
        if request.expected_status is not None:
            updates["expected_status"] = request.expected_status
        if request.is_enabled is not None:
            updates["is_enabled"] = 1 if request.is_enabled else 0

        if not updates:
            raise HTTPException(status_code=400, detail="변경할 항목이 없습니다")

        async with async_session() as session:
            existing = await session.execute(
                text("SELECT check_id FROM health_checks WHERE check_id=:cid"),
                {"cid": check_id}
            )
            if not existing.fetchone():
                raise HTTPException(status_code=404, detail="헬스체크를 찾을 수 없습니다")

            set_clause = ", ".join(f"{k}=:{k}" for k in updates)
            updates["cid"] = check_id

            await session.execute(
                text(f"UPDATE health_checks SET {set_clause} WHERE check_id=:cid"),
                updates
            )
            await session.commit()

        return await _get_health_check(check_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"헬스체크 수정 실패: {str(e)}")


@router.delete("/api/v1/health-checks/{check_id}", response_model=MessageResponse)
async def delete_health_check(check_id: int):
    """헬스체크 삭제"""
    try:
        async with async_session() as session:
            existing = await session.execute(
                text("SELECT check_id FROM health_checks WHERE check_id=:cid"),
                {"cid": check_id}
            )
            if not existing.fetchone():
                raise HTTPException(status_code=404, detail="헬스체크를 찾을 수 없습니다")

            # 관련 결과도 삭제
            await session.execute(
                text("DELETE FROM health_check_results WHERE check_id=:cid"),
                {"cid": check_id}
            )
            await session.execute(
                text("DELETE FROM health_checks WHERE check_id=:cid"),
                {"cid": check_id}
            )
            await session.commit()

        return MessageResponse(message="헬스체크가 삭제되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"헬스체크 삭제 실패: {str(e)}")


@router.post("/api/v1/servers/{server_id}/health-check-now")
async def run_health_check_now(server_id: int, check_id: int = None):
    """헬스체크 즉시 실행"""
    try:
        async with async_session() as session:
            # 서버 존재 여부 확인
            srv = await session.execute(
                text("SELECT server_id FROM servers WHERE server_id=:sid AND is_active=1"),
                {"sid": server_id}
            )
            if not srv.fetchone():
                raise HTTPException(status_code=404, detail="서버를 찾을 수 없습니다")

            if check_id:
                # 특정 체크만 실행
                check = await session.execute(
                    text("SELECT check_id FROM health_checks WHERE check_id=:cid AND server_id=:sid"),
                    {"cid": check_id, "sid": server_id}
                )
                if not check.fetchone():
                    raise HTTPException(status_code=404, detail="해당 서버의 헬스체크를 찾을 수 없습니다")

                result = await execute_health_check(check_id)
                return {"results": [{"check_id": check_id, **result}]}
            else:
                # 서버의 모든 활성 체크 실행
                checks = await session.execute(
                    text("SELECT check_id FROM health_checks WHERE server_id=:sid AND is_enabled=1"),
                    {"sid": server_id}
                )
                check_rows = checks.fetchall()

        if not check_id and not check_rows:
            raise HTTPException(status_code=404, detail="실행할 헬스체크가 없습니다")

        results = []
        if not check_id:
            for cr in check_rows:
                hc_result = await execute_health_check(cr[0])
                results.append({"check_id": cr[0], **hc_result})

        return {"server_id": server_id, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"헬스체크 실행 실패: {str(e)}")


async def _get_health_check(check_id: int) -> dict:
    """헬스체크 상세 조회 (내부 헬퍼)"""
    async with async_session() as session:
        result = await session.execute(
            text("""SELECT hc.check_id, hc.server_id, hc.check_type, hc.check_name,
                hc.target, hc.interval_sec, hc.timeout_sec, hc.expected_status,
                hc.is_enabled, hc.created_at,
                (SELECT is_healthy FROM health_check_results
                 WHERE check_id=hc.check_id ORDER BY checked_at DESC LIMIT 1) as last_healthy,
                (SELECT response_ms FROM health_check_results
                 WHERE check_id=hc.check_id ORDER BY checked_at DESC LIMIT 1) as last_response_ms,
                (SELECT checked_at FROM health_check_results
                 WHERE check_id=hc.check_id ORDER BY checked_at DESC LIMIT 1) as last_checked_at
                FROM health_checks hc
                WHERE hc.check_id=:cid"""),
            {"cid": check_id}
        )
        r = result.fetchone()

    if not r:
        raise HTTPException(status_code=404, detail="헬스체크를 찾을 수 없습니다")

    return {
        "check_id": r[0],
        "server_id": r[1],
        "check_type": r[2],
        "check_name": r[3],
        "target": r[4],
        "interval_sec": r[5],
        "timeout_sec": r[6],
        "expected_status": r[7],
        "is_enabled": bool(r[8]),
        "created_at": r[9],
        "last_healthy": bool(r[10]) if r[10] is not None else None,
        "last_response_ms": r[11],
        "last_checked_at": r[12]
    }

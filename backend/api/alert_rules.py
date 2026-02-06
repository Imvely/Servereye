"""알림 규칙 CRUD API 라우터"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import AlertRuleCreate, AlertRuleUpdate, MessageResponse

router = APIRouter(prefix="/api/v1/alert-rules", tags=["alert-rules"])


@router.get("")
async def list_alert_rules(
    server_id: int = None,
    group_name: str = None,
    metric_name: str = None,
    is_enabled: int = Query(None, description="0=비활성, 1=활성")
):
    """알림 규칙 목록 조회"""
    try:
        conditions = []
        params = {}

        if server_id is not None:
            conditions.append("server_id=:server_id")
            params["server_id"] = server_id
        if group_name:
            conditions.append("group_name=:group_name")
            params["group_name"] = group_name
        if metric_name:
            conditions.append("metric_name=:metric_name")
            params["metric_name"] = metric_name
        if is_enabled is not None:
            conditions.append("is_enabled=:is_enabled")
            params["is_enabled"] = is_enabled

        where = " AND ".join(conditions) if conditions else "1=1"

        async with async_session() as session:
            result = await session.execute(
                text(f"""SELECT rule_id, rule_name, description, server_id, group_name,
                    metric_name, condition_op, warning_value, critical_value,
                    duration_sec, cooldown_sec, is_enabled, sort_order,
                    created_at, updated_at
                    FROM alert_rules
                    WHERE {where}
                    ORDER BY sort_order, rule_name"""),
                params
            )
            rows = result.fetchall()

        rules = []
        for r in rows:
            rules.append({
                "rule_id": r[0],
                "rule_name": r[1],
                "description": r[2],
                "server_id": r[3],
                "group_name": r[4],
                "metric_name": r[5],
                "condition_op": r[6],
                "warning_value": r[7],
                "critical_value": r[8],
                "duration_sec": r[9],
                "cooldown_sec": r[10],
                "is_enabled": bool(r[11]),
                "sort_order": r[12],
                "created_at": r[13],
                "updated_at": r[14]
            })

        return rules
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 규칙 조회 실패: {str(e)}")


@router.get("/{rule_id}")
async def get_alert_rule(rule_id: int):
    """알림 규칙 상세 조회"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("""SELECT rule_id, rule_name, description, server_id, group_name,
                    metric_name, condition_op, warning_value, critical_value,
                    duration_sec, cooldown_sec, is_enabled, sort_order,
                    created_at, updated_at
                    FROM alert_rules WHERE rule_id=:rid"""),
                {"rid": rule_id}
            )
            r = result.fetchone()

        if not r:
            raise HTTPException(status_code=404, detail="알림 규칙을 찾을 수 없습니다")

        return {
            "rule_id": r[0],
            "rule_name": r[1],
            "description": r[2],
            "server_id": r[3],
            "group_name": r[4],
            "metric_name": r[5],
            "condition_op": r[6],
            "warning_value": r[7],
            "critical_value": r[8],
            "duration_sec": r[9],
            "cooldown_sec": r[10],
            "is_enabled": bool(r[11]),
            "sort_order": r[12],
            "created_at": r[13],
            "updated_at": r[14]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 규칙 조회 실패: {str(e)}")


@router.post("")
async def create_alert_rule(request: AlertRuleCreate):
    """알림 규칙 생성"""
    try:
        async with async_session() as session:
            # 동일 이름 규칙 중복 체크
            existing = await session.execute(
                text("SELECT rule_id FROM alert_rules WHERE rule_name=:rn"),
                {"rn": request.rule_name}
            )
            if existing.fetchone():
                raise HTTPException(status_code=400, detail="동일한 이름의 규칙이 이미 존재합니다")

            await session.execute(
                text("""INSERT INTO alert_rules
                    (rule_name, description, server_id, group_name,
                     metric_name, condition_op, warning_value, critical_value,
                     duration_sec, cooldown_sec, is_enabled, sort_order)
                    VALUES (:rn, :desc, :sid, :gn, :mn, :co, :wv, :cv, :ds, :cs, :ie, :so)"""),
                {
                    "rn": request.rule_name,
                    "desc": request.description,
                    "sid": request.server_id,
                    "gn": request.group_name,
                    "mn": request.metric_name,
                    "co": request.condition_op,
                    "wv": request.warning_value,
                    "cv": request.critical_value,
                    "ds": request.duration_sec,
                    "cs": request.cooldown_sec,
                    "ie": 1 if request.is_enabled else 0,
                    "so": request.sort_order
                }
            )
            await session.commit()
            result = await session.execute(text("SELECT last_insert_rowid()"))
            rule_id = result.scalar()

        return await get_alert_rule(rule_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 규칙 생성 실패: {str(e)}")


@router.put("/{rule_id}")
async def update_alert_rule(rule_id: int, request: AlertRuleUpdate):
    """알림 규칙 수정"""
    try:
        updates = {}
        if request.rule_name is not None:
            updates["rule_name"] = request.rule_name
        if request.description is not None:
            updates["description"] = request.description
        if request.server_id is not None:
            updates["server_id"] = request.server_id
        if request.group_name is not None:
            updates["group_name"] = request.group_name
        if request.metric_name is not None:
            updates["metric_name"] = request.metric_name
        if request.condition_op is not None:
            updates["condition_op"] = request.condition_op
        if request.warning_value is not None:
            updates["warning_value"] = request.warning_value
        if request.critical_value is not None:
            updates["critical_value"] = request.critical_value
        if request.duration_sec is not None:
            updates["duration_sec"] = request.duration_sec
        if request.cooldown_sec is not None:
            updates["cooldown_sec"] = request.cooldown_sec
        if request.is_enabled is not None:
            updates["is_enabled"] = 1 if request.is_enabled else 0
        if request.sort_order is not None:
            updates["sort_order"] = request.sort_order

        if not updates:
            raise HTTPException(status_code=400, detail="변경할 항목이 없습니다")

        async with async_session() as session:
            # 규칙 존재 여부 확인
            existing = await session.execute(
                text("SELECT rule_id FROM alert_rules WHERE rule_id=:rid"),
                {"rid": rule_id}
            )
            if not existing.fetchone():
                raise HTTPException(status_code=404, detail="알림 규칙을 찾을 수 없습니다")

            set_clause = ", ".join(f"{k}=:{k}" for k in updates)
            updates["rid"] = rule_id

            await session.execute(
                text(f"""UPDATE alert_rules
                     SET {set_clause}, updated_at=datetime('now','localtime')
                     WHERE rule_id=:rid"""),
                updates
            )
            await session.commit()

        return await get_alert_rule(rule_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 규칙 수정 실패: {str(e)}")


@router.delete("/{rule_id}", response_model=MessageResponse)
async def delete_alert_rule(rule_id: int):
    """알림 규칙 삭제"""
    try:
        async with async_session() as session:
            existing = await session.execute(
                text("SELECT rule_id FROM alert_rules WHERE rule_id=:rid"),
                {"rid": rule_id}
            )
            if not existing.fetchone():
                raise HTTPException(status_code=404, detail="알림 규칙을 찾을 수 없습니다")

            await session.execute(
                text("DELETE FROM alert_rules WHERE rule_id=:rid"),
                {"rid": rule_id}
            )
            await session.commit()

        return MessageResponse(message="알림 규칙이 삭제되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 규칙 삭제 실패: {str(e)}")


@router.post("/reset-defaults", response_model=MessageResponse)
async def reset_default_rules():
    """기본 알림 규칙으로 초기화"""
    try:
        default_rules = [
            ('CPU 과부하', None, None, 'cpu_usage_pct', '>=', 70, 90, 30, 300),
            ('메모리 부족', None, None, 'mem_usage_pct', '>=', 80, 95, 60, 300),
            ('디스크 부족', None, None, 'disk_usage_pct', '>=', 80, 95, 0, 300),
            ('수집 실패', None, None, 'collect_timeout', '>=', 15, 60, 0, 300),
        ]

        async with async_session() as session:
            # 기존 규칙 삭제
            await session.execute(text("DELETE FROM alert_rules"))

            # 기본 규칙 재생성
            for r in default_rules:
                await session.execute(
                    text("""INSERT INTO alert_rules
                        (rule_name, server_id, group_name, metric_name, condition_op,
                         warning_value, critical_value, duration_sec, cooldown_sec)
                        VALUES (:rn, :sid, :gn, :mn, :co, :wv, :cv, :ds, :cs)"""),
                    {
                        "rn": r[0], "sid": r[1], "gn": r[2], "mn": r[3], "co": r[4],
                        "wv": r[5], "cv": r[6], "ds": r[7], "cs": r[8]
                    }
                )
            await session.commit()

        return MessageResponse(message="기본 알림 규칙으로 초기화되었습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"기본 규칙 초기화 실패: {str(e)}")

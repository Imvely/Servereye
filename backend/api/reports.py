"""리포트 API 라우터"""
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import GenerateReportRequest, MessageResponse
from backend.core.report_gen import generate_report

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/generate")
async def create_report(request: GenerateReportRequest):
    """리포트 생성"""
    try:
        if not request.date_from or not request.date_to:
            raise HTTPException(status_code=400, detail="date_from과 date_to는 필수입니다")

        if request.date_from > request.date_to:
            raise HTTPException(status_code=400, detail="date_from은 date_to보다 이전이어야 합니다")

        valid_types = ("summary", "detail")
        if request.report_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"report_type은 {', '.join(valid_types)} 중 하나여야 합니다"
            )

        # server_ids 유효성 검증
        if request.server_ids:
            async with async_session() as session:
                placeholders = ",".join(str(s) for s in request.server_ids)
                result = await session.execute(
                    text(f"SELECT COUNT(*) FROM servers WHERE server_id IN ({placeholders}) AND is_active=1")
                )
                count = result.scalar()
                if count != len(request.server_ids):
                    raise HTTPException(status_code=400, detail="유효하지 않은 서버 ID가 포함되어 있습니다")

        result = await generate_report(
            date_from=request.date_from,
            date_to=request.date_to,
            server_ids=request.server_ids,
            report_type=request.report_type
        )

        return {
            "success": True,
            "message": "리포트가 생성되었습니다",
            "report_id": result["report_id"],
            "filename": result["filename"],
            "file_size_kb": result["file_size_kb"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리포트 생성 실패: {str(e)}")


@router.get("")
async def list_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100)
):
    """리포트 이력 조회"""
    try:
        offset = (page - 1) * size
        params = {"limit": size, "offset": offset}

        async with async_session() as session:
            count_result = await session.execute(
                text("SELECT COUNT(*) FROM report_history")
            )
            total = count_result.scalar()

            result = await session.execute(
                text("""SELECT report_id, report_name, report_type, server_ids,
                    date_from, date_to, file_path, file_size_kb,
                    created_by, created_at
                    FROM report_history
                    ORDER BY created_at DESC
                    LIMIT :limit OFFSET :offset"""),
                params
            )
            rows = result.fetchall()

        reports = []
        for r in rows:
            # 파일 존재 여부 확인
            file_exists = os.path.exists(r[6]) if r[6] else False
            reports.append({
                "report_id": r[0],
                "report_name": r[1],
                "report_type": r[2],
                "server_ids": r[3],
                "date_from": r[4],
                "date_to": r[5],
                "file_path": r[6],
                "file_size_kb": r[7],
                "created_by": r[8],
                "created_at": r[9],
                "file_exists": file_exists
            })

        return {"items": reports, "total": total, "page": page, "size": size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리포트 목록 조회 실패: {str(e)}")


@router.get("/{report_id}/download")
async def download_report(report_id: int):
    """리포트 파일 다운로드"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT report_name, file_path FROM report_history WHERE report_id=:rid"),
                {"rid": report_id}
            )
            row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다")

        file_path = row[1]
        filename = row[0]

        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="리포트 파일이 존재하지 않습니다")

        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리포트 다운로드 실패: {str(e)}")


@router.delete("/{report_id}", response_model=MessageResponse)
async def delete_report(report_id: int):
    """리포트 삭제"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT report_id, file_path FROM report_history WHERE report_id=:rid"),
                {"rid": report_id}
            )
            row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다")

        # 파일 삭제
        file_path = row[1]
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass  # 파일 삭제 실패는 무시

        # DB 레코드 삭제
        async with async_session() as session:
            await session.execute(
                text("DELETE FROM report_history WHERE report_id=:rid"),
                {"rid": report_id}
            )
            await session.commit()

        return MessageResponse(message="리포트가 삭제되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리포트 삭제 실패: {str(e)}")

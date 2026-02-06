"""AI 이상탐지 모듈 (Isolation Forest)"""
import logging
import numpy as np
from typing import Optional
from sqlalchemy import text
from backend.db.database import async_session

logger = logging.getLogger(__name__)


async def detect_anomalies(server_id: int) -> list[dict]:
    """Isolation Forest로 이상 탐지"""
    try:
        from sklearn.ensemble import IsolationForest

        async with async_session() as session:
            result = await session.execute(
                text("""SELECT cpu_usage_pct, mem_usage_pct
                     FROM metrics_raw
                     WHERE server_id=:sid
                     AND collected_at >= datetime('now', '-1 hour', 'localtime')
                     AND cpu_usage_pct IS NOT NULL
                     AND mem_usage_pct IS NOT NULL
                     ORDER BY collected_at"""),
                {"sid": server_id}
            )
            rows = result.fetchall()

        if len(rows) < 30:
            return []

        data = np.array([[r[0], r[1]] for r in rows])
        model = IsolationForest(contamination=0.05, random_state=42)
        predictions = model.fit_predict(data)

        anomalies = []
        for i, pred in enumerate(predictions):
            if pred == -1:
                anomalies.append({
                    "index": i,
                    "cpu": data[i][0],
                    "mem": data[i][1],
                    "is_anomaly": True
                })

        return anomalies

    except ImportError:
        logger.warning("scikit-learn not installed, anomaly detection disabled")
        return []
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        return []


async def predict_disk_usage(server_id: int) -> Optional[dict]:
    """디스크 사용량 선형 회귀 예측"""
    try:
        from sklearn.linear_model import LinearRegression

        async with async_session() as session:
            result = await session.execute(
                text("""SELECT bucket_time, disk_read_avg
                     FROM metrics_hourly
                     WHERE server_id=:sid
                     AND bucket_time >= datetime('now', '-7 days', 'localtime')
                     AND disk_read_avg IS NOT NULL
                     ORDER BY bucket_time"""),
                {"sid": server_id}
            )
            rows = result.fetchall()

        if len(rows) < 24:
            return None

        X = np.arange(len(rows)).reshape(-1, 1)
        y = np.array([r[1] for r in rows])

        model = LinearRegression()
        model.fit(X, y)

        # 7일 후 예측
        future_idx = len(rows) + 168  # 168시간 = 7일
        predicted = model.predict([[future_idx]])[0]

        return {
            "current_trend": "increasing" if model.coef_[0] > 0 else "decreasing",
            "predicted_7d": round(predicted, 1),
            "slope_per_hour": round(model.coef_[0], 4)
        }

    except ImportError:
        return None
    except Exception as e:
        logger.error(f"Disk prediction error: {e}")
        return None

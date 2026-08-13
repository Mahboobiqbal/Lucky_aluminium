from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.measurement import Measurement
from schemas.measurement import MeasurementCreate
from utils.dates import naive
from utils.deps import require_permission

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


def _to_response(m: Measurement) -> dict:
    return {
        "id": m.id, "customerName": m.customer_name, "style": m.style,
        "date": m.date, "fields": m.fields, "notes": m.notes, "createdAt": m.created_at,
    }


@router.get("")
async def list_measurements(db: AsyncSession = Depends(get_db), _user=Depends(require_permission("measurements", "view"))):
    result = await db.execute(select(Measurement).order_by(Measurement.created_at.desc()))
    return [_to_response(m) for m in result.scalars().all()]


@router.post("")
async def create_measurement(body: MeasurementCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("measurements", "create"))):
    measurement = Measurement(
        customer_name=body.customerName, style=body.style,
        date=naive(body.date), fields=body.fields, notes=body.notes,
        created_at=datetime.utcnow(),
    )
    db.add(measurement)
    await db.commit()
    await db.refresh(measurement)
    return _to_response(measurement)


@router.delete("/{measurement_id}")
async def delete_measurement(measurement_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_permission("measurements", "delete"))):
    result = await db.execute(select(Measurement).where(Measurement.id == measurement_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Measurement not found")

    await db.delete(m)
    await db.commit()
    return {"message": "Measurement deleted", "success": True}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User, UserPermission
from schemas.user import UserPermissionBase
from utils.deps import get_current_user, require_role

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("/user/{user_id}")
async def get_user_permissions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Users can read their own permissions; admin can read anyone's
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    perms_result = await db.execute(select(UserPermission).where(UserPermission.user_id == user_id))
    return [
        {
            "id": p.id,
            "userId": p.user_id,
            "moduleKey": p.module_key,
            "canView": p.can_view,
            "canCreate": p.can_create,
            "canEdit": p.can_edit,
            "canDelete": p.can_delete,
            "canPrint": p.can_print,
            "canExport": p.can_export,
        }
        for p in perms_result.scalars().all()
    ]


@router.put("/user/{user_id}")
async def update_user_permissions(
    user_id: int,
    permissions: list[UserPermissionBase],
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("admin")),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_perms = await db.execute(select(UserPermission).where(UserPermission.user_id == user_id))
    for old in old_perms.scalars().all():
        await db.delete(old)

    for perm in permissions:
        db.add(UserPermission(
            user_id=user_id,
            module_key=perm.moduleKey,
            can_view=perm.canView,
            can_create=perm.canCreate,
            can_edit=perm.canEdit,
            can_delete=perm.canDelete,
            can_print=perm.canPrint,
            can_export=perm.canExport,
        ))

    await db.commit()
    return {"message": "Permissions updated", "success": True}

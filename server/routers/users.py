from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.user import User, UserPermission
from schemas.user import UserCreate, UserResponse, UserUpdate
from utils.auth import hash_password
from utils.dates import naive
from utils.deps import require_role

router = APIRouter(prefix="/api/users", tags=["users"])

ADMIN_ROLE = "admin"
VALID_ROLES = ("admin", "manager")


def _to_response(u: User) -> dict:
    return {
        "id": u.id,
        "fullName": u.full_name,
        "username": u.username,
        "email": u.email,
        "phone": u.phone,
        "status": u.status,
        "role": u.role,
        "createdAt": u.created_at,
    }


def _to_response_with_permissions(u: User) -> dict:
    data = _to_response(u)
    data["permissions"] = [
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
        for p in u.permissions
    ]
    return data


async def _admin_count(db: AsyncSession) -> int:
    result = await db.execute(select(User).where(User.role == ADMIN_ROLE))
    return len(result.scalars().all())


async def _is_target_admin(db: AsyncSession, user_id: int) -> bool:
    result = await db.execute(select(User).where(User.id == user_id, User.role == ADMIN_ROLE))
    return result.scalar_one_or_none() is not None


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db), _user=Depends(require_role("admin"))):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [_to_response(u) for u in result.scalars().all()]


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_role("admin"))):
    result = await db.execute(
        select(User).options(selectinload(User.permissions)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_response_with_permissions(user)


@router.post("")
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), _user=Depends(require_role("admin"))):
    # Only "manager" role allowed for new users — admin role is NEVER assignable via API
    if body.role == ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Cannot create admin users via API. Admin is seeded at startup.")
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}. Allowed: {', '.join(VALID_ROLES)}")

    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    # Force role to "manager" — never trust frontend-supplied role for admin
    user = User(
        full_name=body.fullName,
        username=body.username,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        status=body.status if body.status in ("active", "inactive") else "active",
        role="manager",
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.flush()

    for perm in body.permissions:
        db.add(UserPermission(
            user_id=user.id,
            module_key=perm.moduleKey,
            can_view=perm.canView,
            can_create=perm.canCreate,
            can_edit=perm.canEdit,
            can_delete=perm.canDelete,
            can_print=perm.canPrint,
            can_export=perm.canExport,
        ))

    await db.commit()
    result = await db.execute(
        select(User).options(selectinload(User.permissions)).where(User.id == user.id)
    )
    return _to_response_with_permissions(result.scalar_one())


@router.put("/{user_id}")
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db), _user=Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Protect the admin account from any modification by non-admin
    if user.role == ADMIN_ROLE and user.id != _user.id:
        raise HTTPException(status_code=403, detail="Cannot modify the admin account")

    # Prevent anyone from changing their own role (or anyone else's role to admin)
    if body.role == ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Cannot assign admin role")
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}. Allowed: {', '.join(VALID_ROLES)}")

    # If user is admin, do not allow role change away from admin
    if user.role == ADMIN_ROLE:
        body.role = ADMIN_ROLE

    user.full_name = body.fullName
    user.username = body.username
    user.email = body.email
    user.phone = body.phone
    user.status = body.status if body.status in ("active", "inactive") else user.status
    user.role = body.role

    if body.password:
        user.password_hash = hash_password(body.password)

    old_perms = await db.execute(select(UserPermission).where(UserPermission.user_id == user_id))
    for old in old_perms.scalars().all():
        await db.delete(old)

    for perm in body.permissions:
        db.add(UserPermission(
            user_id=user.id,
            module_key=perm.moduleKey,
            can_view=perm.canView,
            can_create=perm.canCreate,
            can_edit=perm.canEdit,
            can_delete=perm.canDelete,
            can_print=perm.canPrint,
            can_export=perm.canExport,
        ))

    await db.commit()
    result = await db.execute(
        select(User).options(selectinload(User.permissions)).where(User.id == user.id)
    )
    return _to_response_with_permissions(result.scalar_one())


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), _user=Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deleting yourself
    if user.id == _user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Prevent deleting the admin account
    if user.role == ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Cannot delete the admin account")

    # Safety: ensure at least one admin remains
    admin_count = await _admin_count(db)
    if admin_count <= 1 and user.role == ADMIN_ROLE:
        raise HTTPException(status_code=403, detail="Cannot delete the last admin account")

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted", "success": True}

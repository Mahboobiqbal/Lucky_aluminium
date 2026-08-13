from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User, UserPermission
from utils.auth import decode_access_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory that checks if the current user has one of the allowed roles.
    Usage: Depends(require_role("admin")) or Depends(require_role("admin", "manager"))
    """
    async def _check(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: requires one of roles {allowed_roles}",
            )
        return current_user
    return _check


def require_permission(module_key: str, action: str = "view"):
    """
    Dependency factory that checks if the current user has permission for a module/action.
    Admins always have full access. Managers are checked against user_permissions table.
    """
    async def _check(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
        # Admins bypass all permission checks
        if current_user.role == "admin":
            return current_user

        # Managers: check permission in database
        result = await db.execute(
            select(UserPermission).where(
                UserPermission.user_id == current_user.id,
                UserPermission.module_key == module_key,
            )
        )
        perm = result.scalar_one_or_none()

        if not perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: no permissions for {module_key}",
            )

        action_map = {
            "view": perm.can_view,
            "create": perm.can_create,
            "edit": perm.can_edit,
            "delete": perm.can_delete,
            "print": perm.can_print,
            "export": perm.can_export,
        }

        if not action_map.get(action, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: {action} not allowed for {module_key}",
            )

        return current_user

    return _check

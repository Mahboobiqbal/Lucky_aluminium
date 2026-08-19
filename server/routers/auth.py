from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, UserResponse
from utils.auth import create_access_token, hash_password, verify_password
from utils.deps import get_current_user
from utils.rate_limit import check_rate_limit, record_failed_attempt, clear_failed_attempts

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_rate_limit(request)

    result = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.username))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        record_failed_attempt(request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(data={"sub": str(user.id), "role": user.role})

    clear_failed_attempts(request)

    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            fullName=user.full_name,
            username=user.username,
            email=user.email,
            phone=user.phone,
            status=user.status,
            role=user.role,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        fullName=current_user.full_name,
        username=current_user.username,
        email=current_user.email,
        phone=current_user.phone,
        status=current_user.status,
        role=current_user.role,
    )


@router.put("/password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    if not verify_password(body.currentPassword, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.newPassword) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")

    current_user.password_hash = hash_password(body.newPassword)

    from utils.auth import revoke_token
    revoke_token(credentials.credentials)

    await db.commit()
    return {"message": "Password updated", "success": True}

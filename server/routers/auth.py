from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User, UserPermission
from schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, SignupRequest, UserResponse
from utils.auth import create_access_token, hash_password, verify_password
from utils.dates import naive
from utils.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

MODULES = [
    "dashboard", "customers", "quotations", "orders", "invoices",
    "payments", "paymentReceipts", "purchase", "suppliers", "products",
    "measurements", "inventory", "expenses", "reports",
    "dailyPaymentStatement", "settings", "backup",
]


@router.post("/signup", response_model=LoginResponse)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Only admin and manager roles allowed
    if body.role not in ("admin", "manager"):
        raise HTTPException(status_code=400, detail="Only admin and manager roles are allowed")

    # Check if any user exists — first user becomes admin
    result = await db.execute(select(User))
    first_user = result.scalars().first() is None

    # Check unique username
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    # Check unique email
    existing_email = await db.execute(select(User).where(User.email == body.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    # First user is always admin, subsequent users get requested role
    role = "admin" if first_user else body.role

    user = User(
        full_name=body.fullName,
        username=body.username,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        status="active",
        role=role,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    await db.flush()

    # Grant default permissions for all modules
    for mod in MODULES:
        db.add(UserPermission(
            user_id=user.id,
            module_key=mod,
            can_view=True,
            can_create=True,
            can_edit=True,
            can_delete=True,
            can_print=True,
            can_export=True,
        ))

    await db.commit()

    token = create_access_token(data={"sub": str(user.id), "role": user.role})

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


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.username))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(data={"sub": str(user.id), "role": user.role})

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
):
    if not verify_password(body.currentPassword, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.newPassword) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")

    current_user.password_hash = hash_password(body.newPassword)
    await db.commit()
    return {"message": "Password updated", "success": True}

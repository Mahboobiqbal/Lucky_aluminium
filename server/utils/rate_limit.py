import time
from collections import defaultdict
from fastapi import HTTPException, Request

_failed_attempts: dict[str, list[float]] = defaultdict(list)

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 900


def check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _failed_attempts[ip] = [t for t in _failed_attempts[ip] if now - t < WINDOW_SECONDS]
    if len(_failed_attempts[ip]) >= MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later.",
        )


def record_failed_attempt(request: Request):
    ip = request.client.host if request.client else "unknown"
    _failed_attempts[ip].append(time.time())


def clear_failed_attempts(request: Request):
    ip = request.client.host if request.client else "unknown"
    _failed_attempts.pop(ip, None)

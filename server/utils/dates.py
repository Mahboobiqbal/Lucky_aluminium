from datetime import datetime


def naive(dt: datetime | None) -> datetime | None:
    """Strip timezone info from a datetime to make it naive for PostgreSQL."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt

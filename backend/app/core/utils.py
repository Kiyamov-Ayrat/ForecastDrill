from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(dt: datetime) -> datetime:
    """Приводит время из БД к aware-формату (UTC)."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
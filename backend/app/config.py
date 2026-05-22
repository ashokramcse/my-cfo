from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional
import sys


class Settings(BaseSettings):
    # App
    app_name: str = "My CFO"
    environment: str = "production"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://ccbill:CHANGE_ME_postgres_password@postgres:5432/ccbill"
    sync_database_url: str = "postgresql://ccbill:CHANGE_ME_postgres_password@postgres:5432/ccbill"

    # Redis
    redis_url: str = "redis://:CHANGE_ME_redis_password@redis:6379/0"

    # Security
    secret_key: str = "change_me_in_production"
    encryption_key: str = "CHANGE_ME_must_be_32bytes_exactly"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    refresh_token_expire_days: int = 30

    # File Storage
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 50

    # Optional AI
    ollama_base_url: Optional[str] = None
    ollama_model: str = "llama3.2"

    # Optional SMTP
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    smtp_from: str = "ccbill@localhost"

    # Optional Twilio
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_whatsapp_from: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_settings(s: Settings) -> None:
    errors = []
    if s.secret_key in ("change_me_in_production", "change_me_generate_with_openssl_rand_hex_32"):
        errors.append("SECRET_KEY must be changed from the default value")
    enc_bytes = s.encryption_key.encode("utf-8")
    if len(enc_bytes) != 32:
        errors.append(f"ENCRYPTION_KEY must be exactly 32 bytes, got {len(enc_bytes)} bytes")
    if errors and s.environment == "production":
        for e in errors:
            print(f"[FATAL CONFIG ERROR] {e}", file=sys.stderr)
        sys.exit(1)
    elif errors:
        for e in errors:
            print(f"[CONFIG WARNING] {e}", file=sys.stderr)


settings = get_settings()
validate_settings(settings)

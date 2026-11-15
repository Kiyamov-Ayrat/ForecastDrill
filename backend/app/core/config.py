from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://forecast:forecast_pass@db:5432/forecastdrill"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    max_login_attempts: int = 5
    lock_minutes: int = 15
    cors_origins: list[str] = ["http://localhost:8080"]
    seed_demo_data: bool = True
    risk_interval_seconds: float = 2.0
    simulation_mode: str = "rare"          # none | rare | frequent | manual
    simulation_seed: int | None = None     # для воспроизводимых демонстраций
    simulation_api_enabled: bool = True    # в промышленной версии: false
    predictor: str = "telemetry"           # telemetry | random
    tick_seconds: float = 1.0
    predict_every_ticks: int = 2
    telemetry_retention_hours: int = 6


settings = Settings()
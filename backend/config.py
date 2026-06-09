from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rate_per_hour: float = 2.50
    camera_source: str = "0"
    capture_interval: int = 3
    min_confidence: float = 0.6
    database_url: str = "sqlite:///./parking.db"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

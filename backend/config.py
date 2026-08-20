from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    rate_per_hour: float = 2.50
    camera_source: str = ""
    camera_user: str = ""
    camera_pass: str = ""
    capture_interval: int = 2
    min_confidence: float = 0.45
    database_url: str = "sqlite:///./parking.db"
    printer_name: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

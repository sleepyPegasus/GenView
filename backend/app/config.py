from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/genview"
    openrouter_api_key: str = ""
    default_model: str = "anthropic/claude-sonnet-4-20250514"
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/genview"
    openrouter_api_key: str = ""
    default_model: str = "google/gemini-3.1-pro-preview"
    cors_origins: list[str] = ["http://localhost:3000"]
    frontend_url: str = "http://localhost:3000"
    # 保留最近 N 轮对话发送给模型，0 表示不限制
    chat_max_rounds: int = 20

    # MemOS Cloud 记忆服务 (https://github.com/MemTensor/MemOS)
    memos_api_key: str = ""
    memos_base_url: str = "https://memos.memtensor.cn/api/openmem/v1"
    memos_enabled: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

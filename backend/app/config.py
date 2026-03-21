from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/genview"
    openrouter_api_key: str = ""
    default_model: str = "google/gemini-3.1-pro-preview"
    cors_origins: list[str] = ["http://localhost:3000"]
    frontend_url: str = "http://localhost:3000"
    # 保留最近 N 轮对话发送给模型，0 表示不限制（减少可降低 token 消耗）
    chat_max_rounds: int = 8

    # MemOS Cloud 记忆服务 (https://github.com/MemTensor/MemOS)
    memos_api_key: str = ""
    memos_base_url: str = "https://memos.memtensor.cn/api/openmem/v1"
    memos_enabled: bool = False

    # LightRAG 知识图谱
    lightrag_working_dir: str = "./data/lightrag"
    neo4j_uri: str = ""
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.openai.com/v1"
    # LightRAG 本地模式（Ollama，不消耗 API token）
    lightrag_use_local: bool = False
    lightrag_ollama_host: str = "http://localhost:11434"
    lightrag_ollama_llm: str = "qwen2.5:7b"
    lightrag_ollama_embed: str = "nomic-embed-text"
    lightrag_ollama_embed_dim: int = 768  # 768|1024|1536，需与模型输出一致
    # Qwen3.5 等 thinking 模型：False 关闭 thinking 以加速，True 启用推理链
    lightrag_ollama_think: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

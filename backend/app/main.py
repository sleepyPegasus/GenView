import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import chat, conversations, knowledge, models_router, pages, projects, timeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="GenView API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(knowledge.router)
app.include_router(timeline.router)
app.include_router(pages.router)
app.include_router(conversations.router)
app.include_router(models_router.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}

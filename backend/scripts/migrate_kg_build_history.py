#!/usr/bin/env python3
"""One-off migration: add missing columns to kg_build_history table."""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        for col, typ in [
            ("msg_count", "INTEGER DEFAULT 0"),
            ("page_count", "INTEGER DEFAULT 0"),
            ("timeline_count", "INTEGER DEFAULT 0"),
            ("node_count", "INTEGER"),
            ("edge_count", "INTEGER"),
            ("duration_seconds", "DOUBLE PRECISION"),
        ]:
            await conn.execute(
                text(f"ALTER TABLE kg_build_history ADD COLUMN IF NOT EXISTS {col} {typ}")
            )
            print(f"  + {col}")


if __name__ == "__main__":
    print("Migrating kg_build_history...")
    asyncio.run(migrate())
    print("Done.")

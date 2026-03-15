#!/usr/bin/env python3
"""
Migration: Add deleted_at column for project soft delete.
Run: python -m scripts.migrate_project_deleted_at
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(
                text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL")
            )
            print("Added projects.deleted_at")
        except Exception as e:
            print(f"deleted_at: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

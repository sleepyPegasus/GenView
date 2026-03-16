#!/usr/bin/env python3
"""
Migration: Add kg_model column to projects table.
Run: python -m scripts.migrate_project_kg_model
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
                text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS kg_model VARCHAR(100) DEFAULT NULL")
            )
            print("Added projects.kg_model")
        except Exception as e:
            print(f"Column kg_model: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

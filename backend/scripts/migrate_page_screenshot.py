#!/usr/bin/env python3
"""
Migration: Add screenshot_blob column to pages table.
Run: python -m scripts.migrate_page_screenshot
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
            await conn.execute(text(
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS screenshot_blob BYTEA"
            ))
            print("Added pages.screenshot_blob")
        except Exception as e:
            print(f"screenshot_blob: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

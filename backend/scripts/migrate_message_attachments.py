#!/usr/bin/env python3
"""
Migration: Add attachments column to messages.
Run: python -m scripts.migrate_message_attachments
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
                "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB"
            ))
            print("Added messages.attachments")
        except Exception as e:
            print(f"attachments: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

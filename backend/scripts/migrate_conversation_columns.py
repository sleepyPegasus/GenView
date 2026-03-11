#!/usr/bin/env python3
"""
Migration: Add conversation-level settings columns.
Run: python -m scripts.migrate_conversation_columns
"""
import asyncio
import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Extend logo_url to TEXT for base64 data URLs (PNG upload)
        try:
            await conn.execute(text(
                "ALTER TABLE conversations ALTER COLUMN logo_url TYPE TEXT"
            ))
            print("Extended conversations.logo_url to TEXT")
        except Exception as e:
            print(f"logo_url alter: {e}")

        # Add new columns if they don't exist (PostgreSQL)
        for col, typ, default in [
            ("app_name", "VARCHAR(200)", "'GenView Dashboard'"),
            ("logo_url", "TEXT", "''"),
            ("nav_layout", "VARCHAR(20)", "'side'"),
            ("theme", "VARCHAR(50)", "'modern-b2b'"),
            ("custom_theme", "JSONB", "NULL"),
            ("model", "VARCHAR(100)", "'google/gemini-3.1-pro-preview'"),
            ("conversation_mode", "VARCHAR(20)", "'agent'"),
            ("nav_background_color", "VARCHAR(30)", "NULL"),
            ("app_name_font_size", "VARCHAR(20)", "NULL"),
            ("app_name_color", "VARCHAR(30)", "NULL"),
            ("nav_menu_items", "JSONB", "NULL"),
        ]:
            try:
                await conn.execute(
                    text(
                        f"ALTER TABLE conversations ADD COLUMN IF NOT EXISTS {col} {typ} DEFAULT {default}"
                    )
                )
            except Exception as e:
                print(f"Column {col}: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

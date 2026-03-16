#!/usr/bin/env python3
"""Add session_id and query_mode columns to kg_query_messages table."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Add session_id column (nullable, FK to kg_query_sessions)
        await conn.execute(
            text(
                "ALTER TABLE kg_query_messages ADD COLUMN IF NOT EXISTS session_id VARCHAR(30)"
            )
        )
        print("  + session_id")

        # Add query_mode column
        await conn.execute(
            text(
                "ALTER TABLE kg_query_messages ADD COLUMN IF NOT EXISTS query_mode VARCHAR(20)"
            )
        )
        print("  + query_mode")

        # Add FK constraint if not exists
        try:
            await conn.execute(
                text(
                    "ALTER TABLE kg_query_messages ADD CONSTRAINT fk_kg_query_messages_session "
                    "FOREIGN KEY (session_id) REFERENCES kg_query_sessions(id) ON DELETE CASCADE"
                )
            )
            print("  + FK session_id -> kg_query_sessions")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  FK constraint already exists")
            else:
                raise

        # Create index on session_id
        try:
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_kg_query_messages_session_id "
                    "ON kg_query_messages (session_id)"
                )
            )
            print("  + index ix_kg_query_messages_session_id")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("  Index already exists")
            else:
                raise

    print("Migration complete.")


if __name__ == "__main__":
    print("Migrating kg_query_messages...")
    asyncio.run(migrate())
    print("Done.")

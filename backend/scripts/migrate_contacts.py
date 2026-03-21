#!/usr/bin/env python3
"""
Migration: Create contacts table and add participant_contact_ids to project_timeline_events.
Run: python -m scripts.migrate_contacts
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS contacts (
                id VARCHAR(30) PRIMARY KEY,
                customer_id VARCHAR(30) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                name VARCHAR(200) NOT NULL,
                role VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(200),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        print("Created contacts table")

        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_contacts_customer_id ON contacts(customer_id)"
        ))
        print("Created ix_contacts_customer_id index")

        try:
            await conn.execute(text(
                "ALTER TABLE project_timeline_events ADD COLUMN IF NOT EXISTS participant_contact_ids JSONB"
            ))
            print("Added project_timeline_events.participant_contact_ids")
        except Exception as e:
            print(f"participant_contact_ids: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

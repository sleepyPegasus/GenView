#!/usr/bin/env python3
"""
Migration: Create customers table and add customer_id to projects.
Run: python -m scripts.migrate_customers
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Create customers table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(30) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                code VARCHAR(50),
                contact VARCHAR(200),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        print("Created customers table")

        # Add customer_id to projects
        try:
            await conn.execute(text(
                "ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id VARCHAR(30) REFERENCES customers(id) ON DELETE SET NULL"
            ))
            print("Added projects.customer_id")
        except Exception as e:
            print(f"customer_id: {e}")
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

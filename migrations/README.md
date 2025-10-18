# Database Migrations

## Running Migrations

To apply the Braze integration migration, run the SQL file against your Supabase database:

```bash
psql $POSTGRES_URL -f migrations/add_braze_fields.sql
```

Or execute the SQL directly in the Supabase SQL Editor.

## Migration: add_braze_fields.sql

This migration:
- Adds `brand_instance_url` column to store sanitized Braze instance URLs
- Adds `created_at` and `updated_at` timestamp columns
- Enables the `pgcrypto` extension for API key encryption
- Renames `braze_instance_url` to `brand_instance_url` if it exists

## Environment Variables

Make sure to set a secure `ENC_KEY` in your `.env` file for encrypting API keys.

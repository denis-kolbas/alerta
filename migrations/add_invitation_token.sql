-- Add token column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token VARCHAR(255) UNIQUE;

-- Generate tokens for existing invitations (if any)
UPDATE invitations SET token = encode(gen_random_bytes(32), 'hex') WHERE token IS NULL;

-- Make token NOT NULL after populating existing rows
ALTER TABLE invitations ALTER COLUMN token SET NOT NULL;

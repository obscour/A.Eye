-- Create audit_logs table for tracking user activities
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity TEXT NOT NULL,
    details TEXT DEFAULT '',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Create index on timestamp for faster sorting
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to read/write (for API access)
-- This allows your Vercel serverless functions to access the table
CREATE POLICY "Allow service role full access" ON public.audit_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Optional: Create policy to allow users to read their own logs
-- Uncomment if you want users to access their own audit logs directly
-- CREATE POLICY "Users can view their own logs" ON public.audit_logs
--     FOR SELECT
--     USING (auth.uid()::text = user_id::text);

-- ============================================
-- EMAIL VERIFICATION TOKENS TABLE
-- ============================================
-- Create email_verification_tokens table for email verification
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at);

-- Enable Row Level Security
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access" ON public.email_verification_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================
-- Create password_reset_tokens table for secure password reset
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

-- Create index on expires_at to clean up expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Enable Row Level Security
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access" ON public.password_reset_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Function to automatically clean up expired tokens (optional, can be run periodically)
-- You can set up a cron job or scheduled function to run this
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.password_reset_tokens
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USERS TABLE - Add missing columns if they don't exist
-- ============================================
-- Add email_verified column to track email verification status
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Add created_at column to track when accounts were created
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- To check what columns exist in the users table, you can run:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'users' 
-- ORDER BY ordinal_position;
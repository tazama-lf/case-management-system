-- =============================================================================
-- Database Initialization Script for Tazama Case Management System
-- =============================================================================

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better performance
DO $$
BEGIN
    -- Create indexes for frequently queried columns
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_tenant_id') THEN
        CREATE INDEX CONCURRENTLY idx_alerts_tenant_id ON alerts(tenant_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_created_at') THEN
        CREATE INDEX CONCURRENTLY idx_alerts_created_at ON alerts(created_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alerts_priority') THEN
        CREATE INDEX CONCURRENTLY idx_alerts_priority ON alerts(priority);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cases_tenant_id') THEN
        CREATE INDEX CONCURRENTLY idx_cases_tenant_id ON cases(tenant_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cases_status') THEN
        CREATE INDEX CONCURRENTLY idx_cases_status ON cases(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_log_user_id') THEN
        CREATE INDEX CONCURRENTLY idx_audit_log_user_id ON audit_log(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_log_performed_at') THEN
        CREATE INDEX CONCURRENTLY idx_audit_log_performed_at ON audit_log(performed_at);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating indexes: %', SQLERRM;
END $$;

-- Create a health check function
CREATE OR REPLACE FUNCTION health_check() 
RETURNS TABLE(status TEXT, timestamp TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY SELECT 'healthy'::TEXT, NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Set default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgres;

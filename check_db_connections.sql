-- Check active database connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC;

-- Count connections by state
SELECT 
    state,
    COUNT(*) as count
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- Kill idle connections (run this if needed)
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
--   AND state = 'idle'
--   AND pid != pg_backend_pid();

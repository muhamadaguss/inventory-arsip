CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_cases_fuzzy ON court_cases USING gin (parties_involved gin_trgm_ops);
CREATE INDEX idx_cases_number_clean ON court_cases USING gin (case_number_clean gin_trgm_ops);
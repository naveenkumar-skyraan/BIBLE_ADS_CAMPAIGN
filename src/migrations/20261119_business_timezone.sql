-- Stores the IANA timezone resolved from each business's physical location.
-- Existing rows are populated lazily by the dashboard API on first request.
ALTER TABLE business_details
  ADD COLUMN timezone VARCHAR(64) NULL
  AFTER country_code;

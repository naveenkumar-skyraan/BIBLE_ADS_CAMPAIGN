-- Cancellation reason master data + stable reason_id relationship.
-- Run this migration once before deploying the updated backend.
-- Existing reason_code values are mapped to fixed IDs. The legacy
-- reason_code column is retained as nullable for historical compatibility;
-- new application writes use reason_id only.

CREATE TABLE IF NOT EXISTS ad_cancellation_reasons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reason_text VARCHAR(255) NOT NULL,
  requires_other TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ad_cancellation_reasons_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- These IDs are part of the mobile API contract. Do not reuse or renumber them.
INSERT INTO ad_cancellation_reasons
  (id, reason_text, requires_other, sort_order, is_active)
VALUES
  (1, 'Campaign is no longer needed', 0, 1, 1),
  (2, 'Campaign goal has been achieved', 0, 2, 1),
  (3, 'I want to create a new campaign', 0, 3, 1),
  (4, 'Ad performance is not as expected', 0, 4, 1),
  (5, 'I want to change the ad details', 0, 5, 1),
  (6, 'Budget or spending concerns', 0, 6, 1),
  (7, 'I am facing an issue with the campaign', 0, 7, 1),
  (8, 'Other', 1, 8, 1)
ON DUPLICATE KEY UPDATE
  reason_text = VALUES(reason_text),
  requires_other = VALUES(requires_other),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

-- The supplied schema has reason_code VARCHAR(50) NOT NULL and does not yet
-- have reason_id. This ALTER is intentionally a one-time migration step.
ALTER TABLE ad_campaign_cancellations
  ADD COLUMN reason_id BIGINT UNSIGNED NULL AFTER user_id,
  MODIFY COLUMN reason_code VARCHAR(50) NULL DEFAULT NULL;

-- Backfill all existing cancellation rows while retaining their old reason_code.
UPDATE ad_campaign_cancellations
SET reason_id = CASE reason_code
  WHEN 'no_longer_needed' THEN 1
  WHEN 'goal_achieved' THEN 2
  WHEN 'create_new_campaign' THEN 3
  WHEN 'poor_performance' THEN 4
  WHEN 'change_ad_details' THEN 5
  WHEN 'budget_concerns' THEN 6
  WHEN 'campaign_issue' THEN 7
  WHEN 'other' THEN 8
  ELSE 8
END
WHERE reason_id IS NULL;

ALTER TABLE ad_campaign_cancellations
  MODIFY COLUMN reason_id BIGINT UNSIGNED NOT NULL,
  ADD INDEX idx_ad_campaign_cancellations_reason_id (reason_id),
  ADD CONSTRAINT fk_ad_campaign_cancellations_reason
    FOREIGN KEY (reason_id)
    REFERENCES ad_cancellation_reasons (id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT;

-- After migration, keep reason_code as nullable legacy data. The API no longer
-- accepts or inserts reason_code. It can be dropped in a separate cleanup after
-- confirming no external report or admin query still depends on it.

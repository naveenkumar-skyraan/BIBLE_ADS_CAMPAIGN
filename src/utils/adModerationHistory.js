/**
 * Determines whether an analytics interval overlaps an ad's moderation block
 * window. `events` must be ordered chronologically (created_at, then id).
 * A block remains open until a later approval; resubmission/rejection events
 * do not reopen or close that block window.
 */
export const inspectModerationInterval = (events, intervalStart, intervalEnd) => {
  const start = Number(intervalStart);
  const end = Number(intervalEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) {
    throw new Error("Invalid analytics interval for moderation validation.");
  }

  let moderationStartedAt = null;
  let overlaps = false;

  for (const event of events) {
    const eventTimestamp = Number(event.event_timestamp);
    if (!Number.isSafeInteger(eventTimestamp) || eventTimestamp <= 0) continue;

    if (event.event_type === "blocked") {
      // Repeated block events do not reset an already-open moderation window.
      if (moderationStartedAt === null) moderationStartedAt = eventTimestamp;
      continue;
    }

    if (event.event_type === "approved" && moderationStartedAt !== null) {
      // Block interval is [blocked_at, approved_at).
      if (moderationStartedAt < end && eventTimestamp > start) {
        overlaps = true;
        moderationStartedAt = null;
        break;
      }
      moderationStartedAt = null;
    }
  }

  if (!overlaps && moderationStartedAt !== null && moderationStartedAt < end) {
    overlaps = true;
  }

  return {
    overlaps,
    hasOpenModeration: moderationStartedAt !== null,
  };
};

import test from "node:test";
import assert from "node:assert/strict";
import { inspectModerationInterval } from "../utils/adModerationHistory.js";

const event = (event_type, event_timestamp) => ({ event_type, event_timestamp });

test("approval closes a previous block before a later analytics interval", () => {
  const result = inspectModerationInterval(
    [event("blocked", 100), event("resubmitted", 110), event("approved", 120)],
    120,
    130,
  );
  assert.deepEqual(result, { overlaps: false, hasOpenModeration: false });
});

test("analytics interval overlapping a block-to-approval window is rejected", () => {
  const result = inspectModerationInterval(
    [event("blocked", 100), event("approved", 120)],
    105,
    115,
  );
  assert.deepEqual(result, { overlaps: true, hasOpenModeration: false });
});

test("duplicate block events do not move the start of an open block window", () => {
  const result = inspectModerationInterval(
    [event("blocked", 100), event("blocked", 110), event("approved", 120)],
    102,
    108,
  );
  assert.deepEqual(result, { overlaps: true, hasOpenModeration: false });
});

test("an unresolved block remains open and rejects later analytics", () => {
  const result = inspectModerationInterval(
    [event("blocked", 100), event("resubmitted", 110), event("rejected", 120)],
    130,
    140,
  );
  assert.deepEqual(result, { overlaps: true, hasOpenModeration: true });
});

test("a later block after approval opens a new moderation window", () => {
  const result = inspectModerationInterval(
    [event("blocked", 100), event("approved", 110), event("blocked", 130)],
    135,
    145,
  );
  assert.deepEqual(result, { overlaps: true, hasOpenModeration: true });
});

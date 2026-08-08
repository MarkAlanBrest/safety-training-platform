import assert from "node:assert/strict";
import {
  formatScormNarrationDocument,
  parseScormNarrationDocument,
} from "./scorm-narration-document";

const sample = `=== 1 ===
Welcome to ladder safety.

=== page-2 ===
Inspect the feet and rungs before climbing.`;

const cues = parseScormNarrationDocument(sample);
assert.equal(cues.length, 2);
assert.equal(cues[0]?.location, "1");
assert.match(cues[1]?.text || "", /Inspect the feet/);

const roundTrip = parseScormNarrationDocument(formatScormNarrationDocument(cues));
assert.equal(roundTrip.length, 2);
assert.equal(roundTrip[1]?.location, "page-2");

console.log("scorm-narration-document tests passed");

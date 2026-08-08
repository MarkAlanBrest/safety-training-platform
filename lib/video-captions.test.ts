import assert from "node:assert/strict";
import {
  findCueIndexAtTime,
  narrationStateAtTime,
  parseWebVtt,
} from "./video-captions";

const sample = `WEBVTT

00:00:00.000 --> 00:00:04.000
Welcome to ladder safety.

00:00:04.000 --> 00:00:09.500
Inspect the feet, rungs, and spreaders.

1:00.000 --> 1:05.000
Set the ladder at the correct angle.
`;

const cues = parseWebVtt(sample);
assert.equal(cues.length, 3);
assert.equal(cues[0]?.text, "Welcome to ladder safety.");
assert.equal(cues[1]?.startSeconds, 4);
assert.equal(cues[2]?.startSeconds, 60);

assert.equal(findCueIndexAtTime(cues, 0), 0);
assert.equal(findCueIndexAtTime(cues, 4.2), 1);
assert.equal(findCueIndexAtTime(cues, 62), 2);

const state = narrationStateAtTime(cues, 5);
assert.deepEqual(state.history, ["Welcome to ladder safety."]);
assert.equal(state.liveNarration, "Inspect the feet, rungs, and spreaders.");

console.log("video-captions tests passed");

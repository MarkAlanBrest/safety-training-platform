import assert from "node:assert/strict";
import {
  buildTranscriptMinuteSegments,
  minuteMarkerAnchors,
  transcriptTextForWindow,
} from "./video-marker-generator";
import { parseWebVtt } from "./video-captions";
import { resolveVideoCourseMarkers, type VideoCourseConfig } from "./classroom-video";

const sample = `WEBVTT

00:00:00.000 --> 00:00:04.000
Welcome to ladder safety.

00:00:04.000 --> 00:00:09.500
Inspect the feet, rungs, and spreaders.

1:00.000 --> 1:05.000
Set the ladder at the correct angle.

2:00.000 --> 2:08.000
Maintain three points of contact.
`;

const cues = parseWebVtt(sample);

assert.deepEqual(minuteMarkerAnchors(180), [60, 120]);
assert.deepEqual(minuteMarkerAnchors(45), []);

assert.equal(
  transcriptTextForWindow(cues, 0, 60),
  "Welcome to ladder safety. Inspect the feet, rungs, and spreaders.",
);
assert.equal(transcriptTextForWindow(cues, 60, 120), "Set the ladder at the correct angle.");

const segments = buildTranscriptMinuteSegments(cues, 180);
assert.equal(segments.length, 2);
assert.equal(segments[0]?.atSeconds, 60);
assert.equal(segments[1]?.atSeconds, 120);
assert.match(segments[1]?.text || "", /correct angle/);

const videoCourse: VideoCourseConfig = {
  videoAssetPath: "classroom/media/video-1",
  chapters: [],
  markers: [{ id: "draft", atSeconds: 60, kind: "ai_say", aiScript: "Draft only" }],
  publishedMarkers: [{ id: "live", atSeconds: 60, kind: "ai_say", aiScript: "Live marker" }],
  activitiesPublished: true,
};
assert.equal(resolveVideoCourseMarkers(videoCourse).length, 1);
assert.equal(resolveVideoCourseMarkers(videoCourse)[0]?.id, "live");
assert.equal(resolveVideoCourseMarkers(videoCourse, { previewDraft: true })[0]?.id, "draft");
assert.equal(
  resolveVideoCourseMarkers({ ...videoCourse, activitiesPublished: false }).length,
  0,
);

console.log("video-marker-generator tests passed");

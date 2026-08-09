# Example SCORM package

Minimal SCORM 1.2 package for testing upload, preview, and AI narration.

## Files

| File | Purpose |
|------|---------|
| `ladder-safety/` | Source files for the example course |
| `ladder-safety.zip` | Ready-to-upload ZIP (generated) |
| `ladder-safety/narration-script.example.txt` | Sample narration cues matching each page location (legacy — see below) |

## AI narration marker (recommended)

The training app plays the SCORM package full-screen and reads each screen's
text aloud automatically — no separate script file needed. Mark the element
whose text should be spoken with `id="ai-narration"` (one element) or the
`data-ai-narration` attribute (repeatable, e.g. one per slide/section). Only
the *visible* marked element's text is read, so put the attribute directly on
each slide's content:

```html
<section class="slide active" data-ai-narration>
  <h2>Welcome</h2>
  <p>This text is read aloud while the section is visible.</p>
</section>
```

As the learner navigates and a different marked element becomes visible, the
app reads its text instead. See `ladder-safety/index.html` for a working
example.

## Locations

The example course also sets `cmi.core.lesson_location` as learners move
through pages, for progress tracking:

| Location | Page |
|----------|------|
| `intro` | Welcome |
| `inspection` | Inspection checklist |
| `setup` | Ladder angle and securing |
| `climbing` | Safe climbing rules |

## Legacy: narration-script.txt

Older courses can instead ship a `narration-script.txt` and author cues in
the admin narration editor, matched to `cmi.core.lesson_location` values.
This still works but requires location values that are stable and readable,
which many authoring tools don't produce — the `data-ai-narration` marker
above is more reliable and works with any package.

## Upload

1. Admin → **Upload SCORM**
2. Choose `ladder-safety.zip`
3. Open the course to preview narration

## Rebuild the ZIP

```bash
cd examples/scorm/ladder-safety && zip -r ../ladder-safety.zip imsmanifest.xml index.html
```

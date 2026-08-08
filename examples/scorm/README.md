# Example SCORM package

Minimal SCORM 1.2 package for testing upload, preview, and the narration script editor.

## Files

| File | Purpose |
|------|---------|
| `ladder-safety/` | Source files for the example course |
| `ladder-safety.zip` | Ready-to-upload ZIP (generated) |
| `ladder-safety/narration-script.example.txt` | Sample narration cues matching each page location |

## Locations

The example course sets `cmi.core.lesson_location` as learners move through pages:

| Location | Page |
|----------|------|
| `intro` | Welcome |
| `inspection` | Inspection checklist |
| `setup` | Ladder angle and securing |
| `climbing` | Safe climbing rules |

## Upload

1. Admin → **Upload SCORM**
2. Choose `ladder-safety.zip`
3. Open the course → **Edit narration script**
4. Paste cues from `narration-script.example.txt` (Bulk edit) or add them manually while clicking through the preview

## Rebuild the ZIP

```bash
cd examples/scorm/ladder-safety && zip -r ../ladder-safety.zip imsmanifest.xml index.html
```

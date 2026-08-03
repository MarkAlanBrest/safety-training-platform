import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { attachPptxVisuals } from "../lib/ppt-visuals.mjs";

function buildMiniPptx(options: {
  slideXml: string;
  relXml: string;
  media?: { path: string; bytes: Uint8Array };
}) {
  const files: Record<string, Uint8Array> = {
    "ppt/slides/slide1.xml": new TextEncoder().encode(options.slideXml),
    "ppt/slides/_rels/slide1.xml.rels": new TextEncoder().encode(options.relXml),
    "[Content_Types].xml": new TextEncoder().encode("<Types></Types>"),
  };
  if (options.media) {
    files[options.media.path] = options.media.bytes;
  }
  return zipSync(files);
}

function lessonPlanWithVisual(pageNumber: number | null = null) {
  return {
    sectionTitle: "Test",
    opening: "Open",
    objectives: ["Learn"],
    summary: "Done",
    keyFacts: ["Fact"],
    moments: [
      {
        kind: "visual" as const,
        phase: "learn" as const,
        title: "Test visual",
        narration: "Look at the diagram.",
        prompt: null,
        choices: null,
        correctAnswer: null,
        feedback: null,
        pageNumber,
        cue: null,
        visualAction: "spotlight" as const,
        focusX: 50,
        focusY: 50,
        focusScale: 1.35,
        visualType: "sequence" as const,
        visualItems: ["One", "Two"],
        explainerStyle: "flipbook" as const,
        explainerFrames: [
          {
            title: "One",
            caption: "First area",
            narration: "Notice the first area.",
            visualItems: ["Area"],
            focusX: 30,
            focusY: 40,
            focusScale: 1.4,
          },
          {
            title: "Two",
            caption: "Second area",
            narration: "Now the second area.",
            visualItems: ["Area"],
            focusX: 70,
            focusY: 60,
            focusScale: 1.5,
          },
        ],
      },
    ],
  };
}

async function testAttachPptxVisuals() {
  const slideXml =
    '<p:sld><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>';
  const relXml =
    '<Relationships><Relationship Id="rId2" Type="image" Target="../media/image1.png"/></Relationships>';

  const pngHeader = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
    0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
    0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
    0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d,
    0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
    0x60, 0x82,
  ]);
  const paddedPng = new Uint8Array(9 * 1024);
  paddedPng.set(pngHeader);

  const pptx = buildMiniPptx({
    slideXml,
    relXml,
    media: { path: "ppt/media/image1.png", bytes: paddedPng },
  });

  const before = lessonPlanWithVisual(1);
  const after = await attachPptxVisuals(pptx, before);
  const visual = after.moments[0];
  assert.equal(visual.kind, "visual");
  assert.ok(
    visual.explainerFrames?.[0]?.sourceImage?.startsWith("data:image/jpeg;base64,"),
    "visual frames should receive cropped JPEG data URLs from the slide image",
  );
}

async function run() {
  await testAttachPptxVisuals();
  console.log("ppt-visuals tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

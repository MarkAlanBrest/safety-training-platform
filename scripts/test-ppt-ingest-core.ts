import assert from "node:assert/strict";
import { extractText, parsePptxBuffer } from "../lib/ppt-ingest-core";
import { zipSync } from "fflate";

function buildMiniPptx(options: {
  slideXml: string;
  relXml: string;
  media?: { path: string; bytes: Uint8Array };
  diagramXml?: string;
}) {
  const files: Record<string, Uint8Array> = {
    "ppt/slides/slide1.xml": new TextEncoder().encode(options.slideXml),
    "ppt/slides/_rels/slide1.xml.rels": new TextEncoder().encode(options.relXml),
    "[Content_Types].xml": new TextEncoder().encode("<Types></Types>"),
  };
  if (options.media) {
    files[options.media.path] = options.media.bytes;
  }
  if (options.diagramXml) {
    files["ppt/diagrams/data1.xml"] = new TextEncoder().encode(options.diagramXml);
  }
  return zipSync(files);
}

function testRelationshipParsing() {
  const relXml =
    '<Relationships><Relationship Type="image" Target="../media/image1.png" Id="rId2"/></Relationships>';
  const slideXml =
    '<p:sld><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>';
  const mediaBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const pptx = buildMiniPptx({
    slideXml,
    relXml,
    media: { path: "ppt/media/image1.png", bytes: mediaBytes },
  });
  const slides = parsePptxBuffer(pptx);
  assert.ok(slides[0].image, "relationship attributes in any order should still resolve images");
}

function testExtractTextNamespaces() {
  const xml =
    '<p:sp><a:txBody><a:p><a:r><a:t>Hello</a:t></a:r><a:r><a:t>world</a:t></a:r></a:p></a:txBody></p:sp>';
  assert.equal(extractText(xml), "Hello world");
}

function testAbsoluteMediaPath() {
  const slideXml =
    '<p:sld><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>';
  const relXml =
    '<Relationships><Relationship Id="rId2" Type="image" Target="/ppt/media/image1.png"/></Relationships>';
  const mediaBytes = new Uint8Array([137, 80, 78, 71, 4, 5, 6]);
  const pptx = buildMiniPptx({
    slideXml,
    relXml,
    media: { path: "ppt/media/image1.png", bytes: mediaBytes },
  });
  const slides = parsePptxBuffer(pptx);
  assert.ok(slides[0].image, "absolute media paths should resolve");
}

function testDiagramTextExtraction() {
  const slideXml = "<p:sld><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>";
  const relXml =
    '<Relationships><Relationship Type="diagram" Target="../diagrams/data1.xml" Id="rId3"/></Relationships>';
  const diagramXml =
    '<dgm:dataModel><a:ptList><a:pt><a:t>Step</a:t></a:pt><a:pt><a:t>Two</a:t></a:pt></a:ptList></dgm:dataModel>';
  const pptx = buildMiniPptx({ slideXml, relXml, diagramXml });
  const slides = parsePptxBuffer(pptx);
  assert.equal(slides[0].bodyText, "Step Two");
}

function testSpeakerNotesFallback() {
  const slideXml = "<p:sld><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>";
  const relXml = "<Relationships></Relationships>";
  const files: Record<string, Uint8Array> = {
    "ppt/slides/slide1.xml": new TextEncoder().encode(slideXml),
    "ppt/slides/_rels/slide1.xml.rels": new TextEncoder().encode(relXml),
    "ppt/notesSlides/notesSlide1.xml": new TextEncoder().encode(
      "<p:notes><a:t>Important instructor context for this visual.</a:t></p:notes>",
    ),
    "[Content_Types].xml": new TextEncoder().encode("<Types></Types>"),
  };
  const slides = parsePptxBuffer(zipSync(files));
  assert.equal(slides[0].bodyText, "Important instructor context for this visual.");
}

function run() {
  testRelationshipParsing();
  testExtractTextNamespaces();
  testAbsoluteMediaPath();
  testDiagramTextExtraction();
  testSpeakerNotesFallback();
  console.log("ppt-ingest-core tests passed");
}

run();

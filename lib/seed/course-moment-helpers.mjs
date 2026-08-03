export function base(kind, phase, title, narration, extra = {}) {
  return {
    kind,
    phase,
    title,
    narration,
    prompt: null,
    choices: null,
    correctAnswer: null,
    feedback: null,
    pageNumber: null,
    ...extra,
  };
}

export function explain(title, narration) {
  return base("explain", "learn", title, narration);
}

export function summary(title, narration) {
  return base("summary", "learn", title, narration);
}

export function text(title, narration) {
  return base("text", "learn", title, narration);
}

export function tiles(title, narration, tileList) {
  return base("tiles", "learn", title, narration, { tiles: tileList });
}

export function dragdrop(title, narration, prompt, dragItems, phase = "activity") {
  return base("dragdrop", phase, title, narration, { prompt, dragItems });
}

export function question(title, narration, prompt, choices, correctAnswer, feedback, phase = "activity") {
  return base("question", phase, title, narration, {
    prompt,
    choices,
    correctAnswer,
    feedback,
  });
}

export function scenario(title, narration, prompt, choices, correctAnswer, feedback, phase = "activity") {
  return base("scenario", phase, title, narration, {
    prompt,
    choices,
    correctAnswer,
    feedback,
  });
}

export function visual(
  title,
  narration,
  visualType,
  visualItems,
  frames,
  pageNumber = null,
) {
  return base("visual", "learn", title, narration, {
    cue: null,
    visualAction: "spotlight",
    focusX: 50,
    focusY: 50,
    focusScale: 1.35,
    visualType,
    visualItems,
    pageNumber,
    explainerStyle: "flipbook",
    explainerFrames: frames.map(
      ([frameTitle, caption, frameNarration, labels], index) => ({
        title: frameTitle,
        caption,
        narration: frameNarration,
        visualItems: labels,
        focusX: 20 + (index % 3) * 30,
        focusY: 35 + Math.floor(index / 3) * 25,
        focusScale: 1.4 + index * 0.12,
      }),
    ),
  });
}

export function flashcard(title, narration, cards) {
  return base("flashcard", "learn", title, narration, { flashcards: cards });
}

export function hotspot(title, narration, prompt, image, points) {
  return base("hotspot", "activity", title, narration, {
    prompt,
    sourceImage: image,
    hotspotPoints: points,
  });
}

export function tutor(title, narration, prompt, image, points) {
  return base("tutor", "learn", title, narration, {
    prompt,
    sourceImage: image,
    hotspotPoints: points,
  });
}

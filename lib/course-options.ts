export const courseThemes = [
  {
    id: "heritage",
    name: "Heritage",
    description: "Warm ivory, deep navy, and restrained gold.",
    colors: ["#f5f1e8", "#10283f", "#d9a036"],
  },
  {
    id: "industrial",
    name: "Industrial",
    description: "Graphite, steel, and safety orange.",
    colors: ["#f1f3f4", "#202a32", "#e87524"],
  },
  {
    id: "clean",
    name: "Clean",
    description: "Bright white, slate, and confident blue.",
    colors: ["#ffffff", "#243447", "#3178c6"],
  },
  {
    id: "field",
    name: "Field",
    description: "Soft sand, forest green, and copper.",
    colors: ["#f3efe3", "#244a3b", "#bd7137"],
  },
] as const;

export const courseIntensities = [
  {
    id: "essentials",
    name: "Essentials",
    description: "Direct instruction with fewer examples and activities.",
  },
  {
    id: "standard",
    name: "Standard",
    description: "Balanced reading, explainers, practice, and assessment.",
  },
  {
    id: "comprehensive",
    name: "Comprehensive",
    description: "Deeper explanations, more examples, and rigorous practice.",
  },
] as const;

export const courseTypeLabels: Record<string, { name: string; description: string }> = {
  native: {
    name: "AI course",
    description: "Built with the AI course studio.",
  },
  pdf: {
    name: "PDF course",
    description: "Lessons generated from uploaded PDFs.",
  },
  classroom: {
    name: "PowerPoint narration",
    description: "PowerPoint with exported slide images and AI narration.",
  },
  scorm: {
    name: "SCORM package",
    description: "Imported SCORM 1.2 or 2004 training package.",
  },
  video: {
    name: "Video course",
    description: "YouTube video with timed knowledge checks.",
  },
};

export function courseTypeLabel(courseType: string) {
  return courseTypeLabels[courseType]?.name || courseType;
}

export function isCourseTheme(value: string) {
  return courseThemes.some((theme) => theme.id === value);
}

export function isCourseIntensity(value: string) {
  return courseIntensities.some((intensity) => intensity.id === value);
}

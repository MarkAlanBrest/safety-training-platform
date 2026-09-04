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
  classroom: {
    name: "PowerPoint narration",
    description: "PowerPoint with exported slide images and AI narration.",
  },
  native: {
    name: "Legacy AI course",
    description: "Older course type — no longer created.",
  },
  pdf: {
    name: "Legacy PDF course",
    description: "Older course type — no longer created.",
  },
  scorm: {
    name: "Legacy SCORM",
    description: "Older course type — no longer created.",
  },
  video: {
    name: "Legacy video course",
    description: "Older course type — no longer created.",
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

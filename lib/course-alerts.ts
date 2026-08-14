export function normalizeStudentName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayStudentName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

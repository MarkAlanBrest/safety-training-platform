export function getStudentDisplayName(fullName: string | null | undefined) {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Student";
  return trimmed.split(/\s+/)[0] || "Student";
}

export function buildWelcomeMessage(studentName: string) {
  return `Welcome, ${studentName}`;
}

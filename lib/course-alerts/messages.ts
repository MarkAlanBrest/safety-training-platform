export function renderAlertTemplate(
  template: string | null | undefined,
  fallback: string,
  vars: Record<string, string | number | null | undefined>,
) {
  const source = template?.trim() || fallback;
  return source.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

export function formatAssignmentList(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export const DEFAULT_ALERT_MESSAGES = {
  missing:
    "Alert: {name}, looking back the last {days} days you have missed the following assignments: {assignments}.",
  assignmentLowGrade:
    "Alert: {name}, it looks like you received a low grade for these assignments: {assignments}. Recommend you contact your instructor for details.",
  loginInactivity:
    "Alert: {name}, you have not logged in for {days} or more days. Logging in regularly is important to stay current on your coursework.",
  overallLowGrade:
    "Alert: {name}, your overall grade has fallen below {threshold}% (currently {score}%). Please contact your instructor.",
  dueSoon:
    "Alert: {name}, these assignments are due in the next {hours} hours: {assignments}.",
};

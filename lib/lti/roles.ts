import type { JWTPayload } from "jose";

const LTI_ROLES_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/roles";

const INSTRUCTOR_ROLE_MARKERS = [
  "Instructor",
  "TeachingAssistant",
  "ContentDeveloper",
  "Administrator",
];

export function readLtiRoles(payload: JWTPayload) {
  const roles = payload[LTI_ROLES_CLAIM];
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === "string");
}

export function isInstructorLtiLaunch(payload: JWTPayload) {
  const roles = readLtiRoles(payload);
  return roles.some((role) => INSTRUCTOR_ROLE_MARKERS.some((marker) => role.includes(marker)));
}

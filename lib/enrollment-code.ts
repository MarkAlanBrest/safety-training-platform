export function defaultExpirationDate() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

export function parseExpirationDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return defaultExpirationDate();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T23:59:59.999Z`);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_EXPIRATION");
  }

  return date;
}

export function normalizeEnrollmentCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function isEnrollmentCodeExpired(expiresAt: Date | null | undefined, now = new Date()) {
  return Boolean(expiresAt && expiresAt.getTime() < now.getTime());
}

export type BasicRole = "admin" | "student" | string | null | undefined;

/**
 * Convert stored role values into UI-friendly labels with consistent casing.
 */
export function formatRoleLabel(role: BasicRole, isSuperAdmin = false): string {
  if (isSuperAdmin) return "Super Admin";

  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "student") return "Student";
  if (normalized === "admin-pending") return "Admin (Pending Approval)";
  if (!normalized) return "Student";

  // Fallback for unexpected role strings.
  return normalized
    .split(/\s+/)
    .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : ""))
    .join(" ");
}

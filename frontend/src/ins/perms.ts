// INS authorization helper (mirrors backend authority_can). Frontend hiding is
// convenience only — the backend enforces every action.
export function insCan(perms: string[] | undefined | null, key: string): boolean {
  if (!perms) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(key)) return true;
  const resource = key.split(":")[0];
  return perms.includes(`${resource}:*`);
}

export const STATUS_META: Record<string, { label: string; tone: "pending" | "approved" | "rejected" }> = {
  pending: { label: "Awaiting verification", tone: "pending" },
  approved: { label: "Verified", tone: "approved" },
  rejected: { label: "Not approved", tone: "rejected" },
  suspended: { label: "Suspended", tone: "rejected" },
};

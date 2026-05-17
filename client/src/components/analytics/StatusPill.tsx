import React from "react";

export function statusTone(status: string | undefined) {
  const key = (status || "").toLowerCase();
  if (key === "approved") return "badge-success";
  if (key === "rejected" || key === "declined") return "badge-error";
  if (key === "returned" || key === "completed") return "badge-info";
  if (key === "cancelled") return "badge-neutral";
  if (key === "ongoing") return "badge-primary";
  return "badge-warning";
}

export default function StatusPill({ status }: { status: string | undefined }) {
  const label = (status || "pending").toString();
  return <span className={`badge ${statusTone(label)}`}>{label}</span>;
}


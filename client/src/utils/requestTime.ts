// src/utils/requestTime.ts

export const parseDate = (
  date?: string,
  time?: string,
  fallbackTime = "00:00"
) => {
  if (!date) return null
  const iso = `${date}T${time || fallbackTime}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export const isOngoing = (r: any) => {
  if ((r.status || "").toLowerCase() !== "approved") return false

  const start = parseDate(r.startDate, r.start)
  const end = parseDate(r.endDate, r.end, "23:59")
  if (!start || !end) return false

  const now = new Date()
  return now >= start && now <= end
}

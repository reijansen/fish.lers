/**
 * Utility functions for consistent data formatting across the system
 * Ensures all dates, times, and data appear formatted and user-friendly
 */

/**
 * Format date to readable format: "Feb 17, 2026"
 */
export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

/**
 * Format time to readable format: "7:00 AM"
 */
export const formatTime = (timeStr: string | undefined): string => {
  if (!timeStr) return "";
  try {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes || "0", 10);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
  } catch {
    return timeStr;
  }
};

/**
 * Format datetime to full readable format: "Feb 17, 2026 7:00 AM"
 */
export const formatDateTime = (dateStr: string | undefined, timeStr: string | undefined): string => {
  const date = formatDate(dateStr);
  const time = formatTime(timeStr);
  if (!date) return time || "";
  if (!time) return date;
  return `${date} ${time}`;
};

/**
 * Format date range: "Feb 17 - 21, 2026" or "Feb 17, 2026 to Mar 3, 2026"
 */
export const formatDateRange = (
  startDateStr: string | undefined,
  endDateStr: string | undefined
): string => {
  const startDate = formatDate(startDateStr);
  const endDate = formatDate(endDateStr);

  if (!startDate && !endDate) return "No dates provided";
  if (!endDate || startDate === endDate) return startDate;

  // Check if same month/year for compact format
  try {
    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr + "T00:00:00");
      const end = new Date(endDateStr + "T00:00:00");
      const sameMonth =
        start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

      if (sameMonth) {
        const startDay = start.getDate();
        const endDay = end.getDate();
        const monthYear = start.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        return `${startDay} - ${endDay}, ${monthYear}`;
      }
    }
  } catch {
    // Fall through to default format
  }

  return `${startDate} to ${endDate}`;
};

/**
 * Format schedule with times: "Feb 17, 2026 7:00 AM to Feb 21, 2026 5:30 PM"
 */
export const formatSchedule = (
  startDateStr: string | undefined,
  startTimeStr: string | undefined,
  endDateStr: string | undefined,
  endTimeStr: string | undefined
): string => {
  if (!startDateStr) return "No schedule";

  const startDate = formatDate(startDateStr);
  const startTime = formatTime(startTimeStr);
  const endDate = formatDate(endDateStr);
  const endTime = formatTime(endTimeStr);

  let result = startDate;
  if (startTime) result += ` ${startTime}`;

  if (endDate && endDate !== startDate) {
    result += ` to ${endDate}`;
    if (endTime) result += ` ${endTime}`;
  } else if (endTime && endTime !== startTime) {
    result += ` to ${endTime}`;
  }

  return result;
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number, currency = "PHP"): string => {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format large numbers with commas
 */
export const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return "-";
  return num.toLocaleString("en-US");
};

/**
 * Format percentage
 */
export const formatPercentage = (num: number, decimals = 1): string => {
  return `${(num * 100).toFixed(decimals)}%`;
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return "-";
  // Adjust based on your phone format
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string | undefined, maxLength = 50): string => {
  if (!text) return "-";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

/**
 * Format bytes to readable size: "2.5 MB"
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Format relative time: "2 hours ago", "in 3 days"
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const prefix = diff > 0 ? "ago" : "in";

  if (years > 0) return `${years} year${years > 1 ? "s" : ""} ${prefix}`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ${prefix}`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? "s" : ""} ${prefix}`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ${prefix}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ${prefix}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ${prefix}`;

  return "just now";
};

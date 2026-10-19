import type { AppConfig } from "./env.js";

// Keep the deployed frontend available even if Render still has the local
// CLIENT_URL value from development. Additional domains should be supplied
// through CLIENT_URLS rather than added to the code.
const defaultClientOrigins = ["https://fishlers.vercel.app"];

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/$/, "");

export function getAllowedOrigins(config: AppConfig): string[] {
  return Array.from(
    new Set(
      [config.clientUrl, ...config.clientUrls, ...defaultClientOrigins]
        .filter(Boolean)
        .map(normalizeOrigin)
    )
  );
}

export function isAllowedOrigin(origin: string, config: AppConfig): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(
    normalizedOrigin
  );
  const isLanDevOrigin =
    /^https?:\/\/((192\.168|10\.\d+|172\.(1[6-9]|2\d|3[0-1]))\.\d+\.\d+):\d{2,5}$/.test(
      normalizedOrigin
    );

  return (
    getAllowedOrigins(config).includes(normalizedOrigin) ||
    isLocalDevOrigin ||
    isLanDevOrigin
  );
}

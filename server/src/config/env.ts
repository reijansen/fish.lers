import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  firebaseProjectId: string;
  firebasePrivateKey: string;
  firebaseClientEmail: string;
  clientUrl: string;
  clientUrls: string[];
  mongodbUri: string;
}

/**
 * Load and validate environment variables.
 * Throws if required vars are missing.
 */
export function loadConfig(): AppConfig {
  const requiredVars = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_CLIENT_EMAIL",
    "CLIENT_URL",
    "MONGODB_URI",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`❌ Missing env vars: ${missing.join(", ")}`);
  }

  return {
    port: parseInt(process.env.PORT || "5000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID!,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    clientUrl: process.env.CLIENT_URL!,
    clientUrls: (process.env.CLIENT_URLS || "")
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean),
    mongodbUri: process.env.MONGODB_URI!,
  };
}

import { Request, Response, NextFunction } from "express";

/**
 * Global error handler middleware.
 * Catches errors thrown in routes/controllers and formats them as JSON.
 * Must be registered LAST in the app middleware chain.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("❌ Error:", err.message);

  // Firebase errors
  if (err.message.includes("not-found")) {
    return res.status(404).json({ error: "Not found" });
  }
  if (err.message.includes("permission")) {
    return res.status(403).json({ error: "Permission denied" });
  }

  // Default server error
  res.status(500).json({ error: err.message || "Internal server error" });
}

/**
 * Middleware to verify Firebase authentication token.
 * Extracts the token from Authorization header (Bearer scheme).
 * Attaches user info to req.user if valid.
 * Returns 401 if token is missing or invalid.
 *
 * Usage: app.use(requireAuth) or router.use(requireAuth)
 */
import { getAuth } from "../config/firebase.js";
import { getUserFromMongo } from "../services/authFallback.js";

declare global {
  namespace Express {
    interface Request {
      user?: { uid: string; email?: string; admin?: boolean; superAdmin?: boolean };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      admin: !!decodedToken.admin || !!decodedToken.superAdmin,
      superAdmin: !!decodedToken.superAdmin,
    };
    return next();
  } catch (firebaseError: any) {
    console.warn("⚠️ Firebase auth failed, trying MongoDB fallback...");
    console.error("Auth error:", firebaseError.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
  
  // Fallback: decode JWT manually and look up user in MongoDB
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
    );

    const uid = payload.uid || payload.user_id || payload.sub;
    if (!uid) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Check token expiry manually
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ error: "Token has expired" });
    }

    // Look up user in MongoDB backup
    const user = await getUserFromMongo(uid);
    if (!user) {
      return res.status(401).json({ error: "User not found in backup" });
    }

    req.user = {
      uid: user.uid,
      email: user.email,
      admin: user.role === "admin" || user.isSuperAdmin,
      superAdmin: user.isSuperAdmin,
    };

    return next();
  } catch (mongoError: any) {
    console.error("MongoDB auth error:", mongoError.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Middleware to verify Firebase admin claim.
 * Must be used AFTER requireAuth.
 * Returns 403 if user does not have admin claim.
 *
 * Usage: router.get("/admin-only", requireAuth, requireAdmin, handler)
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!req.user.admin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

/**
 * Middleware to verify super-admin claim.
 * Must be used AFTER requireAuth.
 * Returns 403 if user does not have superAdmin claim.
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!req.user.superAdmin) {
    return res.status(403).json({ error: "Super admin access required" });
  }

  next();
}

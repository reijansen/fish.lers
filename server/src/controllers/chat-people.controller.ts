import { Request, Response } from "express";
import { UserRepository } from "../repositories/users.repo.js";

type Person = {
  uid: string;
  displayName?: string;
  email: string;
  role: "student" | "admin";
  isSuperAdmin?: boolean;
};

function normalize(s: string | undefined): string {
  return (s || "").toLowerCase();
}

function matchesQuery(person: Person, q: string): boolean {
  const query = q.toLowerCase().trim();
  if (!query) return true;
  return (
    normalize(person.displayName).includes(query) ||
    normalize(person.email).includes(query) ||
    normalize(person.uid).includes(query)
  );
}

/**
 * GET /api/chat/people
 *
 * Returns selectable people for starting a chat.
 * Role-filtered based on authenticated user's role/claims.
 *
 * Query:
 * - q: search (displayName/email/uid)
 * - role: optional filter ("student" | "admin")
 * - limit: default 20, max 50
 */
export async function listChatPeople(req: Request, res: Response): Promise<void> {
  try {
    const requester = req.user;
    if (!requester) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const q = typeof req.query.q === "string" ? req.query.q : "";
    const roleFilter = typeof req.query.role === "string" ? req.query.role : undefined;
    const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "20";
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 20, 1), 50);

    const isAdmin = !!requester.admin;
    const isSuperAdmin = !!requester.superAdmin;

    let people: Person[] = [];

    if (!isAdmin && !isSuperAdmin) {
      // Student: can only see admins/superAdmins
      people = await UserRepository.listByRole("admin", 50);
    } else if (!isSuperAdmin) {
      // Admin: students + superAdmins (admins with isSuperAdmin flag)
      const [students, superAdmins] = await Promise.all([
        UserRepository.listByRole("student", 50),
        UserRepository.listSuperAdmins(50),
      ]);
      const byUid = new Map<string, Person>();
      for (const u of [...students, ...superAdmins]) byUid.set(u.uid, u);
      people = Array.from(byUid.values());
    } else {
      // SuperAdmin: admins + students
      const [students, admins] = await Promise.all([
        UserRepository.listByRole("student", 50),
        UserRepository.listByRole("admin", 50),
      ]);
      const byUid = new Map<string, Person>();
      for (const u of [...students, ...admins]) byUid.set(u.uid, u);
      people = Array.from(byUid.values());
    }

    // Optional explicit role filter (post-filter to avoid complex Firestore queries)
    const roleFilterTyped =
      roleFilter === "student" || roleFilter === "admin" ? roleFilter : undefined;
    if (roleFilterTyped) {
      people = people.filter((p) => p.role === roleFilterTyped);
    }

    // Search filter
    people = people.filter((p) => matchesQuery(p, q));

    // Remove self
    people = people.filter((p) => p.uid !== requester.uid);

    // Stable-ish sort: super admins first, then displayName/email
    people.sort((a, b) => {
      const aSuper = a.isSuperAdmin ? 1 : 0;
      const bSuper = b.isSuperAdmin ? 1 : 0;
      if (aSuper !== bSuper) return bSuper - aSuper;
      const aName = normalize(a.displayName) || normalize(a.email);
      const bName = normalize(b.displayName) || normalize(b.email);
      return aName.localeCompare(bName);
    });

    res.status(200).json({
      people: people.slice(0, limit),
    });
  } catch (error: any) {
    console.error("[API] Error in listChatPeople:", error?.message || error);
    res.status(500).json({ error: "Failed to list people" });
  }
}


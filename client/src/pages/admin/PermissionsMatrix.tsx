import React, { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Search, ShieldCheck, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

type Capability = {
  key: string;
  label: string;
  group: string;
  student: boolean;
  admin: boolean;
  superAdmin: boolean;
  note?: string;
  path?: string;
};

const capabilities: Capability[] = [
  {
    key: "submit_requests",
    label: "Submit equipment requests",
    group: "Requests",
    student: true,
    admin: false,
    superAdmin: false,
    path: "/requestpage",
  },
  {
    key: "track_own_requests",
    label: "Track own requests",
    group: "Requests",
    student: true,
    admin: false,
    superAdmin: false,
    path: "/tracking",
  },
  {
    key: "view_inventory",
    label: "Access inventory module",
    group: "Inventory",
    student: false,
    admin: true,
    superAdmin: true,
    path: "/inventory",
  },
  {
    key: "approve_reject",
    label: "Approve / reject requests",
    group: "Requests",
    student: false,
    admin: true,
    superAdmin: true,
    path: "/admindashboard",
  },
  {
    key: "override_decisions",
    label: "Override request decisions",
    group: "Requests",
    student: false,
    admin: false,
    superAdmin: true,
    path: "/admindashboard",
  },
  {
    key: "admin_accounts",
    label: "Manage admin accounts",
    group: "Administration",
    student: false,
    admin: false,
    superAdmin: true,
    path: "/admin/users",
  },
  {
    key: "super_admin_accounts",
    label: "Manage super-admin status",
    group: "Administration",
    student: false,
    admin: false,
    superAdmin: true,
    path: "/admin/users",
  },
  {
    key: "analytics",
    label: "View analytics",
    group: "Analytics",
    student: false,
    admin: true,
    superAdmin: true,
    path: "/analytics",
  },
  {
    key: "history",
    label: "View request history",
    group: "Requests",
    student: false,
    admin: true,
    superAdmin: true,
    path: "/admin/history",
  },
  {
    key: "accountabilities",
    label: "Manage accountabilities",
    group: "Administration",
    student: false,
    admin: true,
    superAdmin: true,
    path: "/admin/accountabilities",
  },
  {
    key: "migration",
    label: "Run data migration tool",
    group: "Administration",
    student: false,
    admin: false,
    superAdmin: true,
    path: "/admin/migration",
  },
  {
    key: "super_activity",
    label: "View super-admin activity log",
    group: "Administration",
    student: false,
    admin: false,
    superAdmin: true,
    path: "/admin/super-activity",
  },
];

function Cell({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1 text-success font-medium">
      <CheckCircle2 className="w-4 h-4" />
      Allowed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-base-content/60">
      <XCircle className="w-4 h-4" />
      Not allowed
    </span>
  );
}

type RoleKey = "student" | "admin" | "superAdmin";

function roleLabel(role: RoleKey) {
  switch (role) {
    case "student":
      return "Student";
    case "admin":
      return "Admin";
    case "superAdmin":
      return "Super Admin";
    default:
      return role;
  }
}

function isAllowedForRole(cap: Capability, role: RoleKey) {
  if (role === "student") return cap.student;
  if (role === "admin") return cap.admin;
  return cap.superAdmin;
}

function PermissionBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="badge badge-success gap-1">
      <CheckCircle2 className="w-4 h-4" />
      Granted
    </span>
  ) : (
    <span className="badge badge-ghost gap-1 text-base-content/70">
      <XCircle className="w-4 h-4" />
      Denied
    </span>
  );
}

const PermissionsMatrix: React.FC = () => {
  const [role, setRole] = useState<RoleKey>("student");
  const [search, setSearch] = useState("");
  const [showGrantedOnly, setShowGrantedOnly] = useState(false);
  const [activeCapKey, setActiveCapKey] = useState<string | null>(null);

  const activeCapability = useMemo(
    () => capabilities.find((c) => c.key === activeCapKey) ?? null,
    [activeCapKey],
  );

  const grouped = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = capabilities.filter((cap) => {
      if (normalizedSearch) {
        const haystack = `${cap.label} ${cap.note ?? ""} ${cap.group}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      if (showGrantedOnly && !isAllowedForRole(cap, role)) return false;
      return true;
    });

    const map = new Map<string, Capability[]>();
    for (const cap of filtered) {
      const list = map.get(cap.group) ?? [];
      list.push(cap);
      map.set(cap.group, list);
    }
    return Array.from(map.entries()).map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [role, search, showGrantedOnly]);

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" />
          Permission Matrix
        </h1>
        <p className="text-base-content/70">
          Quick reference of role capabilities across Student, Admin, and Super Admin.
        </p>
      </div>

      {/* Mobile: card + accordion */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-10 -mx-3 px-3 pt-2 pb-3 bg-base-100/95 backdrop-blur border-b border-base-200 space-y-3">
          <div className="tabs tabs-boxed w-full">
            {(["student", "admin", "superAdmin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`tab flex-1 ${role === r ? "tab-active" : ""}`}
                onClick={() => setRole(r)}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-base-content/50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input input-bordered w-full pl-9"
                placeholder="Search permissions…"
              />
            </div>
            <label className="label cursor-pointer gap-2 px-0">
              <span className="label-text text-sm whitespace-nowrap">Granted only</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={showGrantedOnly}
                onChange={(e) => setShowGrantedOnly(e.target.checked)}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {grouped.length === 0 ? (
            <div className="card bg-base-200 shadow">
              <div className="card-body">
                <div className="font-semibold">No matching permissions</div>
                <div className="text-sm text-base-content/70">
                  Try clearing filters or searching different keywords.
                </div>
              </div>
            </div>
          ) : (
            grouped.map(({ group, items }, groupIndex) => (
              <div key={group} className="collapse collapse-arrow bg-base-200 shadow">
                <input type="checkbox" defaultChecked={groupIndex === 0} />
                <div className="collapse-title font-semibold flex items-center justify-between pr-10">
                  <span>{group}</span>
                  <span className="badge badge-ghost">{items.length}</span>
                </div>
                <div className="collapse-content px-0">
                  <div className="divide-y divide-base-300">
                    {items.map((cap) => {
                      const allowed = isAllowedForRole(cap, role);
                      return (
                        <div
                          key={cap.key}
                          role="button"
                          tabIndex={0}
                          className="px-4 py-3 cursor-pointer active:bg-base-300/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          onClick={() => setActiveCapKey(cap.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setActiveCapKey(cap.key);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{cap.label}</div>
                              {cap.note ? (
                                <div className="text-xs text-base-content/60 line-clamp-2">
                                  {cap.note}
                                </div>
                              ) : (
                                <div className="text-xs text-base-content/60">
                                  Tap to view details
                                </div>
                              )}
                            </div>
                            <PermissionBadge allowed={allowed} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {activeCapability ? (
          <div className="modal modal-open modal-middle">
            <div className="modal-box w-11/12 max-w-lg p-0 overflow-hidden max-h-[85dvh]">
              <div className="sticky top-0 z-10 bg-base-100 border-b border-base-200 px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-lg truncate">{activeCapability.label}</div>
                  <div className="text-xs text-base-content/60">{activeCapability.group}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle"
                  onClick={() => setActiveCapKey(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="px-4 py-4 space-y-4 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                {activeCapability.note ? (
                  <div className="text-sm text-base-content/80">{activeCapability.note}</div>
                ) : (
                  <div className="text-sm text-base-content/70">
                    This permission controls access to related features in the app.
                  </div>
                )}

                <div className="card bg-base-200">
                  <div className="card-body p-4 space-y-2">
                    <div className="font-semibold text-sm">Role access</div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Student</span>
                        <PermissionBadge allowed={activeCapability.student} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Admin</span>
                        <PermissionBadge allowed={activeCapability.admin} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Super Admin</span>
                        <PermissionBadge allowed={activeCapability.superAdmin} />
                      </div>
                    </div>
                  </div>
                </div>

                {activeCapability.path ? (
                  <Link to={activeCapability.path} className="btn btn-primary w-full">
                    <ExternalLink className="w-4 h-4" />
                    Open related page
                  </Link>
                ) : null}

                <div className="alert">
                  <span className="text-sm">
                    Access is enforced by route guards and backend checks. This page is a UI guide.
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setActiveCapKey(null)}>
              <button type="button">close</button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Desktop: keep matrix/table */}
      <div className="hidden lg:block card bg-base-200 shadow-xl">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[720px]">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Student</th>
                  <th>Admin</th>
                  <th>Super Admin</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map((cap) => (
                  <tr key={cap.key}>
                    <td>
                      {cap.path ? (
                        <Link to={cap.path} className="font-medium link link-hover link-primary">
                          {cap.label}
                        </Link>
                      ) : (
                        <div className="font-medium">{cap.label}</div>
                      )}
                      {cap.note ? (
                        <div className="text-xs text-base-content/60">{cap.note}</div>
                      ) : (
                        <div className="text-xs text-base-content/60">{cap.group}</div>
                      )}
                    </td>
                    <td>
                      <Cell allowed={cap.student} />
                    </td>
                    <td>
                      <Cell allowed={cap.admin} />
                    </td>
                    <td>
                      <Cell allowed={cap.superAdmin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="alert alert-info">
        <span>
          Route guards and backend claim checks are the source of truth. This matrix is a UI guide.
        </span>
      </div>
    </div>
  );
};

export default PermissionsMatrix;

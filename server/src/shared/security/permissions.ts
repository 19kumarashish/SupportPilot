export const permissionDefinitions = {
  organization: ["read", "update"],
  users: ["list", "read", "create", "update", "deactivate", "delete"],
  customers: ["list", "read", "create", "update", "delete"],
  tickets: ["list", "read", "create", "update", "assign", "delete", "bulk"],
  comments: ["list", "create", "update", "delete"],
  attachments: ["list", "create", "read", "delete"],
  sla: ["read", "manage", "escalate"],
  teams: ["manage", "assign"],
  knowledge: ["read", "create", "update", "publish", "delete"],
  analytics: ["read"],
  ai: ["use", "manage_documents"],
  notifications: ["read", "update"],
} as const;

export type PermissionResource = keyof typeof permissionDefinitions;
export type Permission =
  `${PermissionResource}:${(typeof permissionDefinitions)[PermissionResource][number]}`;

const rolePermissions: Record<"admin" | "agent", ReadonlySet<Permission>> = {
  admin: new Set(Object.entries(permissionDefinitions).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}` as Permission),
  )),
  agent: new Set([
    "customers:list", "customers:read", "customers:create", "customers:update",
    "tickets:list", "tickets:read", "tickets:create", "tickets:update",
    "comments:list", "comments:create", "comments:update", "comments:delete",
    "attachments:list", "attachments:create", "attachments:read",
    "teams:assign", "knowledge:read", "analytics:read", "ai:use",
    "notifications:read", "notifications:update", "sla:read",
  ]),
};

export const can = (
  role: "admin" | "agent",
  permission: Permission,
): boolean => rolePermissions[role].has(permission);

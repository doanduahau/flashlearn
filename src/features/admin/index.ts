export {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  getPermissionsForRoles,
  getRolePermissions,
  hasAdminPermission,
  isAdminPermission,
  isAdminRole,
} from "@/features/admin/permission-map";
export type { AdminPermission, AdminRole } from "@/features/admin/permission-map";
export { bootstrapOwner, resolveAdminCandidate } from "@/features/admin/server/owner-bootstrap";
export type {
  AdminCandidate,
  BootstrapOwnerInput,
  BootstrapOwnerResult,
} from "@/features/admin/server/owner-bootstrap";

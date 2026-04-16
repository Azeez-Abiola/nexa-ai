/** Canonical BusinessUnit.name for super-admin directory / user-groups API scope. */
export const SUPERADMIN_DIRECTORY_BU_KEY = "nexa-superadmin-directory-bu-name";

export function readSuperAdminDirectoryBu(): string {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(SUPERADMIN_DIRECTORY_BU_KEY) || "";
}

export function writeSuperAdminDirectoryBu(name: string) {
  sessionStorage.setItem(SUPERADMIN_DIRECTORY_BU_KEY, name);
}

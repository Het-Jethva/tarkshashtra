import type { Request, RequestHandler } from "express";

import { AppError } from "../../lib/errors.js";

const roleValues = ["support_executive", "quality_assurance", "operations_manager"] as const;

const permissionValues = [
  "complaints:create",
  "complaints:read",
  "complaints:update_status",
  "complaints:retry_triage",
  "complaints:override",
  "dashboard:read",
  "dashboard:stream",
  "reports:export",
] as const;

export type UserRole = (typeof roleValues)[number];
export type Permission = (typeof permissionValues)[number];

export type AuthActor = {
  role: UserRole;
  name: string;
};

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  support_executive: [
    "complaints:create",
    "complaints:read",
    "complaints:update_status",
    "complaints:retry_triage",
  ],
  quality_assurance: [
    "complaints:read",
    "complaints:retry_triage",
    "dashboard:read",
    "dashboard:stream",
  ],
  operations_manager: [
    "complaints:read",
    "complaints:override",
    "dashboard:read",
    "dashboard:stream",
    "reports:export",
  ],
};

const DEFAULT_DISPLAY_NAME: Record<UserRole, string> = {
  support_executive: "Support Executive",
  quality_assurance: "Quality Assurance",
  operations_manager: "Operations Manager",
};

const ROLE_LABELS: Record<UserRole, string> = {
  support_executive: "Support Agent",
  quality_assurance: "QA Analyst",
  operations_manager: "Manager",
};

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return roleValues.find((role) => role === normalized) ?? null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getQueryParam(query: Request["query"], key: string): string | null {
  const value = query[key];
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  return normalizeText(value);
}

function parseActor(req: Request): AuthActor {
  const role =
    normalizeRole(req.header("x-user-role")) ?? normalizeRole(getQueryParam(req.query, "asRole"));

  if (!role) {
    throw new AppError("Missing or invalid RBAC role", 401, "UNAUTHORIZED", {
      supportedRoles: roleValues,
      expectedHeader: "x-user-role",
      fallbackQueryParam: "asRole",
    });
  }

  const nameFromHeader = normalizeText(req.header("x-user-name"));
  const nameFromQuery = getQueryParam(req.query, "asName");

  return {
    role,
    name: nameFromHeader ?? nameFromQuery ?? DEFAULT_DISPLAY_NAME[role],
  };
}

function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export const supportedRoles = roleValues;

export function requireActor(): RequestHandler {
  return (req, _res, next) => {
    try {
      const actor = parseActor(req);
      (req as Request & { authActor?: AuthActor }).authActor = actor;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    try {
      const actor = parseActor(req);
      if (!hasPermission(actor.role, permission)) {
        throw new AppError("You are not allowed to perform this action", 403, "FORBIDDEN", {
          role: actor.role,
          requiredPermission: permission,
        });
      }

      (req as Request & { authActor?: AuthActor }).authActor = actor;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getActorFromRequest(req: Request): AuthActor {
  const actorFromMiddleware = (req as Request & { authActor?: AuthActor }).authActor;
  if (actorFromMiddleware) {
    return actorFromMiddleware;
  }

  return parseActor(req);
}

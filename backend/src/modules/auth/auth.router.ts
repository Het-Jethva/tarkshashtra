import { Router } from "express";

import { asyncHandler, type ApiSuccess } from "../../lib/http.js";
import {
  getActorFromRequest,
  getPermissionsForRole,
  getRoleLabel,
  requireActor,
  supportedRoles,
} from "./rbac.js";

const authRouter = Router();

authRouter.get(
  "/auth/me",
  requireActor(),
  asyncHandler(async (req, res) => {
    const actor = getActorFromRequest(req);

    const payload = {
      role: actor.role,
      roleLabel: getRoleLabel(actor.role),
      name: actor.name,
      permissions: getPermissionsForRole(actor.role),
      availableRoles: supportedRoles.map((role) => ({
        role,
        label: getRoleLabel(role),
      })),
    };

    const response: ApiSuccess<typeof payload> = {
      success: true,
      data: payload,
    };

    res.status(200).json(response);
  }),
);

export { authRouter };

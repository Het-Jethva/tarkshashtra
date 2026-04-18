import { Router } from "express";

import { authRouter } from "../modules/auth/auth.router.js";
import { complaintsRouter } from "../modules/complaints/complaints.router.js";
import { dashboardRouter } from "../modules/dashboard/dashboard.router.js";
import { reportsRouter } from "../modules/reports/reports.router.js";
import { healthRouter } from "./health.router.js";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use("/complaints", complaintsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/reports", reportsRouter);

export { apiRouter };

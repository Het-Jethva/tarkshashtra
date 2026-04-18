import { Router } from "express";

import { asyncHandler } from "../../lib/http.js";
import { reportQuerySchema } from "./reports.schemas.js";
import { reportsService } from "./reports.service.js";

const reportsRouter = Router();

reportsRouter.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    const csv = await reportsService.generateCsv(query);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="complaints-${Date.now()}.csv"`);
    res.status(200).send(csv);
  }),
);

reportsRouter.get(
  "/export.pdf",
  asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    const pdfBuffer = await reportsService.generatePdf(query);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="complaints-${Date.now()}.pdf"`);
    res.status(200).send(pdfBuffer);
  }),
);

export { reportsRouter };

import express from "express";
import { saveDraft, getDraft } from "../controllers/draftController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/save", requireAuth, saveDraft);
router.get("/:formId", requireAuth, getDraft);

export default router;

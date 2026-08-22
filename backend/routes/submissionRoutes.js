import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getSubmission, submitForm, deleteSubmission } from "../controllers/submissionController.js";

const router = express.Router();

router.get("/:formId", requireAuth, getSubmission);
router.post("/:formId", requireAuth, submitForm);
router.delete("/:formId", requireAuth, deleteSubmission);

export default router;

import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getMe, updateLanguage } from "../controllers/userController.js";

const router = express.Router();

router.get("/me", requireAuth, getMe);
router.put("/language", requireAuth, updateLanguage);

export default router;

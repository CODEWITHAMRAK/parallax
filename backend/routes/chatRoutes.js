import express from "express";
import { handleChat, handleChatStream } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", requireAuth, handleChat);
router.post("/stream", requireAuth, handleChatStream);

export default router;

import express from "express";
import { loginWithGoogle } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginWithGoogle);

export default router;

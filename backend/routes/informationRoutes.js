import express from "express";
import { getInformation } from "../controllers/informationController.js";

const router = express.Router();

router.get("/", getInformation);

export default router;

import express from "express";
import { getLocalizedDictionary } from "../controllers/localizationController.js";

const router = express.Router();

router.get("/:lang", getLocalizedDictionary);

export default router;

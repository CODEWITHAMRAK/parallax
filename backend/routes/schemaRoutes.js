import express from "express";
import { getSchemaById, createSchema } from "../controllers/schemaController.js";

const router = express.Router();

router.get("/:id", getSchemaById);
router.post("/", createSchema);

export default router;

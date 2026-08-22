import express from "express";
import { getSchemaById, createSchema, getAllSchemas } from "../controllers/schemaController.js";

const router = express.Router();

router.get("/", getAllSchemas);
router.get("/:id", getSchemaById);
router.post("/", createSchema);

export default router;

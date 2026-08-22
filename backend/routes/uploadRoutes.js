import express from 'express';
import { uploadDocument } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/', uploadDocument);

export default router;

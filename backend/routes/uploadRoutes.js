import express from 'express';
import { uploadDocument } from '../controllers/uploadController.js';
import { verifyDocument } from '../controllers/verifyController.js';
import { autofillFromDocument } from '../controllers/autofillController.js';

const router = express.Router();

router.post('/', uploadDocument);
router.post('/verify', verifyDocument);
router.post('/autofill', autofillFromDocument);

export default router;

import express from 'express';
import multer from 'multer';
import { transcribeAudio, speakText } from '../controllers/voiceController.js';

const router = express.Router();

// Setup multer for handling memory storage (we just need the buffer to send to Sarvam)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/transcribe', upload.single('audio'), transcribeAudio);
router.post('/speak', speakText);

export default router;

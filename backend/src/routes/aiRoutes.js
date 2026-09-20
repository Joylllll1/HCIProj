import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import auth from '../middlewares/auth.js';

const router = Router();

// AI chat routes
router.post('/chat', auth, aiController.sendMessage);
router.post('/cancel', auth, aiController.cancelRequest);
router.get('/profile', auth, aiController.getProfile);
router.put('/profile', auth, aiController.updateProfile);
router.get('/sessions', auth, aiController.getSessions);
router.get('/sessions/:id', auth, aiController.getSession);
router.get('/sessions/:id/persona', auth, aiController.getSessionPersona);
router.post('/sessions', auth, aiController.createSession);
router.put('/sessions/:id/persona', auth, aiController.updateSessionPersona);
router.delete('/sessions/:id', auth, aiController.deleteSession);
router.post('/sessions/:id/regenerate', auth, aiController.regenerateMessage);

export default router;

import { Router } from 'express';
import * as fortuneController from '../controllers/fortuneController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/status', auth, fortuneController.status);
router.post('/checkin', auth, fortuneController.checkin);

export default router;

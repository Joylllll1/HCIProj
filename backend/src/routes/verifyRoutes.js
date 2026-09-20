import { Router } from 'express';
import * as verifyController from '../controllers/verifyController.js';
import optionalAuth from '../middlewares/optionalAuth.js';

const router = Router();

router.post('/send', optionalAuth, verifyController.sendCode);
router.post('/check', optionalAuth, verifyController.checkCode);

export default router;

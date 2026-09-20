import { Router } from 'express';
import * as passwordController from '../controllers/passwordController.js';

const router = Router();

router.post('/forgot', passwordController.forgot);
router.post('/reset', passwordController.reset);

export default router;

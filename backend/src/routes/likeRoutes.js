import { Router } from 'express';
import * as likeController from '../controllers/likeController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, likeController.list);

export default router;

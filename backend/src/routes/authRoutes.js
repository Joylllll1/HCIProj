import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.getMe);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.put('/profile', auth, authController.updateProfile);
router.post('/change-password', auth, authController.changePassword);

export default router;

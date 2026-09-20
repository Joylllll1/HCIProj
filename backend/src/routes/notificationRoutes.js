import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as notificationController from '../controllers/notificationController.js';

const router = Router();

// All notification routes require authentication
router.get('/', auth, notificationController.getNotifications);
router.get('/unread-count', auth, notificationController.getUnreadCount);
router.put('/:id/read', auth, notificationController.markAsRead);
router.put('/read-all', auth, notificationController.markAllAsRead);

export default router;

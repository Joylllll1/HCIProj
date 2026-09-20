import { Router } from 'express';
import auth from '../middlewares/auth.js';
import isAdmin from '../middlewares/isAdmin.js';
import * as eventController from '../controllers/eventController.js';

const router = Router();

// Public routes (no auth required)
router.get('/', eventController.getPublicEvents);

// Authenticated routes (any logged-in user)
router.post('/', auth, eventController.createEvent);
router.get('/my', auth, eventController.getMyEvents);

// Admin only routes
router.get('/pending', auth, isAdmin, eventController.getPendingEvents);
router.get('/approved', auth, isAdmin, eventController.getApprovedEvents);
router.get('/rejected', auth, isAdmin, eventController.getRejectedEvents);
router.post('/:id/approve', auth, isAdmin, eventController.approveEvent);
router.post('/:id/reject', auth, isAdmin, eventController.rejectEvent);
router.post('/:id/archive', auth, isAdmin, eventController.archiveEvent);
router.delete('/:id', auth, isAdmin, eventController.deleteEvent);

export default router;

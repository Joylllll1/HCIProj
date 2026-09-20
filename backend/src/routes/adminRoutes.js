import { Router } from 'express';
import auth from '../middlewares/auth.js';
import isAdmin from '../middlewares/isAdmin.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

// All admin routes require auth + admin role
router.use(auth, isAdmin);

// Reports
router.get('/reports', adminController.getReports);
router.post('/reports/:id/dismiss', adminController.dismissReport);

// Posts moderation
router.post('/posts/:id/trace', adminController.tracePost);
router.delete('/posts/:id', adminController.deletePost);

// Comments moderation
router.post('/comments/:id/trace', adminController.tracePost);
router.delete('/comments/:id', adminController.deleteComment);

// Users banning
router.post('/users/:id/ban', adminController.banUser);

// Bans management
router.get('/bans', adminController.getBans);
router.post('/bans/:id/unban', adminController.unbanUser);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

export default router;

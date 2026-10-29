import { Router } from 'express';
import * as mediaController from '../controllers/mediaController.js';
import optionalAuth from '../middlewares/optionalAuth.js';

const router = Router();

router.get('/posts/:id/:index', optionalAuth, mediaController.getPostImage);
router.get('/drafts/:id/:index', optionalAuth, mediaController.getDraftImage);
router.get('/comments/:id', optionalAuth, mediaController.getCommentImage);
router.get('/replies/:commentId/:replyId', optionalAuth, mediaController.getReplyImage);
router.get('/events/:id', optionalAuth, mediaController.getEventImage);

export default router;

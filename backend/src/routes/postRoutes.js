import { Router } from 'express';
import * as postController from '../controllers/postController.js';
import * as reportController from '../controllers/reportController.js';
import auth from '../middlewares/auth.js';
import optionalAuth from '../middlewares/optionalAuth.js';
import checkBan from '../middlewares/checkBan.js';

const router = Router();

router.post('/', auth, checkBan, postController.create);
router.get('/', optionalAuth, postController.list);
router.get('/saved', auth, postController.getSaved);
router.get('/mine', auth, postController.mine);
router.get('/:id', optionalAuth, postController.getById);
router.delete('/:id', auth, postController.remove);
router.post('/:id/like', auth, postController.like);
router.post('/:id/save', auth, postController.save);
router.post('/:id/report', auth, reportController.create);

export default router;

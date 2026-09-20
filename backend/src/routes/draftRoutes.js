import { Router } from 'express';
import * as draftController from '../controllers/draftController.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.post('/', auth, draftController.create);
router.get('/', auth, draftController.list);
router.get('/:id', auth, draftController.getById);
router.put('/:id', auth, draftController.update);
router.delete('/:id', auth, draftController.remove);
router.post('/delete-many', auth, draftController.removeMany);
router.post('/:id/publish', auth, draftController.publish);

export default router;
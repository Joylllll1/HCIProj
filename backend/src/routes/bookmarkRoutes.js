import { Router } from 'express';
import auth from '../middlewares/auth.js';
import * as bookmarkController from '../controllers/bookmarkController.js';

const router = Router();

router.use(auth);

router.get('/', bookmarkController.getBookmarks);
router.post('/migrate', bookmarkController.migrateBookmarks);
router.post('/folders', bookmarkController.createFolder);
router.put('/folders/:folderId', bookmarkController.renameFolder);
router.delete('/folders/:folderId', bookmarkController.deleteFolder);
router.post('/:postId', bookmarkController.saveBookmark);
router.delete('/:postId', bookmarkController.removeBookmark);

export default router;

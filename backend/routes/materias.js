const express = require('express');
const router = express.Router();
const materiaController = require('../controllers/materiaController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/', materiaController.getAll);
router.post('/', materiaController.create);
router.put('/:id', materiaController.update);
router.delete('/:id', materiaController.delete);

module.exports = router;
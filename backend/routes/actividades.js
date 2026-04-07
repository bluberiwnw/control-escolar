const express = require('express');
const router = express.Router();
const actividadController = require('../controllers/actividadController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/', actividadController.getAll);
router.post('/', actividadController.create);
router.put('/:id', actividadController.update);
router.delete('/:id', actividadController.delete);

module.exports = router;
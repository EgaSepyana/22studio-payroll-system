import { Router } from 'express';
import * as ownerSettingsController from '../controllers/ownerSettingsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('owner'));

router.get('/categories', ownerSettingsController.listCategories);
router.post('/categories', ownerSettingsController.createCategory);
router.put('/categories/:id', ownerSettingsController.updateCategory);
router.delete('/categories/:id', ownerSettingsController.removeCategory);

router.get('/locations', ownerSettingsController.listLocations);
router.post('/locations', ownerSettingsController.createLocation);
router.put('/locations/:id', ownerSettingsController.updateLocation);
router.delete('/locations/:id', ownerSettingsController.removeLocation);

router.get('/business', ownerSettingsController.getBusinessSettings);
router.put('/business', ownerSettingsController.updateBusinessSettings);

export default router;

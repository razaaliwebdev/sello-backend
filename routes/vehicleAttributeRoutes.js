import express from 'express';
import { getVehicleTypes, getFieldsForType } from '../controllers/vehicleAttributeController.js';

const router = express.Router();

router.get('/types', getVehicleTypes);
router.get('/types/:id/fields', getFieldsForType);

export default router;

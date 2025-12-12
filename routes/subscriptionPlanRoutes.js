import express from 'express';
import {
    getAllPlans,
    getActivePlans,
    getPlanById,
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanStatus
} from '../controllers/subscriptionPlanController.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - get active plans
router.get('/active', getActivePlans);

// Admin routes
router.use(auth);
router.use(authorize('admin'));

router.get('/', getAllPlans);
router.get('/:planId', getPlanById);
router.post('/', createPlan);
router.put('/:planId', updatePlan);
router.delete('/:planId', deletePlan);
router.patch('/:planId/toggle', togglePlanStatus);

export default router;

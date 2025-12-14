import express from 'express';
import { auth } from '../middlewares/authMiddleware.js';
import {
    createSavedSearch,
    getSavedSearches,
    getSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
    executeSavedSearch
} from '../controllers/savedSearchController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Create saved search
router.post('/', createSavedSearch);

// Get all user's saved searches
router.get('/', getSavedSearches);

// Get single saved search
router.get('/:searchId', getSavedSearch);

// Execute saved search and get results
router.get('/:searchId/execute', executeSavedSearch);

// Update saved search
router.put('/:searchId', updateSavedSearch);

// Delete saved search
router.delete('/:searchId', deleteSavedSearch);

export default router;

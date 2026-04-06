// routes/ResearchRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js';
import {
    createResearchPaper,
    getAllResearchPapers,
    getResearchPaperBySlug,
    getResearchPaperById,
    updateResearchPaper,
    deleteResearchPaper,
    incrementDownload,
    getResearchCategories
} from '../controllers/ResearchController.js';

const router = express.Router();

// Public routes
router.get('/', getAllResearchPapers);
router.get('/categories', getResearchCategories);
router.get('/:slug', getResearchPaperBySlug);
router.post('/:id/download', incrementDownload);

// Admin only routes
router.post('/', protect, authorize('admin', 'manager'), createResearchPaper);
router.get('/admin/:id', protect, authorize('admin', 'manager'), getResearchPaperById);
router.put('/:id', protect, authorize('admin', 'manager'), updateResearchPaper);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteResearchPaper);

export default router;
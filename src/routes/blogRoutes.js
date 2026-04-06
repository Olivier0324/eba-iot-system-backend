// routes/BlogRoutes.js
import express from 'express';
import { protect, authorize } from '../middlewares/AuthMiddleware.js';
import {
    createBlog,
    getAllBlogs,
    getBlogBySlug,
    getBlogById,
    updateBlog,
    deleteBlog,
    getBlogCategories
} from '../controllers/BlogController.js';

const router = express.Router();

// Public routes
router.get('/', getAllBlogs);
router.get('/categories', getBlogCategories);
router.get('/:slug', getBlogBySlug);

// Admin only routes
router.post('/', protect, authorize('admin'), createBlog);
router.get('/admin/:id', protect, authorize('admin'), getBlogById);
router.put('/:id', protect, authorize('admin'), updateBlog);
router.delete('/:id', protect, authorize('admin'), deleteBlog);

export default router;
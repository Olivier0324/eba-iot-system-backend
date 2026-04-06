// controllers/BlogController.js
import { Blog } from '../models/Blog.js';

// Generate slug from title
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
};

// Create blog post (Admin only)
export const createBlog = async (req, res) => {
    try {
        const { title, excerpt, content, featuredImage, author, category, readTime, tags, published } = req.body;

        const slug = generateSlug(title);

        // Check if slug exists
        const existingBlog = await Blog.findOne({ slug });
        if (existingBlog) {
            return res.status(400).json({
                success: false,
                message: 'A blog post with this title already exists'
            });
        }

        const blog = new Blog({
            title,
            slug,
            excerpt,
            content,
            featuredImage,
            author,
            category,
            readTime,
            tags: tags || [],
            published: published || false,
            publishedAt: published ? new Date() : null,
            createdBy: req.user._id
        });

        await blog.save();

        res.status(201).json({
            success: true,
            message: 'Blog post created successfully',
            data: blog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all blog posts (public)
export const getAllBlogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, category, published } = req.query;

        const query = {};
        if (category) query.category = category;
        if (published !== undefined) query.published = published === 'true';

        const blogs = await Blog.find(query)
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-content');

        const total = await Blog.countDocuments(query);

        res.json({
            success: true,
            data: blogs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get single blog post by slug
export const getBlogBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const blog = await Blog.findOne({ slug });
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        // Increment views
        blog.views += 1;
        await blog.save();

        res.json({
            success: true,
            data: blog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get blog post by ID (Admin)
export const getBlogById = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        res.json({
            success: true,
            data: blog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update blog post (Admin only)
export const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, excerpt, content, featuredImage, author, category, readTime, tags, published } = req.body;

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        // If title changed, update slug
        if (title && title !== blog.title) {
            const newSlug = generateSlug(title);
            const existingBlog = await Blog.findOne({ slug: newSlug, _id: { $ne: id } });
            if (existingBlog) {
                return res.status(400).json({
                    success: false,
                    message: 'A blog post with this title already exists'
                });
            }
            blog.slug = newSlug;
            blog.title = title;
        }

        if (excerpt) blog.excerpt = excerpt;
        if (content) blog.content = content;
        if (featuredImage !== undefined) blog.featuredImage = featuredImage;
        if (author) blog.author = author;
        if (category) blog.category = category;
        if (readTime) blog.readTime = readTime;
        if (tags) blog.tags = tags;

        if (published !== undefined && published !== blog.published) {
            blog.published = published;
            blog.publishedAt = published ? new Date() : null;
        }

        await blog.save();

        res.json({
            success: true,
            message: 'Blog post updated successfully',
            data: blog
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete blog post (Admin only)
export const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        const blog = await Blog.findByIdAndDelete(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        res.json({
            success: true,
            message: 'Blog post deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get blog categories
export const getBlogCategories = async (req, res) => {
    try {
        const categories = await Blog.distinct('category');
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
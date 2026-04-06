// controllers/ResearchController.js
import { ResearchPaper } from '../models/ResearchPaper.js';

// Generate slug from title
const generateSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
};

// Create research paper (Admin only)
export const createResearchPaper = async (req, res) => {
    try {
        const { title, authors, abstract, content, coverImage, pdfUrl, journal, publicationDate, doi, citation, category, keywords, published } = req.body;

        const slug = generateSlug(title);

        const existingPaper = await ResearchPaper.findOne({ slug });
        if (existingPaper) {
            return res.status(400).json({
                success: false,
                message: 'A research paper with this title already exists'
            });
        }

        const paper = new ResearchPaper({
            title,
            slug,
            authors: Array.isArray(authors) ? authors : [authors],
            abstract,
            content,
            coverImage,
            pdfUrl,
            journal,
            publicationDate: new Date(publicationDate),
            doi,
            citation,
            category,
            keywords: keywords || [],
            published: published || false,
            createdBy: req.user._id
        });

        await paper.save();

        res.status(201).json({
            success: true,
            message: 'Research paper created successfully',
            data: paper
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get all research papers (public)
export const getAllResearchPapers = async (req, res) => {
    try {
        const { page = 1, limit = 10, category, year } = req.query;

        const query = { published: true };
        if (category) query.category = category;
        if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31);
            query.publicationDate = { $gte: startDate, $lte: endDate };
        }

        const papers = await ResearchPaper.find(query)
            .sort({ publicationDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-content');

        const total = await ResearchPaper.countDocuments(query);

        res.json({
            success: true,
            data: papers,
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

// Get single research paper by slug
export const getResearchPaperBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const paper = await ResearchPaper.findOne({ slug, published: true });
        if (!paper) {
            return res.status(404).json({ success: false, message: 'Research paper not found' });
        }

        // Increment views
        paper.views += 1;
        await paper.save();

        res.json({
            success: true,
            data: paper
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get research paper by ID (Admin)
export const getResearchPaperById = async (req, res) => {
    try {
        const { id } = req.params;

        const paper = await ResearchPaper.findById(id);
        if (!paper) {
            return res.status(404).json({ success: false, message: 'Research paper not found' });
        }

        res.json({
            success: true,
            data: paper
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update research paper (Admin only)
export const updateResearchPaper = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, authors, abstract, content, coverImage, pdfUrl, journal, publicationDate, doi, citation, category, keywords, published } = req.body;

        const paper = await ResearchPaper.findById(id);
        if (!paper) {
            return res.status(404).json({ success: false, message: 'Research paper not found' });
        }

        if (title && title !== paper.title) {
            const newSlug = generateSlug(title);
            const existingPaper = await ResearchPaper.findOne({ slug: newSlug, _id: { $ne: id } });
            if (existingPaper) {
                return res.status(400).json({
                    success: false,
                    message: 'A research paper with this title already exists'
                });
            }
            paper.slug = newSlug;
            paper.title = title;
        }

        if (authors) paper.authors = Array.isArray(authors) ? authors : [authors];
        if (abstract) paper.abstract = abstract;
        if (content) paper.content = content;
        if (coverImage !== undefined) paper.coverImage = coverImage;
        if (pdfUrl !== undefined) paper.pdfUrl = pdfUrl;
        if (journal) paper.journal = journal;
        if (publicationDate) paper.publicationDate = new Date(publicationDate);
        if (doi) paper.doi = doi;
        if (citation) paper.citation = citation;
        if (category) paper.category = category;
        if (keywords) paper.keywords = keywords;
        if (published !== undefined) paper.published = published;

        await paper.save();

        res.json({
            success: true,
            message: 'Research paper updated successfully',
            data: paper
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete research paper (Admin only)
export const deleteResearchPaper = async (req, res) => {
    try {
        const { id } = req.params;

        const paper = await ResearchPaper.findByIdAndDelete(id);
        if (!paper) {
            return res.status(404).json({ success: false, message: 'Research paper not found' });
        }

        res.json({
            success: true,
            message: 'Research paper deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Increment download count
export const incrementDownload = async (req, res) => {
    try {
        const { id } = req.params;

        const paper = await ResearchPaper.findById(id);
        if (!paper) {
            return res.status(404).json({ success: false, message: 'Research paper not found' });
        }

        paper.downloads += 1;
        await paper.save();

        res.json({
            success: true,
            message: 'Download count incremented',
            downloads: paper.downloads
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get research categories
export const getResearchCategories = async (req, res) => {
    try {
        const categories = await ResearchPaper.distinct('category');
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
// models/ResearchPaper.js
import mongoose from 'mongoose';

const ResearchPaperSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    authors: [{
        type: String,
        required: true
    }],
    abstract: {
        type: String,
        required: true,
        maxlength: 500
    },
    content: {
        type: String,
        required: true
    },
    coverImage: {
        type: String,
        default: null
    },
    pdfUrl: {
        type: String,
        default: null
    },
    journal: {
        type: String,
        default: null
    },
    publicationDate: {
        type: Date,
        required: true
    },
    doi: {
        type: String,
        default: null
    },
    citation: {
        type: String,
        default: null
    },
    category: {
        type: String,
        enum: ['environmental-science', 'iot-technology', 'climate-adaptation', 'data-analytics', 'policy'],
        default: 'environmental-science'
    },
    downloads: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    },
    citations: {
        type: Number,
        default: 0
    },
    keywords: [{
        type: String,
        trim: true
    }],
    published: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
ResearchPaperSchema.index({ category: 1, publicationDate: -1 });
ResearchPaperSchema.index({ authors: 1 });
ResearchPaperSchema.index({ keywords: 1 });

// Virtual for formatted citation
ResearchPaperSchema.virtual('formattedCitation').get(function () {
    if (this.citation) return this.citation;
    const authors = this.authors.join(', ');
    const year = new Date(this.publicationDate).getFullYear();
    return `${authors}. (${year}). ${this.title}. ${this.journal || ''}`.trim();
});

export const ResearchPaper = mongoose.model('ResearchPaper', ResearchPaperSchema);
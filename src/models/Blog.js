// models/Blog.js
import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,  // This already creates an index - NO need for separate index
        lowercase: true,
        trim: true
    },
    excerpt: {
        type: String,
        required: true,
        maxlength: 300
    },
    content: {
        type: String,
        required: true
    },
    featuredImage: {
        type: String,
        default: null
    },
    author: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['tutorial', 'research', 'technical', 'guide', 'news', 'case-study'],
        default: 'tutorial'
    },
    readTime: {
        type: Number,
        default: 5,
        description: 'Estimated read time in minutes'
    },
    tags: [{
        type: String,
        trim: true
    }],
    published: {
        type: Boolean,
        default: false
    },
    publishedAt: {
        type: Date,
        default: null
    },
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes - REMOVED duplicate slug index (already handled by unique: true)
BlogSchema.index({ category: 1, createdAt: -1 });
BlogSchema.index({ published: 1, publishedAt: -1 });
BlogSchema.index({ tags: 1 });

// Virtual for formatted date
BlogSchema.virtual('formattedDate').get(function () {
    return this.publishedAt ?
        new Date(this.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : null;
});

export const Blog = mongoose.model('Blog', BlogSchema);
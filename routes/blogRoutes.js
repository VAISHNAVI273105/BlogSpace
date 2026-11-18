const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const authenticateToken = require('../middleware/auth');

// Calculate reading time
function calculateReadTime(text) {
  const words = text ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 170));
  return `${minutes} min read`;
}

// Sanitize string helper
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Helper to find a blog by ObjectId, slug, or custom id
 */
async function findBlogByIdOrSlug(idParam) {
  if (!idParam) return null;

  if (mongoose.Types.ObjectId.isValid(idParam)) {
    const blog = await Blog.findById(idParam);
    if (blog) return blog;
  }

  // Fallback to slug search
  let blog = await Blog.findOne({ slug: idParam });
  if (blog) return blog;

  // Fallback to case-insensitive slug or title match
  blog = await Blog.findOne({
    $or: [
      { slug: new RegExp(`^${idParam}$`, 'i') },
      { title: new RegExp(idParam.replace(/[-_]/g, ' '), 'i') }
    ]
  });
  return blog;
}

/**
 * @route   GET /api/blogs
 * @desc    Get all blogs from MongoDB with optional filtering & search
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { category, status, search, authorId } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (category && category !== 'all') {
      filter.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    if (authorId) {
      filter.authorId = authorId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { excerpt: { $regex: q, $options: 'i' } }
      ];
    }

    const blogs = await Blog.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: blogs.length,
      blogs: blogs.map(b => b.toJSON())
    });
  } catch (err) {
    console.error('Fetch blogs error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving stories from database.'
    });
  }
});

/**
 * @route   GET /api/blogs/stats
 * @desc    Get dashboard metrics from MongoDB (total, published, drafts, views)
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    const { authorId } = req.query;
    const filter = {};
    if (authorId) {
      filter.authorId = authorId;
    }

    const total = await Blog.countDocuments(filter);
    const published = await Blog.countDocuments({ ...filter, status: 'published' });
    const drafts = await Blog.countDocuments({ ...filter, status: 'draft' });

    // Sum all views using aggregation
    const viewsAgg = await Blog.aggregate([
      { $match: filter },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    const views = viewsAgg.length > 0 ? viewsAgg[0].totalViews : 0;

    return res.status(200).json({
      success: true,
      stats: {
        total,
        published,
        drafts,
        views
      }
    });
  } catch (err) {
    console.error('Stats calculation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error calculating dashboard statistics.'
    });
  }
});

/**
 * @route   GET /api/blogs/:id
 * @desc    Get single blog by MongoDB ID or slug
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const blog = await findBlogByIdOrSlug(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Story not found.'
      });
    }

    return res.status(200).json({
      success: true,
      blog: blog.toJSON()
    });
  } catch (err) {
    console.error('Retrieve blog error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving story.'
    });
  }
});

/**
 * @route   POST /api/blogs
 * @desc    Create a new blog story permanently in MongoDB
 * @access  Private (Requires JWT token)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, category, excerpt, coverImage, content, status } = req.body;

    // Validation
    const cleanTitle = sanitizeString(title);
    const cleanCategory = sanitizeString(category);
    const cleanContent = sanitizeString(content);
    const cleanExcerpt = sanitizeString(excerpt);
    const cleanCoverImage = sanitizeString(coverImage);

    if (!cleanTitle || cleanTitle.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Story title is required and must be at least 3 characters long.'
      });
    }

    if (!cleanCategory) {
      return res.status(400).json({
        success: false,
        message: 'Please select an editorial category.'
      });
    }

    if (!cleanContent || cleanContent.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Story content is required and must contain at least 10 characters.'
      });
    }

    const targetStatus = status === 'draft' ? 'draft' : 'published';
    const fallbackCover = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80';

    // The author is bound directly to the verified authenticated user token
    const newBlog = new Blog({
      title: cleanTitle,
      category: cleanCategory,
      excerpt: cleanExcerpt || cleanContent.substring(0, 140) + '...',
      coverImage: cleanCoverImage || fallbackCover,
      content: cleanContent,
      authorId: req.user.id,
      author: {
        name: req.user.name,
        role: req.user.role || 'Essayist',
        avatar: req.user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      },
      status: targetStatus,
      views: targetStatus === 'published' ? Math.floor(Math.random() * 30) + 1 : 0
    });

    await newBlog.save();

    return res.status(201).json({
      success: true,
      message: targetStatus === 'published'
        ? 'Story published to the global circle.'
        : 'Draft manuscript preserved in your studio.',
      blog: newBlog.toJSON()
    });
  } catch (err) {
    console.error('Create blog error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error creating story in database.'
    });
  }
});

/**
 * @route   PUT /api/blogs/:id
 * @desc    Update existing blog story in MongoDB
 * @access  Private (Requires JWT token & author ownership)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, category, excerpt, coverImage, content, status } = req.body;

    const blog = await findBlogByIdOrSlug(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Story not found.'
      });
    }

    // Authorization check: User must be author or Admin
    const blogAuthorIdStr = blog.authorId ? blog.authorId.toString() : '';
    if (blogAuthorIdStr && blogAuthorIdStr !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to modify this story.'
      });
    }

    const updatedContent = content !== undefined ? sanitizeString(content) : blog.content;
    const updatedTitle = title !== undefined ? sanitizeString(title) : blog.title;

    if (title !== undefined && (!updatedTitle || updatedTitle.length < 3)) {
      return res.status(400).json({
        success: false,
        message: 'Story title must be at least 3 characters long.'
      });
    }

    if (title !== undefined) {
      blog.title = updatedTitle;
      blog.slug = updatedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (category !== undefined) blog.category = sanitizeString(category);
    if (excerpt !== undefined) blog.excerpt = sanitizeString(excerpt);
    if (coverImage !== undefined) blog.coverImage = sanitizeString(coverImage);
    if (content !== undefined) {
      blog.content = updatedContent;
      blog.readTime = calculateReadTime(updatedContent);
    }
    if (status !== undefined) blog.status = status;

    await blog.save();

    return res.status(200).json({
      success: true,
      message: 'Story successfully updated.',
      blog: blog.toJSON()
    });
  } catch (err) {
    console.error('Update blog error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating story.'
    });
  }
});

/**
 * @route   DELETE /api/blogs/:id
 * @desc    Delete a blog story permanently from MongoDB
 * @access  Private (Requires JWT token & author ownership)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const blog = await findBlogByIdOrSlug(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Story not found.'
      });
    }

    // Authorization check: User must be author or Admin
    const blogAuthorIdStr = blog.authorId ? blog.authorId.toString() : '';
    if (blogAuthorIdStr && blogAuthorIdStr !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to delete this story.'
      });
    }

    await Blog.deleteOne({ _id: blog._id });

    return res.status(200).json({
      success: true,
      message: 'Story permanently removed from the archive.'
    });
  } catch (err) {
    console.error('Delete blog error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting story.'
    });
  }
});

module.exports = router;

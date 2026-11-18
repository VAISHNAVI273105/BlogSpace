const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authenticateToken = require('../middleware/auth');

// Calculate reading time
function calculateReadTime(text) {
  const words = text ? text.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 170));
  return `${minutes} min read`;
}

// Format human date
function getFormattedDateNow() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date();
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}

// Sanitize string helper
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * @route   GET /api/blogs
 * @desc    Get all blogs with optional filtering & search
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    let blogs = db.getBlogs();
    const { category, status, search, authorId } = req.query;

    if (status && status !== 'all') {
      blogs = blogs.filter(b => b.status === status);
    }

    if (category && category !== 'all') {
      blogs = blogs.filter(b => b.category.toLowerCase() === category.toLowerCase());
    }

    if (authorId) {
      blogs = blogs.filter(b => b.authorId === authorId);
    }

    if (search) {
      const q = search.toLowerCase().trim();
      blogs = blogs.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.category.toLowerCase().includes(q) ||
        (b.excerpt && b.excerpt.toLowerCase().includes(q))
      );
    }

    return res.status(200).json({
      success: true,
      count: blogs.length,
      blogs
    });
  } catch (err) {
    console.error('Fetch blogs error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving stories.'
    });
  }
});

/**
 * @route   GET /api/blogs/stats
 * @desc    Get dashboard metrics (total, published, drafts, views)
 * @access  Public
 */
router.get('/stats', (req, res) => {
  try {
    const blogs = db.getBlogs();
    const { authorId } = req.query;

    // Optional filter by author if authorId provided
    const targetBlogs = authorId ? blogs.filter(b => b.authorId === authorId) : blogs;

    const total = targetBlogs.length;
    const published = targetBlogs.filter(b => b.status === 'published').length;
    const drafts = targetBlogs.filter(b => b.status === 'draft').length;
    const views = targetBlogs.reduce((acc, b) => acc + (b.views || 0), 0);

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
    return res.status(500).json({
      success: false,
      message: 'Server error calculating dashboard statistics.'
    });
  }
});

/**
 * @route   GET /api/blogs/:id
 * @desc    Get single blog by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  try {
    const blogs = db.getBlogs();
    const blog = blogs.find(b => b.id === req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Story not found.'
      });
    }

    return res.status(200).json({
      success: true,
      blog
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving story.'
    });
  }
});

/**
 * @route   POST /api/blogs
 * @desc    Create a new blog story
 * @access  Private (Requires JWT token)
 */
router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, category, excerpt, coverImage, content, status } = req.body;

    // Validation
    const cleanTitle = sanitizeString(title);
    const cleanCategory = sanitizeString(category);
    const cleanContent = sanitizeString(content);

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

    const blogs = db.getBlogs();
    const targetStatus = status === 'draft' ? 'draft' : 'published';
    const fallbackCover = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80';

    // The author is bound directly to the verified authenticated user token
    const newBlog = {
      id: 'blog_' + Date.now(),
      title: cleanTitle,
      slug: cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: cleanCategory,
      excerpt: excerpt && excerpt.trim() ? excerpt.trim() : cleanContent.substring(0, 140) + '...',
      coverImage: coverImage && coverImage.trim() ? coverImage.trim() : fallbackCover,
      content: cleanContent,
      authorId: req.user.id,
      author: {
        name: req.user.name,
        role: req.user.role || 'Essayist',
        avatar: req.user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      },
      date: getFormattedDateNow(),
      readTime: calculateReadTime(cleanContent),
      status: targetStatus,
      views: targetStatus === 'published' ? Math.floor(Math.random() * 30) + 1 : 0,
      createdAt: new Date().toISOString()
    };

    blogs.unshift(newBlog);
    db.saveBlogs(blogs);

    return res.status(201).json({
      success: true,
      message: targetStatus === 'published' 
        ? 'Story published to the global circle.' 
        : 'Draft manuscript preserved in your studio.',
      blog: newBlog
    });
  } catch (err) {
    console.error('Create blog error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error creating story.'
    });
  }
});

/**
 * @route   PUT /api/blogs/:id
 * @desc    Update existing blog story
 * @access  Private (Requires JWT token & author ownership)
 */
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { title, category, excerpt, coverImage, content, status } = req.body;
    const blogs = db.getBlogs();

    const index = blogs.findIndex(b => b.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Story not found.'
      });
    }

    const current = blogs[index];

    // Authorization check: User must be author or Admin
    if (current.authorId && current.authorId !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to modify this story.'
      });
    }

    const updatedContent = content !== undefined ? sanitizeString(content) : current.content;
    const updatedTitle = title !== undefined ? sanitizeString(title) : current.title;

    if (title !== undefined && (!updatedTitle || updatedTitle.length < 3)) {
      return res.status(400).json({
        success: false,
        message: 'Story title must be at least 3 characters long.'
      });
    }

    const updatedBlog = {
      ...current,
      title: updatedTitle,
      category: category !== undefined ? sanitizeString(category) : current.category,
      excerpt: excerpt !== undefined ? sanitizeString(excerpt) : current.excerpt,
      coverImage: coverImage !== undefined ? sanitizeString(coverImage) : current.coverImage,
      content: updatedContent,
      readTime: calculateReadTime(updatedContent),
      status: status !== undefined ? status : current.status,
      updatedAt: new Date().toISOString()
    };

    blogs[index] = updatedBlog;
    db.saveBlogs(blogs);

    return res.status(200).json({
      success: true,
      message: 'Story successfully updated.',
      blog: updatedBlog
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
 * @desc    Delete a blog story
 * @access  Private (Requires JWT token & author ownership)
 */
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    let blogs = db.getBlogs();
    const blog = blogs.find(b => b.id === req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Story not found.'
      });
    }

    // Authorization check: User must be author or Admin
    if (blog.authorId && blog.authorId !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to delete this story.'
      });
    }

    blogs = blogs.filter(b => b.id !== req.params.id);
    db.saveBlogs(blogs);

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

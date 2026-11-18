const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Story title is required'],
      trim: true,
      minlength: [3, 'Story title must be at least 3 characters long']
    },
    slug: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Editorial category is required'],
      trim: true
    },
    excerpt: {
      type: String,
      trim: true
    },
    coverImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Story content is required'],
      minlength: [10, 'Story content must be at least 10 characters long']
    },
    authorId: {
      type: mongoose.Schema.Types.Mixed, // Supports ObjectId or string legacy ID
      ref: 'User'
    },
    author: {
      name: {
        type: String,
        default: 'Contributing Writer'
      },
      role: {
        type: String,
        default: 'Essayist'
      },
      avatar: {
        type: String,
        default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      }
    },
    date: {
      type: String
    },
    readTime: {
      type: String,
      default: '4 min read'
    },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published'
    },
    views: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Pre-save hook: compute slug, excerpt, readTime, and human-formatted date
blogSchema.pre('save', function () {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  if (this.isModified('content')) {
    const words = this.content ? this.content.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(words / 170));
    this.readTime = `${minutes} min read`;

    if (!this.excerpt || !this.excerpt.trim()) {
      this.excerpt = this.content.substring(0, 140) + '...';
    }
  }

  if (!this.date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date();
    this.date = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
  }
});

const Blog = mongoose.model('Blog', blogSchema);
module.exports = Blog;

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let isConnected = false;

/**
 * Seed initial users and blogs into MongoDB if the collections are empty
 */
async function seedInitialData() {
  try {
    const User = require('../models/User');
    const Blog = require('../models/Blog');

    const userCount = await User.countDocuments();
    let defaultAuthorId = null;

    if (userCount === 0) {
      const usersFilePath = path.join(__dirname, '../data/users.json');
      if (fs.existsSync(usersFilePath)) {
        const rawUsers = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
        if (Array.isArray(rawUsers) && rawUsers.length > 0) {
          console.log(`[Database Seeding] Seeding ${rawUsers.length} initial user(s) into MongoDB...`);
          for (const u of rawUsers) {
            const userDoc = new User({
              name: u.name,
              username: (u.name || 'writer').toLowerCase().replace(/\s+/g, '_'),
              email: u.email.toLowerCase(),
              password: u.password, // Already bcrypt-hashed
              role: u.role || 'Contributing Writer',
              avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
            });
            const saved = await userDoc.save();
            if (!defaultAuthorId) defaultAuthorId = saved._id;
          }
        }
      }
    } else {
      const firstUser = await User.findOne();
      if (firstUser) defaultAuthorId = firstUser._id;
    }

    const blogCount = await Blog.countDocuments();
    if (blogCount === 0) {
      const blogsFilePath = path.join(__dirname, '../data/blogs.json');
      if (fs.existsSync(blogsFilePath)) {
        const rawBlogs = JSON.parse(fs.readFileSync(blogsFilePath, 'utf-8'));
        if (Array.isArray(rawBlogs) && rawBlogs.length > 0) {
          console.log(`[Database Seeding] Seeding ${rawBlogs.length} initial editorial story/stories into MongoDB...`);
          for (const b of rawBlogs) {
            const blogDoc = new Blog({
              title: b.title,
              slug: b.slug || b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
              category: b.category,
              excerpt: b.excerpt,
              coverImage: b.coverImage,
              content: b.content,
              authorId: defaultAuthorId || 'author_default',
              author: {
                name: b.author?.name || 'Alex Morgan',
                role: b.author?.role || 'Editor-in-Chief',
                avatar: b.author?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
              },
              date: b.date,
              readTime: b.readTime || '4 min read',
              status: b.status || 'published',
              views: b.views || 0,
              createdAt: new Date()
            });
            await blogDoc.save();
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Database Seeding Warning] Seeding skipped or encountered error:', err.message);
  }
}

/**
 * Connect to MongoDB database
 * @param {string} [customUri] Optional connection URI override (e.g. for testing)
 */
async function connectDB(customUri) {
  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/blogspace';

  try {
    // If already connected, return existing connection
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      return mongoose.connection;
    }

    console.log(`[Database] Connecting to MongoDB at: ${uri.replace(/:([^:@]{3,})@/, ':****@')}`);
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout for quick failure detection
    });

    isConnected = true;
    console.log(`[Database] MongoDB Connected successfully! Host: ${conn.connection.host}, DB: ${conn.connection.name}`);

    // Seed initial data if collections are empty
    await seedInitialData();

    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`\x1b[31m[Database Connection Error]\x1b[0m ${error.message}`);
    console.warn(`
----------------------------------------------------------------------
🌿 [BlogSpace Notice]
Could not establish connection to MongoDB.
If you are using MongoDB Atlas, ensure your MONGODB_URI is set in .env:
  MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/blogspace?retryWrites=true&w=majority

If you are using local MongoDB, ensure your MongoDB service is running:
  net start MongoDB  (or mongod)
----------------------------------------------------------------------
`);
    return null;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] MongoDB disconnected.');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  seedInitialData,
  isDBConnected: () => mongoose.connection.readyState === 1
};

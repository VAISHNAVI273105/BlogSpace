require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. Middleware Configuration ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for frontend
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request Logger
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Serve frontend static assets (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname)));

// --- 2. API Routes ---
// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'BlogSpace Editorial REST API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Authentication Routes (/api/auth & direct aliases)
app.use('/api/auth', authRoutes);
app.post('/api/register', (req, res, next) => {
  req.url = '/register';
  authRoutes(req, res, next);
});
app.post('/api/login', (req, res, next) => {
  req.url = '/login';
  authRoutes(req, res, next);
});

// Blog Stories & Metrics Routes
app.use('/api/blogs', blogRoutes);

// --- 3. Fallback Route & Error Handling ---
// 404 for undefined API endpoints
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- 4. Start Server ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
=============================================================
  🌿 BLOGSPACE – Backend REST API Server is Live
=============================================================
  Port:        http://localhost:${PORT}
  Health:      http://localhost:${PORT}/api/health
  API Base:    http://localhost:${PORT}/api
  
  Endpoints Available:
  - POST   /api/auth/register    Register a new user
  - POST   /api/auth/login       User sign-in & token
  - GET    /api/blogs            List all blogs (filter & search)
  - POST   /api/blogs            Create a new blog story
  - GET    /api/blogs/:id        Fetch single blog
  - PUT    /api/blogs/:id        Update existing blog
  - DELETE /api/blogs/:id        Remove a blog story
  - GET    /api/blogs/stats      Fetch live dashboard stats
=============================================================
`);
  });
}

module.exports = app;

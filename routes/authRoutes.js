const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'blogspace_super_secret_jwt_key_2026_earthy_luxe';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Email validation helper
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with bcrypt password hashing in MongoDB
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    const displayName = (name || username || '').trim();

    // Field presence and format validation
    if (!displayName) {
      return res.status(400).json({
        success: false,
        message: 'Full Name or Username is required and must be valid text.'
      });
    }

    if (displayName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full Name must be at least 2 characters long.'
      });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address format (e.g., name@domain.com).'
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    // Duplicate email check in MongoDB
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }

    // Create user model instance (password is automatically hashed via Mongoose pre-save hook)
    const newUser = new User({
      name: displayName,
      username: (username || displayName).toLowerCase().replace(/[^a-z0-9]/g, '_'),
      email: normalizedEmail,
      password: password,
      role: 'Contributing Writer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    });

    await newUser.save();

    // Generate JWT token upon registration
    const token = jwt.sign(
      {
        id: newUser._id.toString(),
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your author membership is now active.',
      user: newUser.toJSON(),
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred during registration.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user from MongoDB using bcrypt password comparison and issue JWT
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email address and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user in MongoDB
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Secure bcrypt password verification
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token with user payload
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: 'Sign-in successful. Welcome back to your studio.',
      user: user.toJSON(),
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred during sign-in.'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Verify current session and return user profile from MongoDB
 * @access  Private (Requires JWT)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: user.toJSON()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving user session.'
    });
  }
});

module.exports = router;

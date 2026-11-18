const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'blogspace_super_secret_jwt_key_2026_earthy_luxe';

/**
 * Authentication Middleware
 * Validates JWT token from the Authorization header (Bearer <token>)
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  // Support 'Bearer <token>' or raw token
  const parts = authHeader.split(' ');
  const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : authHeader;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Malformed authorization header. Expected: Bearer <token>'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, email, name, role
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please sign in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }
}

module.exports = authenticateToken;

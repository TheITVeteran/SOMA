const express = require('express');
const User = require('../models/User');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/users - Search users (for adding to projects)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const users = await User.searchUsers(q, parseInt(limit));
    
    res.json({ users });
  } catch (error) {
    logger.error('User search error:', error);
    res.status(500).json({ message: 'User search failed' });
  }
});

// GET /api/users/profile/:userId - Get user profile
router.get('/profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password -passwordResetToken -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({ message: 'Failed to get user profile' });
  }
});

// Find user by email (for team collaboration)
router.get('/find', authenticateToken, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email query parameter required' });
    }

    const User = require('../models/User');
    const user = await User.findOne({ email: email.toLowerCase() }).select('name email avatar');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error searching for user' });
  }
});

// GET /api/users - Get all users (admin only)
router.get('/', authenticateToken, requirePermission('canManageUsers'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isActive = true } = req.query;
    
    const query = { isActive };
    if (role) query.role = role;
    
    const users = await User.find(query)
      .select('-password -passwordResetToken -emailVerificationToken')
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
});

// PUT /api/users/:userId/role - Update user role (admin only)
router.put('/:userId/role', authenticateToken, requirePermission('canManageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'manager', 'senior', 'staff', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password -passwordResetToken -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    logger.audit.activity(req.user._id, 'USER', 'ROLE_UPDATE', {
      targetUserId: userId,
      newRole: role
    });
    
    res.json({ user });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// PUT /api/users/:userId/status - Activate/deactivate user (admin only)
router.put('/:userId/status', authenticateToken, requirePermission('canManageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password -passwordResetToken -emailVerificationToken');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    logger.audit.activity(req.user._id, 'USER', isActive ? 'ACTIVATE' : 'DEACTIVATE', {
      targetUserId: userId
    });
    
    res.json({ user });
  } catch (error) {
    logger.error('Update user status error:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

module.exports = router;

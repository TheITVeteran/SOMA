const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');
const { authenticateToken, rateLimitAuth, rateLimitSensitive } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const Organization = require('../models/Organization'); // Import Organization

// POST /api/auth/register
router.post('/register', rateLimitAuth, async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      company, 
      title 
    } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        message: 'Email, password, first name, and last name are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // --- Organization Logic ---
    let organizationId = null;
    const emailDomain = email.split('@')[1].toLowerCase();
    
    // 1. Check for existing Org by Domain
    let org = await Organization.findOne({ domain: emailDomain });
    
    // 2. If not found by domain, check by Company Name (if provided)
    if (!org && company) {
        org = await Organization.findOne({ name: new RegExp('^'+company+'$', "i") });
    }

    // 3. Create new Org if needed (and company name provided)
    let isNewOrg = false;
    if (!org && company) {
        // Exclude generic domains from auto-creating domain-locked orgs
        const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
        const domainToSave = genericDomains.includes(emailDomain) ? null : emailDomain;

        org = new Organization({
            name: company,
            domain: domainToSave,
            settings: { allowDomainAutoJoin: !!domainToSave }
        });
        await org.save();
        isNewOrg = true;
    }

    organizationId = org ? org._id : null;

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password,
      organizationId,
      role: isNewOrg ? 'admin' : 'staff', // First user is admin
      profile: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company?.trim() || org?.name,
        title: title?.trim()
      }
    });

    await user.save();

    // Link User to Org
    if (org) {
        org.members.push(user._id);
        if (isNewOrg) org.owner = user._id;
        await org.save();
    }

    // Generate token
    const token = generateToken(user._id);

    // Log successful registration
    logger.audit.activity(user._id, 'AUTH', 'REGISTER', {
      email: user.email,
      ip: req.ip,
      organization: org?.name
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        role: user.role,
        organization: org ? { id: org._id, name: org.name } : null,
        permissions: user.permissions
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      message: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// POST /api/auth/login
router.post('/login', rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      logger.audit.login('unknown', req.ip, req.get('User-Agent'), false);
      return res.status(401).json({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      logger.audit.securityEvent(user._id, 'LOGIN_INACTIVE_ACCOUNT', { email });
      return res.status(401).json({
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      logger.audit.login(user._id, req.ip, req.get('User-Agent'), false);
      return res.status(401).json({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    await user.updateLastLogin(req.ip, req.get('User-Agent'));

    // Generate token
    const token = generateToken(user._id);

    // Log successful login
    logger.audit.login(user._id, req.ip, req.get('User-Agent'), true);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        role: user.role,
        permissions: user.permissions,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout
    logger.audit.logout(req.user._id, req.ip);
    
    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      message: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// GET /api/auth/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        profile: req.user.profile,
        role: req.user.role,
        permissions: req.user.permissions,
        preferences: req.user.preferences,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch profile',
      code: 'PROFILE_ERROR'
    });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'profile.firstName', 'profile.lastName', 'profile.displayName',
      'profile.title', 'profile.company', 'profile.department', 
      'profile.phone', 'profile.expertise', 'profile.bio',
      'preferences.theme', 'preferences.notifications', 'preferences.defaultProjectView',
      'preferences.ai.riskTolerance', 'preferences.ai.explanationStyle', 'preferences.ai.tone'
    ];

    // Filter updates to only allowed fields
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    logger.audit.activity(req.user._id, 'USER', 'UPDATE_PROFILE', {
      updatedFields: Object.keys(filteredUpdates)
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        role: user.role,
        permissions: user.permissions,
        preferences: user.preferences
      }
    });

  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({
      message: 'Profile update failed',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, rateLimitSensitive, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      logger.audit.securityEvent(req.user._id, 'INVALID_PASSWORD_CHANGE', {});
      return res.status(401).json({
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.audit.securityEvent(req.user._id, 'PASSWORD_CHANGED', {}, 'low');

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      message: 'Password change failed',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', rateLimitSensitive, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();

    // TODO: Send email with reset link
    // const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
    
    logger.audit.activity(user._id, 'AUTH', 'PASSWORD_RESET_REQUESTED', {
      email: user.email,
      ip: req.ip
    });

    res.json({
      message: 'If the email exists, a password reset link has been sent'
    });

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Password reset request failed',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', rateLimitSensitive, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { token } = req.params;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long',
        code: 'INVALID_PASSWORD'
      });
    }

    // Hash the token to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();

    logger.audit.securityEvent(user._id, 'PASSWORD_RESET_COMPLETED', {}, 'low');

    res.json({
      message: 'Password reset successful'
    });

  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({
      message: 'Password reset failed',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

// GET /api/auth/verify-token
router.get('/verify-token', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      profile: req.user.profile,
      role: req.user.role,
      permissions: req.user.permissions
    }
  });
});

// TODO: OAuth routes (Google, Microsoft)
// These would require additional setup with passport.js strategies

module.exports = router;
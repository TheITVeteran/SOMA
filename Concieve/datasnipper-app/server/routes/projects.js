const express = require('express');
const Project = require('../models/Project');
const { authenticateToken, requireProjectAccess } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/projects - Get user's projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, sort = '-metrics.lastActivity' } = req.query;
    const options = { status, sort };
    
    const projects = await Project.findUserProjects(req.user._id, options);
    
    res.json({ projects });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ message: 'Failed to get projects' });
  }
});

// POST /api/projects - Create new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      team: {
        owner: req.user._id,
        members: []
      }
    };
    
    const project = new Project(projectData);
    await project.save();
    
    logger.audit.projectCreated(req.user._id, project._id, project.name);
    
    res.status(201).json({ project });
  } catch (error) {
    logger.error('Create project error:', error);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

// GET /api/projects/:projectId - Get project details
router.get('/:projectId', authenticateToken, requireProjectAccess('read'), async (req, res) => {
  try {
    const project = req.project; // Set by requireProjectAccess middleware
    
    logger.audit.projectAccessed(req.user._id, project._id, 'VIEW');
    
    res.json({ project });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({ message: 'Failed to get project' });
  }
});

// PUT /api/projects/:projectId - Update project
router.put('/:projectId', authenticateToken, requireProjectAccess('edit'), async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'description', 'client', 'type', 'status', 'priority',
      'dates', 'settings', 'auditAreas', 'tags'
    ];
    
    const updates = {};
    allowedUpdates.forEach(key => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });
    
    const project = await Project.findByIdAndUpdate(
      req.params.projectId,
      updates,
      { new: true, runValidators: true }
    ).populate('team.owner team.members.user', 'profile.firstName profile.lastName profile.avatar email');
    
    logger.audit.projectModified(req.user._id, project._id, Object.keys(updates));
    
    res.json({ project });
  } catch (error) {
    logger.error('Update project error:', error);
    res.status(500).json({ message: 'Failed to update project' });
  }
});

// DELETE /api/projects/:projectId - Delete project
router.delete('/:projectId', authenticateToken, requireProjectAccess('delete'), async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.projectId);
    
    logger.audit.activity(req.user._id, 'PROJECT', 'DELETE', {
      projectId: req.params.projectId
    });
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({ message: 'Failed to delete project' });
  }
});

// POST /api/projects/:projectId/team - Add team member
router.post('/:projectId/team', authenticateToken, requireProjectAccess('invite'), async (req, res) => {
  try {
    const { userId, role = 'Staff', permissions = {} } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const project = await Project.findById(req.params.projectId);
    await project.addTeamMember(userId, role, permissions);
    
    await project.populate('team.members.user', 'profile.firstName profile.lastName profile.avatar email');
    
    logger.audit.teamMemberAdded(req.user._id, project._id, userId, role);
    
    res.json({ project });
  } catch (error) {
    logger.error('Add team member error:', error);
    const message = error.message === 'User is already a team member' 
      ? error.message 
      : 'Failed to add team member';
    res.status(error.message === 'User is already a team member' ? 400 : 500).json({ message });
  }
});

// DELETE /api/projects/:projectId/team/:userId - Remove team member
router.delete('/:projectId/team/:userId', authenticateToken, requireProjectAccess('invite'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    const project = await Project.findById(req.params.projectId);
    await project.removeTeamMember(userId);
    
    await project.populate('team.members.user', 'profile.firstName profile.lastName profile.avatar email');
    
    logger.audit.teamMemberRemoved(req.user._id, project._id, userId);
    
    res.json({ project });
  } catch (error) {
    logger.error('Remove team member error:', error);
    const message = error.message === 'Cannot remove project owner' 
      ? error.message 
      : 'Failed to remove team member';
    res.status(error.message === 'Cannot remove project owner' ? 400 : 500).json({ message });
  }
});

// PUT /api/projects/:projectId/team/:userId - Update team member permissions
router.put('/:projectId/team/:userId', authenticateToken, requireProjectAccess('invite'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, permissions } = req.body;
    
    const project = await Project.findById(req.params.projectId);
    
    // Find and update team member
    const member = project.team.members.find(m => m.user.toString() === userId);
    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }
    
    if (role) member.role = role;
    if (permissions) member.permissions = { ...member.permissions, ...permissions };
    
    await project.save();
    await project.populate('team.members.user', 'profile.firstName profile.lastName profile.avatar email');
    
    logger.audit.activity(req.user._id, 'PROJECT', 'UPDATE_MEMBER', {
      projectId: project._id,
      targetUserId: userId,
      role,
      permissions
    });
    
    res.json({ project });
  } catch (error) {
    logger.error('Update team member error:', error);
    res.status(500).json({ message: 'Failed to update team member' });
  }
});

module.exports = router;

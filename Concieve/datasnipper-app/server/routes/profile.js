const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database setup
const dbPath = path.join(__dirname, '../data/users.db');
const db = new sqlite3.Database(dbPath);

// Initialize user profiles table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    role TEXT DEFAULT 'Auditor',
    organization TEXT DEFAULT 'Conceive Audit',
    department TEXT,
    certifications TEXT DEFAULT '[]',
    areas_of_expertise TEXT DEFAULT '[]',
    manager_name TEXT,
    location TEXT,
    timezone TEXT DEFAULT 'UTC',
    status TEXT DEFAULT 'Active',
    access_level TEXT DEFAULT 'Standard',
    mfa_enabled INTEGER DEFAULT 0,
    last_password_reset DATETIME,
    preferences TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS user_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    project_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_profiles (id)
  )`);
});

// Get user profile
router.get('/me', (req, res) => {
  // For now, we'll use a default user since auth is disabled
  // In production, you'd get user ID from JWT token
  const defaultEmail = 'john@conceive.com';
  
  db.get(
    'SELECT * FROM user_profiles WHERE email = ?',
    [defaultEmail],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        // Create default user if doesn't exist
        db.run(
          `INSERT INTO user_profiles (email, name, role, organization, certifications, areas_of_expertise) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [defaultEmail, 'John Doe', 'Senior Auditor', 'Conceive Audit', JSON.stringify(['CPA']), JSON.stringify(['Financial Audit', 'Risk Assessment'])],
          function(err) {
            if (err) {
              console.error('Error creating user:', err);
              return res.status(500).json({ error: 'Error creating user' });
            }
            
            const newUser = {
              id: this.lastID,
              email: defaultEmail,
              name: 'John Doe',
              avatar: null,
              role: 'Senior Auditor',
              organization: 'Conceive Audit',
              department: null,
              certifications: JSON.stringify(['CPA']),
              areas_of_expertise: JSON.stringify(['Financial Audit', 'Risk Assessment']),
              manager_name: null,
              location: null,
              timezone: 'UTC',
              status: 'Active',
              access_level: 'Standard',
              mfa_enabled: 0,
              last_password_reset: null,
              preferences: '{}'
            };
            
            res.json(newUser);
          }
        );
      } else {
        res.json(user);
      }
    }
  );
});

// Update user profile
router.put('/me', (req, res) => {
  const { 
    name, avatar, role, organization, department, certifications, 
    areas_of_expertise, manager_name, location, timezone, preferences 
  } = req.body;
  const defaultEmail = 'john@conceive.com';
  
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  
  db.run(
    `UPDATE user_profiles 
     SET name = ?, avatar = ?, role = ?, organization = ?, department = ?, 
         certifications = ?, areas_of_expertise = ?, manager_name = ?, location = ?, 
         timezone = ?, preferences = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE email = ?`,
    [
      name.trim(), 
      avatar || null, 
      role || 'Auditor',
      organization || 'Conceive Audit',
      department || null,
      JSON.stringify(certifications || []),
      JSON.stringify(areas_of_expertise || []),
      manager_name || null,
      location || null,
      timezone || 'UTC',
      JSON.stringify(preferences || {}), 
      defaultEmail
    ],
    function(err) {
      if (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ error: 'Error updating profile' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return updated user
      db.get(
        'SELECT * FROM user_profiles WHERE email = ?',
        [defaultEmail],
        (err, user) => {
          if (err) {
            console.error('Error fetching updated user:', err);
            return res.status(500).json({ error: 'Error fetching updated user' });
          }
          res.json(user);
        }
      );
    }
  );
});

// Get user projects
router.get('/projects', (req, res) => {
  const defaultEmail = 'john@conceive.com';
  
  // First get user ID
  db.get(
    'SELECT id FROM user_profiles WHERE email = ?',
    [defaultEmail],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      db.all(
        'SELECT * FROM user_projects WHERE user_id = ? ORDER BY created_at DESC',
        [user.id],
        (err, projects) => {
          if (err) {
            console.error('Error fetching projects:', err);
            return res.status(500).json({ error: 'Error fetching projects' });
          }
          res.json(projects);
        }
      );
    }
  );
});

// Add new project
router.post('/projects', (req, res) => {
  const { project_name, project_description } = req.body;
  const defaultEmail = 'john@conceive.com';
  
  if (!project_name || project_name.trim().length < 2) {
    return res.status(400).json({ error: 'Project name must be at least 2 characters' });
  }
  
  // First get user ID
  db.get(
    'SELECT id FROM user_profiles WHERE email = ?',
    [defaultEmail],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      db.run(
        'INSERT INTO user_projects (user_id, project_name, project_description) VALUES (?, ?, ?)',
        [user.id, project_name.trim(), project_description || ''],
        function(err) {
          if (err) {
            console.error('Error adding project:', err);
            return res.status(500).json({ error: 'Error adding project' });
          }
          
          const newProject = {
            id: this.lastID,
            user_id: user.id,
            project_name: project_name.trim(),
            project_description: project_description || '',
            created_at: new Date().toISOString()
          };
          
          res.status(201).json(newProject);
        }
      );
    }
  );
});

// Delete project
router.delete('/projects/:id', (req, res) => {
  const projectId = req.params.id;
  const defaultEmail = 'john@conceive.com';
  
  // First get user ID and verify project ownership
  db.get(
    `SELECT up.id as user_id, pr.id as project_id 
     FROM user_profiles up 
     LEFT JOIN user_projects pr ON up.id = pr.user_id 
     WHERE up.email = ? AND pr.id = ?`,
    [defaultEmail, projectId],
    (err, result) => {
      if (err) {
        console.error('Error verifying project ownership:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!result || !result.project_id) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }
      
      db.run(
        'DELETE FROM user_projects WHERE id = ?',
        [projectId],
        function(err) {
          if (err) {
            console.error('Error deleting project:', err);
            return res.status(500).json({ error: 'Error deleting project' });
          }
          
          res.json({ message: 'Project deleted successfully' });
        }
      );
    }
  );
});

module.exports = router;
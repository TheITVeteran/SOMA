const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logActivity, createNotification, updateDailyMetrics } = require('./dashboard');

const router = express.Router();

// Database setup
const dbPath = path.join(__dirname, '../data/users.db');
const db = new sqlite3.Database(dbPath);

// Initialize PBC tables
db.serialize(() => {
  // PBC templates table
  db.run(`CREATE TABLE IF NOT EXISTS pbc_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    audit_type TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // PBC template items
  db.run(`CREATE TABLE IF NOT EXISTS pbc_template_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    required INTEGER DEFAULT 1,
    due_days INTEGER DEFAULT 7,
    order_index INTEGER DEFAULT 0,
    ai_keywords TEXT DEFAULT '[]',
    FOREIGN KEY (template_id) REFERENCES pbc_templates(id)
  )`);
  
  // Project PBC instances
  db.run(`CREATE TABLE IF NOT EXISTS project_pbc_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    template_id INTEGER,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    due_date DATE,
    completion_percentage REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (template_id) REFERENCES pbc_templates(id)
  )`);
  
  // PBC items for specific projects
  db.run(`CREATE TABLE IF NOT EXISTS pbc_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pbc_list_id INTEGER,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'requested',
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    assigned_to TEXT,
    reviewer TEXT,
    file_ids TEXT DEFAULT '[]',
    comments TEXT DEFAULT '[]',
    ai_keywords TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (pbc_list_id) REFERENCES project_pbc_lists(id)
  )`);
  
  // Insert default templates
  db.get("SELECT COUNT(*) as count FROM pbc_templates", [], (err, row) => {
    if (!err && row.count === 0) {
      insertDefaultTemplates();
    }
  });
});

// Insert default PBC templates and items
function insertDefaultTemplates() {
  const templates = [
    {
      name: 'Financial Audit - Full Scope',
      audit_type: 'financial',
      description: 'Comprehensive financial audit checklist',
      category: 'audit',
      is_default: 1
    },
    {
      name: 'Tax Review',
      audit_type: 'tax',
      description: 'Tax compliance and provision review',
      category: 'tax',
      is_default: 1
    },
    {
      name: 'SOX Compliance',
      audit_type: 'compliance',
      description: 'Sarbanes-Oxley compliance testing',
      category: 'compliance',
      is_default: 1
    }
  ];

  templates.forEach(template => {
    db.run(
      `INSERT INTO pbc_templates (name, audit_type, description, category, is_default) 
       VALUES (?, ?, ?, ?, ?)`,
      [template.name, template.audit_type, template.description, template.category, template.is_default],
      function(err) {
        if (!err) {
          insertTemplateItems(this.lastID, template.audit_type);
        }
      }
    );
  });
}

function insertTemplateItems(templateId, auditType) {
  let items = [];
  
  if (auditType === 'financial') {
    items = [
      { category: 'General', title: 'Organizational Chart', description: 'Current organizational structure', required: 1, due_days: 3, ai_keywords: '["org chart", "organizational", "structure"]' },
      { category: 'General', title: 'Prior Year Audit Reports', description: 'Previous audit reports and management letters', required: 1, due_days: 5, ai_keywords: '["audit report", "management letter", "prior year"]' },
      { category: 'Cash & Bank', title: 'Bank Statements', description: 'All bank statements for the period', required: 1, due_days: 5, ai_keywords: '["bank statement", "banking", "cash"]' },
      { category: 'Cash & Bank', title: 'Bank Reconciliations', description: 'Month-end bank reconciliations', required: 1, due_days: 7, ai_keywords: '["bank reconciliation", "recon", "cash recon"]' },
      { category: 'Accounts Receivable', title: 'AR Aging Report', description: 'Detailed accounts receivable aging', required: 1, due_days: 5, ai_keywords: '["ar aging", "receivables", "aging report"]' },
      { category: 'Accounts Receivable', title: 'Sales Invoices', description: 'Sample of sales invoices', required: 1, due_days: 10, ai_keywords: '["sales invoice", "invoice", "billing"]' },
      { category: 'Fixed Assets', title: 'Fixed Asset Register', description: 'Complete fixed asset listing', required: 1, due_days: 7, ai_keywords: '["fixed asset", "asset register", "depreciation"]' },
      { category: 'Fixed Assets', title: 'Depreciation Schedule', description: 'Depreciation calculations and schedules', required: 1, due_days: 10, ai_keywords: '["depreciation", "amortization", "asset schedule"]' },
      { category: 'Payroll', title: 'Payroll Register', description: 'Detailed payroll records', required: 1, due_days: 7, ai_keywords: '["payroll", "payroll register", "wages"]' },
      { category: 'Revenue', title: 'Revenue Contracts', description: 'Major customer contracts and agreements', required: 1, due_days: 14, ai_keywords: '["revenue contract", "customer agreement", "contract"]' }
    ];
  } else if (auditType === 'tax') {
    items = [
      { category: 'Tax Returns', title: 'Federal Tax Returns', description: 'Filed federal tax returns', required: 1, due_days: 5, ai_keywords: '["tax return", "federal", "1120"]' },
      { category: 'Tax Returns', title: 'State Tax Returns', description: 'All state tax filings', required: 1, due_days: 5, ai_keywords: '["state tax", "tax return", "state filing"]' },
      { category: 'Tax Schedules', title: 'M-1 Schedule', description: 'Book-to-tax differences', required: 1, due_days: 7, ai_keywords: '["M-1", "book tax", "differences"]' },
      { category: 'Tax Provision', title: 'Tax Provision Calculation', description: 'Current and deferred tax calculations', required: 1, due_days: 10, ai_keywords: '["tax provision", "deferred tax", "tax expense"]' }
    ];
  } else if (auditType === 'compliance') {
    items = [
      { category: 'Controls', title: 'Internal Control Documentation', description: 'ICFR documentation and testing', required: 1, due_days: 14, ai_keywords: '["internal control", "ICFR", "SOX"]' },
      { category: 'Controls', title: 'Management Assertions', description: 'Management assertions on controls', required: 1, due_days: 10, ai_keywords: '["management assertion", "control assertion"]' },
      { category: 'IT Controls', title: 'IT General Controls', description: 'IT access controls and system documentation', required: 1, due_days: 21, ai_keywords: '["IT controls", "access control", "system controls"]' }
    ];
  }

  items.forEach((item, index) => {
    db.run(
      `INSERT INTO pbc_template_items 
       (template_id, category, title, description, required, due_days, order_index, ai_keywords) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [templateId, item.category, item.title, item.description, item.required, item.due_days, index, item.ai_keywords]
    );
  });
}

// Get all PBC templates
router.get('/templates', (req, res) => {
  db.all('SELECT * FROM pbc_templates ORDER BY name', [], (err, templates) => {
    if (err) {
      console.error('Error fetching PBC templates:', err);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }
    res.json(templates);
  });
});

// Get template items
router.get('/templates/:templateId/items', (req, res) => {
  const templateId = req.params.templateId;
  
  db.all(
    'SELECT * FROM pbc_template_items WHERE template_id = ? ORDER BY order_index, category, title',
    [templateId],
    (err, items) => {
      if (err) {
        console.error('Error fetching template items:', err);
        return res.status(500).json({ error: 'Failed to fetch template items' });
      }
      
      // Group by category
      const categorized = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push({
          ...item,
          ai_keywords: JSON.parse(item.ai_keywords)
        });
        return acc;
      }, {});
      
      res.json(categorized);
    }
  );
});

// Create PBC list from template for a project
router.post('/create-from-template', (req, res) => {
  const { projectId, templateId, name, dueDate } = req.body;
  const userEmail = 'john@conceive.com'; // Current user
  
  if (!projectId || !templateId) {
    return res.status(400).json({ error: 'Project ID and template ID are required' });
  }
  
  // Create PBC list
  db.run(
    `INSERT INTO project_pbc_lists (project_id, template_id, name, due_date, created_by) 
     VALUES (?, ?, ?, ?, ?)`,
    [projectId, templateId, name, dueDate, userEmail],
    function(err) {
      if (err) {
        console.error('Error creating PBC list:', err);
        return res.status(500).json({ error: 'Failed to create PBC list' });
      }
      
      const pbcListId = this.lastID;
      
      // Copy template items to project PBC items
      db.all(
        'SELECT * FROM pbc_template_items WHERE template_id = ? ORDER BY order_index',
        [templateId],
        (err, templateItems) => {
          if (err) {
            console.error('Error fetching template items:', err);
            return res.status(500).json({ error: 'Failed to copy template items' });
          }
          
          const insertPromises = templateItems.map(item => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + item.due_days);
            
            return new Promise((resolve, reject) => {
              db.run(
                `INSERT INTO pbc_items 
                 (pbc_list_id, category, title, description, due_date, ai_keywords) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [pbcListId, item.category, item.title, item.description, dueDate.toISOString().split('T')[0], item.ai_keywords],
                function(err) {
                  if (err) reject(err);
                  else resolve(this.lastID);
                }
              );
            });
          });
          
          Promise.all(insertPromises)
            .then(() => {
              // Log activity
              logActivity(userEmail, 'pbc_created', {
                project: projectId,
                template: templateId,
                itemCount: templateItems.length
              });
              
              // Create notification
              createNotification(
                userEmail,
                'PBC Checklist Created',
                `${name} created with ${templateItems.length} items`,
                'success',
                '📋'
              );
              
              res.status(201).json({
                message: 'PBC list created successfully',
                pbcListId,
                itemsCreated: templateItems.length
              });
            })
            .catch(err => {
              console.error('Error copying template items:', err);
              res.status(500).json({ error: 'Failed to create PBC items' });
            });
        }
      );
    }
  );
});

// Get PBC lists for a project
router.get('/project/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  
  db.all(
    `SELECT pl.*, pt.name as template_name, pt.audit_type,
            COUNT(pi.id) as total_items,
            COUNT(CASE WHEN pi.status = 'completed' THEN 1 END) as completed_items
     FROM project_pbc_lists pl
     LEFT JOIN pbc_templates pt ON pl.template_id = pt.id
     LEFT JOIN pbc_items pi ON pl.id = pi.pbc_list_id
     WHERE pl.project_id = ?
     GROUP BY pl.id
     ORDER BY pl.created_at DESC`,
    [projectId],
    (err, lists) => {
      if (err) {
        console.error('Error fetching project PBC lists:', err);
        return res.status(500).json({ error: 'Failed to fetch PBC lists' });
      }
      
      const enrichedLists = lists.map(list => ({
        ...list,
        completion_percentage: list.total_items > 0 ? 
          Math.round((list.completed_items / list.total_items) * 100) : 0
      }));
      
      res.json(enrichedLists);
    }
  );
});

// Get PBC items for a specific list
router.get('/list/:pbcListId/items', (req, res) => {
  const pbcListId = req.params.pbcListId;
  
  db.all(
    'SELECT * FROM pbc_items WHERE pbc_list_id = ? ORDER BY category, title',
    [pbcListId],
    (err, items) => {
      if (err) {
        console.error('Error fetching PBC items:', err);
        return res.status(500).json({ error: 'Failed to fetch PBC items' });
      }
      
      // Group by category and enrich data
      const categorized = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        
        acc[item.category].push({
          ...item,
          file_ids: JSON.parse(item.file_ids),
          comments: JSON.parse(item.comments),
          ai_keywords: JSON.parse(item.ai_keywords),
          overdue: item.due_date && new Date(item.due_date) < new Date() && item.status !== 'completed'
        });
        return acc;
      }, {});
      
      res.json(categorized);
    }
  );
});

// Update PBC item status
router.put('/items/:itemId/status', (req, res) => {
  const itemId = req.params.itemId;
  const { status, reviewerComments, assignedTo } = req.body;
  const userEmail = 'john@conceive.com';
  
  const validStatuses = ['requested', 'received', 'under_review', 'approved', 'rejected', 'completed'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // Get current item data for notifications
  db.get('SELECT * FROM pbc_items WHERE id = ?', [itemId], (err, item) => {
    if (err || !item) {
      return res.status(404).json({ error: 'PBC item not found' });
    }
    
    const updateData = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null
    };
    
    if (assignedTo) updateData.assigned_to = assignedTo;
    if (reviewerComments) updateData.reviewer = userEmail;
    
    // Add comment if provided
    let comments = JSON.parse(item.comments || '[]');
    if (reviewerComments) {
      comments.push({
        user: userEmail,
        comment: reviewerComments,
        timestamp: new Date().toISOString()
      });
      updateData.comments = JSON.stringify(comments);
    }
    
    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData).concat([itemId]);
    
    db.run(
      `UPDATE pbc_items SET ${setClause} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          console.error('Error updating PBC item:', err);
          return res.status(500).json({ error: 'Failed to update item' });
        }
        
        // Update list completion percentage
        updateListCompletion(item.pbc_list_id);
        
        // Log activity
        logActivity(userEmail, 'pbc_item_updated', {
          item: item.title,
          status,
          itemId
        });
        
        // Create notification for status changes
        if (status === 'completed') {
          createNotification(
            userEmail,
            'PBC Item Completed',
            `"${item.title}" has been marked as completed`,
            'success',
            '✅'
          );
        } else if (status === 'rejected') {
          createNotification(
            userEmail,
            'PBC Item Needs Attention',
            `"${item.title}" requires revision`,
            'warning',
            '⚠️'
          );
        }
        
        res.json({ message: 'PBC item updated successfully', changes: this.changes });
      }
    );
  });
});

// AI-powered file matching to PBC items
router.post('/ai-match-files/:pbcListId', (req, res) => {
  const pbcListId = req.params.pbcListId;
  const userEmail = 'john@conceive.com';
  
  // Get all PBC items for this list
  db.all(
    'SELECT * FROM pbc_items WHERE pbc_list_id = ? AND status != "completed"',
    [pbcListId],
    (err, pbcItems) => {
      if (err) {
        console.error('Error fetching PBC items:', err);
        return res.status(500).json({ error: 'Failed to fetch PBC items' });
      }
      
      // Get recent uploaded files
      db.all(
        'SELECT * FROM user_files WHERE user_email = ? AND upload_date >= date("now", "-7 days") ORDER BY upload_date DESC',
        [userEmail],
        (err, files) => {
          if (err) {
            console.error('Error fetching files:', err);
            return res.status(500).json({ error: 'Failed to fetch files' });
          }
          
          // AI matching logic (simplified)
          const matches = [];
          
          files.forEach(file => {
            pbcItems.forEach(pbcItem => {
              const keywords = JSON.parse(pbcItem.ai_keywords || '[]');
              const fileName = file.original_name.toLowerCase();
              
              // Check for keyword matches
              const matchScore = keywords.reduce((score, keyword) => {
                if (fileName.includes(keyword.toLowerCase())) {
                  return score + 1;
                }
                return score;
              }, 0);
              
              if (matchScore > 0) {
                matches.push({
                  pbcItemId: pbcItem.id,
                  pbcItemTitle: pbcItem.title,
                  fileId: file.id,
                  fileName: file.original_name,
                  matchScore,
                  confidence: Math.min(matchScore / keywords.length, 1)
                });
              }
            });
          });
          
          // Sort by match score
          matches.sort((a, b) => b.matchScore - a.matchScore);
          
          res.json({
            message: 'AI file matching completed',
            matches: matches.slice(0, 10), // Top 10 matches
            totalMatches: matches.length
          });
        }
      );
    }
  );
});

// Link file to PBC item
router.post('/items/:itemId/attach-file', (req, res) => {
  const itemId = req.params.itemId;
  const { fileId } = req.body;
  const userEmail = 'john@conceive.com';
  
  if (!fileId) {
    return res.status(400).json({ error: 'File ID is required' });
  }
  
  // Get current item
  db.get('SELECT * FROM pbc_items WHERE id = ?', [itemId], (err, item) => {
    if (err || !item) {
      return res.status(404).json({ error: 'PBC item not found' });
    }
    
    // Add file ID to the list
    let fileIds = JSON.parse(item.file_ids || '[]');
    if (!fileIds.includes(parseInt(fileId))) {
      fileIds.push(parseInt(fileId));
    }
    
    // Update item status to received if it was requested
    const newStatus = item.status === 'requested' ? 'received' : item.status;
    
    db.run(
      'UPDATE pbc_items SET file_ids = ?, status = ? WHERE id = ?',
      [JSON.stringify(fileIds), newStatus, itemId],
      function(err) {
        if (err) {
          console.error('Error attaching file to PBC item:', err);
          return res.status(500).json({ error: 'Failed to attach file' });
        }
        
        // Update list completion
        updateListCompletion(item.pbc_list_id);
        
        // Log activity
        logActivity(userEmail, 'pbc_file_attached', {
          item: item.title,
          fileId
        });
        
        res.json({ message: 'File attached successfully', changes: this.changes });
      }
    );
  });
});

// Helper function to update list completion percentage
function updateListCompletion(pbcListId) {
  db.all(
    'SELECT COUNT(*) as total, COUNT(CASE WHEN status = "completed" THEN 1 END) as completed FROM pbc_items WHERE pbc_list_id = ?',
    [pbcListId],
    (err, results) => {
      if (!err && results[0]) {
        const { total, completed } = results[0];
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        
        db.run(
          'UPDATE project_pbc_lists SET completion_percentage = ? WHERE id = ?',
          [percentage, pbcListId]
        );
      }
    }
  );
}

// Get PBC statistics
router.get('/stats', (req, res) => {
  const stats = {};
  
  Promise.all([
    // Total PBC lists
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM project_pbc_lists', [], (err, row) => {
        resolve(err ? 0 : row.count);
      });
    }),
    
    // Active PBC lists
    new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM project_pbc_lists WHERE status = "active"', [], (err, row) => {
        resolve(err ? 0 : row.count);
      });
    }),
    
    // Completed items this week
    new Promise((resolve) => {
      db.get(
        'SELECT COUNT(*) as count FROM pbc_items WHERE status = "completed" AND completed_at >= date("now", "-7 days")',
        [],
        (err, row) => resolve(err ? 0 : row.count)
      );
    }),
    
    // Overdue items
    new Promise((resolve) => {
      db.get(
        'SELECT COUNT(*) as count FROM pbc_items WHERE due_date < date("now") AND status != "completed"',
        [],
        (err, row) => resolve(err ? 0 : row.count)
      );
    })
  ]).then(([totalLists, activeLists, completedThisWeek, overdueItems]) => {
    res.json({
      totalLists,
      activeLists,
      completedThisWeek,
      overdueItems,
      aiMatching: true,
      automatedReminders: true
    });
  });
});

module.exports = router;
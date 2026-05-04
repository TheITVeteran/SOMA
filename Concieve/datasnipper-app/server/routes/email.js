const express = require('express');
const EmailIntegrationService = require('../services/emailIntegration');
const { logActivity, createNotification } = require('./dashboard');

const router = express.Router();
const emailService = new EmailIntegrationService();

// Configure email monitoring for a project
router.post('/configure', async (req, res) => {
  try {
    const {
      emailAddress,
      imapHost,
      imapPort,
      emailPassword,
      projectId,
      keywords
    } = req.body;

    const userEmail = 'john@conceive.com'; // Current user

    if (!emailAddress || !imapHost || !emailPassword) {
      return res.status(400).json({ 
        error: 'Email address, IMAP host, and password are required' 
      });
    }

    const config = await emailService.configureEmail({
      userEmail,
      emailAddress,
      imapHost,
      imapPort: imapPort || 993,
      emailPassword,
      projectId,
      keywords: keywords || []
    });

    // Start monitoring immediately
    await emailService.startMonitoring(config.id);

    logActivity(userEmail, 'email_configured', {
      emailAddress,
      projectId,
      imapHost
    });

    createNotification(
      userEmail,
      'Email Integration Configured',
      `Now monitoring ${emailAddress} for PBC documents`,
      'success',
      '📧'
    );

    res.status(201).json({
      message: 'Email monitoring configured and started',
      configId: config.id,
      monitoring: true
    });

  } catch (error) {
    console.error('Error configuring email:', error);
    res.status(500).json({ 
      error: 'Failed to configure email monitoring',
      details: error.message 
    });
  }
});

// Add client email mapping
router.post('/add-client-mapping', async (req, res) => {
  try {
    const { clientEmail, projectId, autoApprove } = req.body;
    const userEmail = 'john@conceive.com';

    if (!clientEmail || !projectId) {
      return res.status(400).json({ 
        error: 'Client email and project ID are required' 
      });
    }

    const mappingId = await emailService.addClientMapping(
      clientEmail, 
      projectId, 
      userEmail, 
      autoApprove || false
    );

    logActivity(userEmail, 'client_email_mapped', {
      clientEmail,
      projectId,
      autoApprove
    });

    res.status(201).json({
      message: 'Client email mapping added successfully',
      mappingId,
      clientEmail,
      projectId
    });

  } catch (error) {
    console.error('Error adding client mapping:', error);
    res.status(500).json({ 
      error: 'Failed to add client mapping',
      details: error.message 
    });
  }
});

// Get email processing statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await emailService.getEmailStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: 'Failed to fetch email statistics' });
  }
});

// Get email processing log
router.get('/processing-log', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  
  emailService.db.all(
    `SELECT epl.*, cm.project_id, cm.auto_approve
     FROM email_processing_log epl
     LEFT JOIN client_email_mappings cm ON epl.sender_email = cm.client_email
     ORDER BY epl.processed_at DESC
     LIMIT ?`,
    [limit],
    (err, logs) => {
      if (err) {
        console.error('Error fetching processing log:', err);
        return res.status(500).json({ error: 'Failed to fetch processing log' });
      }

      const formattedLogs = logs.map(log => ({
        ...log,
        timeAgo: formatRelativeTime(log.processed_at),
        status: log.files_extracted > 0 ? 'success' : 
                log.pbc_matches > 0 ? 'matched' : 'processed'
      }));

      res.json(formattedLogs);
    }
  );
});

// Get client email mappings
router.get('/client-mappings', (req, res) => {
  const userEmail = 'john@conceive.com';
  
  emailService.db.all(
    'SELECT * FROM client_email_mappings WHERE user_email = ? ORDER BY created_at DESC',
    [userEmail],
    (err, mappings) => {
      if (err) {
        console.error('Error fetching client mappings:', err);
        return res.status(500).json({ error: 'Failed to fetch client mappings' });
      }

      res.json(mappings);
    }
  );
});

// Test email connection
router.post('/test-connection', async (req, res) => {
  try {
    const { emailAddress, imapHost, imapPort, emailPassword } = req.body;

    if (!emailAddress || !imapHost || !emailPassword) {
      return res.status(400).json({ 
        error: 'Email address, IMAP host, and password are required' 
      });
    }

    // Create a temporary test service
    const testService = new EmailIntegrationService();
    
    // Try to connect
    const imaps = require('imap-simple');
    const imapConfig = {
      imap: {
        user: emailAddress,
        password: emailPassword,
        host: imapHost,
        port: imapPort || 993,
        tls: true,
        authTimeout: 10000
      }
    };

    try {
      const connection = await imaps.connect(imapConfig);
      await connection.openBox('INBOX');
      await connection.end();

      res.json({
        success: true,
        message: 'Email connection successful',
        canConnect: true
      });

    } catch (connectionError) {
      res.json({
        success: false,
        message: 'Email connection failed',
        canConnect: false,
        error: connectionError.message
      });
    }

  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      error: 'Failed to test connection',
      details: error.message 
    });
  }
});

// Stop email monitoring
router.post('/stop-monitoring', async (req, res) => {
  try {
    const userEmail = 'john@conceive.com';
    
    emailService.stopMonitoring();

    logActivity(userEmail, 'email_monitoring_stopped', {
      timestamp: new Date().toISOString()
    });

    createNotification(
      userEmail,
      'Email Monitoring Stopped',
      'Email integration has been deactivated',
      'info',
      '📧'
    );

    res.json({
      message: 'Email monitoring stopped successfully',
      monitoring: false
    });

  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

// Get suggested email providers configuration
router.get('/providers', (req, res) => {
  const providers = [
    {
      name: 'Gmail',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      secure: true,
      instructions: 'Enable "Less secure app access" or use App Password for 2FA accounts',
      popular: true
    },
    {
      name: 'Outlook/Hotmail',
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      secure: true,
      instructions: 'Works with regular password or App Password',
      popular: true
    },
    {
      name: 'Yahoo',
      imapHost: 'imap.mail.yahoo.com',
      imapPort: 993,
      secure: true,
      instructions: 'Generate App Password in Yahoo Account Security settings',
      popular: true
    },
    {
      name: 'Exchange Online',
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      secure: true,
      instructions: 'Enterprise email - contact IT for configuration',
      popular: false
    },
    {
      name: 'Custom IMAP',
      imapHost: '',
      imapPort: 993,
      secure: true,
      instructions: 'Enter your custom IMAP server details',
      popular: false
    }
  ];

  res.json(providers);
});

// Manual email processing (for testing)
router.post('/manual-process', async (req, res) => {
  try {
    const userEmail = 'john@conceive.com';
    
    // Trigger manual email check
    if (emailService.isMonitoring) {
      // This would normally be handled by the monitoring loop
      res.json({
        message: 'Manual email processing triggered',
        monitoring: true,
        note: 'Check will happen within next 30 seconds'
      });
    } else {
      res.json({
        message: 'Email monitoring is not active',
        monitoring: false,
        note: 'Configure and start monitoring first'
      });
    }

  } catch (error) {
    console.error('Error triggering manual processing:', error);
    res.status(500).json({ error: 'Failed to trigger manual processing' });
  }
});

// Helper function
function formatRelativeTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInMinutes = Math.floor((now - time) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
  return time.toLocaleDateString();
}

module.exports = router;
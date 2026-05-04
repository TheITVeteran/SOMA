const express = require('express');
const fileIndexer = require('../services/fileIndexer');

const router = express.Router();

router.get('/drives', (req, res) => {
  try {
    const drives = fileIndexer.listDrives();
    res.json({ success: true, drives });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status', (req, res) => {
  res.json({ success: true, status: fileIndexer.status() });
});

router.post('/start', async (req, res) => {
  try {
    const { root, options } = req.body || {};
    setImmediate(() => {
      fileIndexer.start(root, options || {}).catch(() => {});
    });
    res.json({ success: true, message: 'Indexing started', status: fileIndexer.status() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stop', (req, res) => {
  fileIndexer.stop();
  res.json({ success: true, message: 'Stop requested' });
});

router.post('/pause', (req, res) => {
  fileIndexer.pause();
  res.json({ success: true, message: 'Pause requested' });
});

router.post('/resume', (req, res) => {
  fileIndexer.resume();
  res.json({ success: true, message: 'Resume requested' });
});

module.exports = router;

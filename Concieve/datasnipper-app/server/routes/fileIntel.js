const express = require('express');
const axios = require('axios');

const router = express.Router();
const SOMA_API_URL = process.env.SOMA_API_URL || 'http://localhost:3001';

const soma = axios.create({
  baseURL: SOMA_API_URL,
  timeout: 15000
});

const forwardPost = async (res, path, body) => {
  try {
    const response = await soma.post(path, body || {});
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data?.error || error.message || 'SOMA request failed'
    });
  }
};

const forwardGet = async (res, path, params) => {
  try {
    const response = await soma.get(path, { params });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: error.response?.data?.error || error.message || 'SOMA request failed'
    });
  }
};

// SOMA Storage / Index
router.get('/storage/status', async (req, res) => forwardGet(res, '/api/storage/status', req.query));
router.get('/storage/roots', async (req, res) => forwardGet(res, '/api/storage/roots', req.query));
router.post('/storage/index', async (req, res) => forwardPost(res, '/api/storage/index', req.body));
router.get('/storage/index/status', async (req, res) => forwardGet(res, '/api/storage/index/status', req.query));
router.post('/storage/index/pause', async (req, res) => forwardPost(res, '/api/storage/index/pause', req.body));
router.post('/storage/index/resume', async (req, res) => forwardPost(res, '/api/storage/index/resume', req.body));
router.post('/storage/file-read', async (req, res) => forwardPost(res, '/api/storage/file-read', req.body));
router.get('/storage/file-preview', async (req, res) => forwardGet(res, '/api/storage/file-preview', req.query));

// SOMA FS search/read
router.post('/fs/search', async (req, res) => forwardPost(res, '/api/soma/fs/search', req.body));
router.post('/fs/read', async (req, res) => forwardPost(res, '/api/soma/fs/read', req.body));

// SOMA Research / Hybrid Search
router.post('/research/query', async (req, res) => forwardPost(res, '/api/research/query', req.body));
router.post('/research/ingest', async (req, res) => forwardPost(res, '/api/research/ingest', req.body));
router.get('/research/stats', async (req, res) => forwardGet(res, '/api/research/stats', req.query));
router.get('/research/tags', async (req, res) => forwardGet(res, '/api/research/tags', req.query));
router.post('/research/patterns', async (req, res) => forwardPost(res, '/api/research/patterns', req.body));
router.post('/research/cache/clear', async (req, res) => forwardPost(res, '/api/research/cache/clear', req.body));

// SOMA Knowledge Graph
router.get('/knowledge/fragments', async (req, res) => forwardGet(res, '/api/knowledge/fragments', req.query));
router.post('/knowledge/learn', async (req, res) => forwardPost(res, '/api/knowledge/learn', req.body));

module.exports = router;

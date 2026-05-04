const express = require('express');
const cors = require('cors');
const dashboardRoutes = require('./server/routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test dashboard server running on port ${PORT}`);
});
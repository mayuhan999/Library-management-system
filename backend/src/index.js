require('dotenv').config();
const { ensureMigrations } = require('./lib/ensureMigrations');
const express = require('express');
const cors = require('cors');

ensureMigrations();

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const loanRoutes = require('./routes/loans');
const holdRoutes = require('./routes/holds');
const librarianRoutes = require('./routes/librarian');
const adminRoutes = require('./routes/admin');
const readerRoutes = require('./routes/reader');
const paymentRoutes = require('./routes/payments');
const { startScheduler } = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Library API is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/holds', holdRoutes);
app.use('/api/librarian', librarianRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reader', readerRoutes);
app.use('/api/payments', paymentRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduler();
});

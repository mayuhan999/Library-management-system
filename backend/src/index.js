require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const loanRoutes = require('./routes/loans');
const holdRoutes = require('./routes/holds');
const librarianRoutes = require('./routes/librarian');
const adminRoutes = require('./routes/admin');
const readerRoutes = require('./routes/reader');

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

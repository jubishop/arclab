const express = require('express');
const path = require('path');
const db = require('./db/database');
const itemsRouter = require('./routes/items');
const stashRouter = require('./routes/stash');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.redirect('/items');
});

app.use('/items', itemsRouter);
app.use('/stash', stashRouter);

// Initialize database and start server
db.init();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

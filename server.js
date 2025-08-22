const express = require('express');

const colors = require('colors');
const dotenv = require('dotenv').config();
const cors = require('cors');
const { errorHandler } = require('./middlewares/errorMiddleware');
const connectDB = require('./config/db');
const port = process.env.PORT || 5000;

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- API Routes ---
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));

// Custom Error Handler
app.use(errorHandler);

app.listen(port, () => console.log(`Server started on port ${port}`.cyan.underline));

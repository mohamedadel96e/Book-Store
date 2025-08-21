const express = require('express');
require('dotenv').config();
require('./config/db');
const port = 3000;

const app = express();

app.use(express.json());

app.use('/api/books', require('./routes/bookRoutes'));

app.listen(port, () => console.log(`Server started on port ${port}`));
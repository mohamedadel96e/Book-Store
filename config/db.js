const mongoose = require('mongoose');

mongoose.connect(process.env.DBConnectionString)
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

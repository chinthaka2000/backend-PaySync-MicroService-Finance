// index.js
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const Staff = require("./models/Staff");
const Region = require('./models/Region');
const Client = require('./models/Client');
const ClientUser = require('./models/clientUsers');
const StaffDetails = require('./models/StaffDetails'); // make sure this line is near your other model imports

const bcrypt = require("bcrypt");
const clientRoutes = require('./routes/clientRoutes');



dotenv.config();
const PORT = process.env.PORT || 5000;
connectDB();

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Loan Management System API');
});

app.use('/api/clients', clientRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

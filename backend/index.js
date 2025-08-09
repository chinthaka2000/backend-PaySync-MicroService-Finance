// index.js
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");


const Staff = require("./models/Staff");
const Region = require('./models/Region');
const Client = require('./models/Client');
const ClientUser = require('./models/clientUsers');
const StaffDetails = require('./models/StaffDetails');
const Loan = require('./models/Loan'); // Add Loan model

const bcrypt = require("bcrypt");
const clientRoutes = require('./routes/clientRoutes');
const loanRoutes = require('./routes/loanRoutes');
const agentRoutes = require('./routes/agentRoutes');

const cors = require('cors');



dotenv.config();
const PORT = process.env.PORT || 5000;
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Loan Management System API');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const clientCount = await Client.countDocuments();
    const loanCount = await Loan.countDocuments();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: mongoose.connection.readyState === 1,
        clients: clientCount,
        loans: loanCount
      },
      server: {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

app.use('/clientsAPI', clientRoutes);

app.use('/api/loans', loanRoutes);
app.use('/api/agents', agentRoutes);


app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

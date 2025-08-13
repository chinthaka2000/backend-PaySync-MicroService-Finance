const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cors = require("cors");

dotenv.config();
const PORT = process.env.PORT || 5000;
connectDB();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Loan Management System API');
});

const clientRoutes = require('./routes/clientRoutes');
const staffRoutes = require('./routes/staffRoutes');
app.use('/clientsAPI', clientRoutes);
app.use('/staffAPI', staffRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

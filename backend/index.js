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

//add staff
// app.get("/add-admin", async (req, res) => {
//   try {
//     const passwordHash = await bcrypt.hash("Fazil@123", 10);
//     const staff = await Staff.create({
//       name: "Fazil Fareed",
//       email: "Fazil12@example.com",
//       passwordHash,
//       role: "moderate_admin",
//       region: "Central Region",
//       permissions: ["create-staff", "approve-permissions", "view-staff", "manage-staff", "view-reports"],
//     });
//     res.json(staff);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
// // // Add clients
// app.get('/add-client1', async (req, res) => {
//   try {
//     const newClient = new Client({
//       registrationId: "L00003",
//       assignedReviewer: "68623db468be936c3cb65970", // agent ID
//       personalInfo: {
//         fullName: "Tharshika Rajan",
//         contactNumber: "0712345678",
//         email: "tharshi@gmail.com",
//         dateOfBirth: new Date("1996-05-22"),
//         address: "88, Temple Road, Vavuniya"
//       },
//       identityVerification: {
//         idType: "NIC",
//         idNumber: "962345678V",
//         documentUrl: "https://example.com/tharshi-nic.pdf"
//       },
//       employmentDetails: {
//         employer: "Jaffna Super Mart",
//         jobRole: "Cashier",
//         monthlyIncome: 62000,
//         employmentDuration: "1 year 6 months",
//         employmentLetterUrl: "https://example.com/letter-tharshi.pdf"
//       },
//       documents: {
//         idCardUrl: "https://example.com/tharshi-nic.jpg",
//         employmentLetterUrl: "https://example.com/tharshi-letter.jpg",
//         photoUrl: "https://example.com/tharshi-photo.jpg",
//         paysheetUrl: "https://example.com/tharshi-paysheet.jpg",
//         uploadedAt: new Date()
//       },
//       agentNotes: "Verified through local visit"
//     });

//     await newClient.save();
//     res.status(201).json({ message: "Client registered successfully", client: newClient });
//   } catch (error) {
//     console.error("Error inserting client:", error);
//     res.status(500).json({ error: "Failed to insert client" });
//   }
// });
// app.get('/add-client2', async (req, res) => {
//   try {
//     const newClient = new Client({
//       registrationId: "L00004",
//       assignedReviewer: "68623db468be936c3cb65970",
//       personalInfo: {
//         fullName: "Nivetha Shanmugam",
//         contactNumber: "0761234567",
//         email: "nivetha@gmail.com",
//         dateOfBirth: new Date("1999-10-10"),
//         address: "22A, KKS Road, Jaffna"
//       },
//       identityVerification: {
//         idType: "NIC",
//         idNumber: "992345678V",
//         documentUrl: "https://example.com/nivetha-nic.pdf"
//       },
//       employmentDetails: {
//         employer: "Sunrise Tech",
//         jobRole: "Support Executive",
//         monthlyIncome: 78000,
//         employmentDuration: "2 years",
//         employmentLetterUrl: "https://example.com/letter-nivetha.pdf"
//       },
//       documents: {
//         idCardUrl: "https://example.com/nivetha-nic.jpg",
//         employmentLetterUrl: "https://example.com/nivetha-letter.jpg",
//         photoUrl: "https://example.com/nivetha-photo.jpg",
//         paysheetUrl: "https://example.com/nivetha-paysheet.jpg",
//         uploadedAt: new Date()
//       },
//       agentNotes: "All docs validated"
//     });

//     await newClient.save();
//     res.status(201).json({ message: "Client 2 registered successfully", client: newClient });
//   } catch (error) {
//     console.error("Error inserting client 2:", error);
//     res.status(500).json({ error: "Failed to insert client 2" });
//   }
// });

// app.get('/add-client3', async (req, res) => {
//   try {
//     const newClient = new Client({
//       registrationId: "L00005",
//       assignedReviewer: "68623db468be936c3cb65970",
//       personalInfo: {
//         fullName: "Ramesh Kumar",
//         contactNumber: "0753456789",
//         email: "ramesh@gmail.com",
//         dateOfBirth: new Date("1995-03-15"),
//         address: "45, 2nd Cross Street, Kilinochchi"
//       },
//       identityVerification: {
//         idType: "NIC",
//         idNumber: "952345678V",
//         documentUrl: "https://example.com/ramesh-nic.pdf"
//       },
//       employmentDetails: {
//         employer: "North Power Ltd",
//         jobRole: "Electrician",
//         monthlyIncome: 69000,
//         employmentDuration: "3 years",
//         employmentLetterUrl: "https://example.com/letter-ramesh.pdf"
//       },
//       documents: {
//         idCardUrl: "https://example.com/ramesh-nic.jpg",
//         employmentLetterUrl: "https://example.com/ramesh-letter.jpg",
//         photoUrl: "https://example.com/ramesh-photo.jpg",
//         paysheetUrl: "https://example.com/ramesh-paysheet.jpg",
//         uploadedAt: new Date()
//       },
//       agentNotes: "NIC verified, paysheet pending"
//     });

//     await newClient.save();
//     res.status(201).json({ message: "Client 3 registered successfully", client: newClient });
//   } catch (error) {
//     console.error("Error inserting client 3:", error);
//     res.status(500).json({ error: "Failed to insert client 3" });
//   }
// });

// // // Add regions
// app.get('/add-region', async (req, res) => {
//   try {
//     const regionData = [
//       {
//         code: "R01",
//         name: "Western",
//         districts: ["Colombo", "Gampaha", "Kalutara"]
//       },
//       {
//         code: "R02",
//         name: "Central",
//         districts: ["Kandy", "Matale", "Nuwara Eliya"]
//       },
//       {
//         code: "R03",
//         name: "Southern",
//         districts: ["Galle", "Matara", "Hambantota"]
//       },
//       {
//         code: "R04",
//         name: "Northern",
//         districts: ["Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu"]
//       },
//       {
//         code: "R05",
//         name: "Eastern",
//         districts: ["Batticaloa", "Ampara", "Trincomalee"]
//       },
//       {
//         code: "R06",
//         name: "North Western",
//         districts: ["Kurunegala", "Puttalam"]
//       },
//       {
//         code: "R07",
//         name: "North Central & Uva",
//         districts: ["Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle"]
//       }
//     ];

//     const inserted = await Region.insertMany(regionData);
//     res.status(201).json({ message: "✅ Regions added successfully", data: inserted });
//   } catch (err) {
//     console.error("❌ Error inserting regions:", err);
//     res.status(500).json({ error: "Failed to insert regions" });
//   }
// });

// // //accepted client
// app.get('/approve-client1', async (req, res) => {
//   try {
//     const client = await Client.findOne({ registrationId: "L00003" });
//     if (!client) return res.status(404).json({ message: "Client not found" });

//     const existingUser = await ClientUser.findOne({ clientId: client._id });
//     if (existingUser) {
//       return res.status(400).json({ message: "Client user already exists" });
//     }

//     const newClientUser = new ClientUser({
//       clientId: client._id,
//       username: "tharshika_l00003",
//       email: client.personalInfo.email,
//       password: "Tharshi@123", // will be hashed via pre-save middleware
//       verifiedBy: "68623db468be936c3cb65970" // agent who approved her
//     });

//     await newClientUser.save();

//     res.status(201).json({
//       message: "✅ Tharshika's client user account created",
//       user: {
//         _id: newClientUser._id,
//         username: newClientUser.username,
//         email: newClientUser.email
//       }
//     });

//   } catch (error) {
//     console.error("❌ Error:", error);
//     res.status(500).json({ error: "Failed to create client user" });
//   }
// });
// //staffdetails
// app.get('/staffDetails1', async (req, res) => {
//   try {
//     const newStaffDetails = await StaffDetails.create({
//       staffId: "68624102b94efae0bbc53c7b",
//       profilePicUrl: "https://example.com/fazil-pic.jpg",
//       dateOfBirth: new Date("1998-02-15"),
//       contactNumber: "0771234567",
//       address: "123, Main Street, Jaffna",
//       nicNumber: "982345678V",
//       emergencyContact: {
//         name: "Ahamed",
//         phone: "0779876543",
//         relation: "Brother"
//       },
//       joinedDate: new Date("2023-01-01"),
//       additionalNotes: "Senior agent in Northern region"
//     });

//     res.status(201).json({
//       message: "✅ Staff details created successfully",
//       data: newStaffDetails
//     });
//   } catch (error) {
//     console.error("❌ Error creating staff details:", error);
//     res.status(500).json({ error: "Failed to create staff details" });
//   }
// });
// app.get('/staffDetails2', async (req, res) => {
//   try {
//     const newStaffDetails = await StaffDetails.create({
//       staffId: "68623db468be936c3cb65970",
//       profilePicUrl: "https://example.com/john-smith.jpg",
//       dateOfBirth: new Date("1990-08-25"),
//       contactNumber: "0711112233",
//       address: "456, Station Road, Vavuniya",
//       nicNumber: "902345678V",
//       emergencyContact: {
//         name: "Alex Smith",
//         phone: "0771122334",
//         relation: "Brother"
//       },
//       joinedDate: new Date("2022-09-10"),
//       additionalNotes: "Field agent for Northern region"
//     });

//     res.status(201).json({
//       message: "✅ Staff details for John Smith created successfully",
//       data: newStaffDetails
//     });
//   } catch (error) {
//     console.error("❌ Error creating staff details for John Smith:", error);
//     res.status(500).json({ error: "Failed to create staff details" });
//   }
// });
// app.get('/staffDetails3', async (req, res) => {
//   try {
//     const newStaffDetails = await StaffDetails.create({
//       staffId: "68623f2d47b74792ebb44c67",
//       profilePicUrl: "https://example.com/dilshan-perera.jpg",
//       dateOfBirth: new Date("1985-06-12"),
//       contactNumber: "0723456789",
//       address: "789, Lake Road, Anuradhapura",
//       nicNumber: "852345678V",
//       emergencyContact: {
//         name: "Nimesha Perera",
//         phone: "0759876543",
//         relation: "Wife"
//       },
//       joinedDate: new Date("2021-03-15"),
//       additionalNotes: "Manages Northern regional staff"
//     });

//     res.status(201).json({
//       message: "✅ Staff details for Dilshan Perera created successfully",
//       data: newStaffDetails
//     });
//   } catch (error) {
//     console.error("❌ Error creating staff details for Dilshan Perera:", error);
//     res.status(500).json({ error: "Failed to create staff details" });
//   }
// });


app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});

# Technology Stack

## Backend Framework
- **Node.js** with **Express.js** (v5.1.0)
- **CommonJS** module system
- **MongoDB** with **Mongoose** ODM (v8.16.1)

## Key Dependencies
- **Authentication**: bcrypt, bcryptjs, jsonwebtoken
- **Email**: nodemailer
- **HTTP**: cors, cookie-parser
- **Environment**: dotenv
- **Development**: nodemon

## Database
- **MongoDB Atlas** cloud database
- Connection managed through Mongoose ODM
- Collections: clients, staff, regions, products, payments, loan_applications

## Common Commands
```bash
# Start development server
npm start

# Install dependencies
npm install

# Environment setup
# Copy .env file and configure MONGO_URI, PORT, EMAIL credentials
```

## Development Patterns
- Use `nodemon` for auto-restart during development
- Environment variables stored in `.env` file
- Database connection with error handling and process exit on failure
- RESTful API structure with separate route files
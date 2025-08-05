# Project Structure

## Root Directory
- `README.md` - Project overview
- `Database/` - Database dumps and SQL files
- `Documents/` - ER diagrams, use cases, and documentation
- `backend/` - Main application code

## Backend Structure
```
backend/
├── index.js              # Main application entry point
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables (not in git)
├── .gitignore           # Git ignore rules
├── config/
│   └── db.js            # MongoDB connection configuration
├── models/              # Mongoose schemas
│   ├── Client.js        # Client/loan application model
│   ├── Staff.js         # Staff user model
│   ├── Region.js        # Regional divisions
│   └── clientUsers.js   # Client user accounts
├── controllers/         # Business logic handlers
├── routes/              # API route definitions
├── middlewares/         # Custom middleware (auth, error handling)
├── utils/               # Utility functions (email, etc.)
├── uploads/             # File upload storage
└── scripts/             # Utility scripts
```

## Conventions
- Models use PascalCase (Client.js, Staff.js)
- Routes follow RESTful patterns with plural nouns
- Controllers handle business logic, models define data structure
- Middleware for cross-cutting concerns (authentication, error handling)
- Environment-specific configuration in .env file
- File uploads stored in dedicated uploads/ directory
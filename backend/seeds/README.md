# PaySync Database Seed Scripts

This directory contains seed scripts to populate your MongoDB database with initial data for development and testing.

## Available Seed Scripts

### 1. `seedStaff.js`
Seeds the Staff collection with comprehensive hierarchical user roles:
- **Super Admin** (1 user) - Full system access and oversight
- **Moderate Admin** (1 user) - Operations management and regional oversight
- **Regional Managers** (3 users) - One for each region (Western, Central, Southern)
- **Agents** (12 users) - 4 agents per regional manager for client management

**Hierarchical Structure:**
```
Super Admin
└── Moderate Admin
    ├── Western Regional Manager
    │   ├── Agent Western 1
    │   ├── Agent Western 2
    │   ├── Agent Western 3
    │   └── Agent Western 4
    ├── Central Regional Manager
    │   ├── Agent Central 1
    │   ├── Agent Central 2
    │   ├── Agent Central 3
    │   └── Agent Central 4
    └── Southern Regional Manager
        ├── Agent Southern 1
        ├── Agent Southern 2
        ├── Agent Southern 3
        └── Agent Southern 4
```

### 2. `seedRegions.js`
Seeds the Region collection with Sri Lankan provinces:
- **Western Province** (WEST001) - Colombo, Gampaha, Kalutara
- **Central Province** (CENT001) - Kandy, Matale, Nuwara Eliya
- **Southern Province** (SOUT001) - Galle, Matara, Hambantota

Each region includes:
- District assignments
- Loan approval configurations
- Business hours and workflow settings
- Regional statistics

### 3. `seedClients.js`
Seeds the Client collection with sample clients:
- **John Smith** (R001) - Approved client, low risk
- **Sarah Johnson** (R002) - Approved client, medium risk
- **Michael Brown** (R003) - Pending client, high risk

Each client includes:
- Personal information and contact details
- Employment and income verification
- Document uploads and risk profiles
- Regional assignments

### 4. `seedClientUsers.js`
Seeds the ClientUsers collection with login accounts for approved clients:
- Creates user accounts for approved clients
- Sets up authentication credentials
- Links client profiles to user accounts
- Passwords are hashed automatically

### 5. `seedLoans.js`
Seeds the Loan collection with sample loan applications:
- Creates approved loan applications
- Includes complete workflow history
- Sets up loan terms and conditions
- Links to clients and assigned staff

### 6. `seedPayments.js`
Seeds the Payment collection with loan payment records:
- Creates payment records for approved loans
- Includes payment verification details
- Sets up payment history and tracking
- Links payments to loans and clients

### 7. `seedGrantors.js`
Seeds the Grantor collection with guarantor information:
- **John Smith Sr.** (GR0001) - Guarantor for loan applications
- **Sarah Johnson** (GR0002) - Guarantor with employment details
- **Michael Brown** (GR0003) - Guarantor with complete profile

Each grantor includes:
- Personal and contact information
- Identity verification documents
- Employment and income details

### 8. `seedNotifications.js`
Seeds the Notification collection with system notifications:
- Welcome messages for new clients
- Loan approval notifications
- Payment reminders and alerts
- System announcements and updates

### 9. `seedStaffDetails.js`
Seeds the StaffDetails collection with extended staff information:
- Profile pictures and contact details
- Emergency contact information
- Employment history and dates
- Additional staff metadata

### 10. `seedMaster.js`
Master script that runs all seed files in the correct order to ensure proper data relationships.

## How to Run Seed Scripts

### Option 1: Run All Seeds (Recommended)
```bash
cd backend-PaySync-MicroService-Finance/backend
node seeds/seedMaster.js
```

### Option 2: Run Individual Seeds
```bash
cd backend-PaySync-MicroService-Finance/backend

# Seed staff users first
node seeds/seedStaff.js

# Then seed regions
node seeds/seedRegions.js

# Finally seed clients
node seeds/seedClients.js
```

## Environment Variables

Make sure you have the following environment variable set:
```bash
MONGO_URI=mongodb://localhost:27017/paysync
```

## Sample Data Overview

### Staff Users
| Email | Role | Region | Password | Permissions |
|-------|------|--------|----------|-------------|
| superadmin@example.com | super_admin | All | Super@123 | All permissions |
| moderateadmin@example.com | moderate_admin | All | Moderate@123 | Manage users, approve loans |
| rm.western@example.com | regional_manager | Western | RMWestern@123 | Manage agents, approve loans |
| rm.central@example.com | regional_manager | Central | RMCentral@123 | Manage agents, approve loans |
| rm.southern@example.com | regional_manager | Southern | RMSouthern@123 | Manage agents, approve loans |
| agent.western.1@example.com | agent | Western | Agent@123 | Basic client management |
| agent.western.2@example.com | agent | Western | Agent@123 | Basic client management |
| agent.western.3@example.com | agent | Western | Agent@123 | Basic client management |
| agent.western.4@example.com | agent | Western | Agent@123 | Basic client management |
| agent.central.1@example.com | agent | Central | Agent@123 | Basic client management |
| agent.central.2@example.com | agent | Central | Agent@123 | Basic client management |
| agent.central.3@example.com | agent | Central | Agent@123 | Basic client management |
| agent.central.4@example.com | agent | Central | Agent@123 | Basic client management |
| agent.southern.1@example.com | agent | Southern | Agent@123 | Basic client management |
| agent.southern.2@example.com | agent | Southern | Agent@123 | Basic client management |
| agent.southern.3@example.com | agent | Southern | Agent@123 | Basic client management |
| agent.southern.4@example.com | agent | Southern | Agent@123 | Basic client management |

### Regions
| Code | Name | Districts | Max Loan Amount |
|------|------|-----------|----------------|
| WEST001 | Western Province | Colombo, Gampaha, Kalutara | 10,000,000 LKR |
| CENT001 | Central Province | Kandy, Matale, Nuwara Eliya | 8,000,000 LKR |
| SOUT001 | Southern Province | Galle, Matara, Hambantota | 6,000,000 LKR |

### Clients
| Registration ID | Name | Status | Risk Level |
|----------------|------|--------|------------|
| R001 | John Smith | Approved | Low |
| R002 | Sarah Johnson | Approved | Medium |
| R003 | Michael Brown | Pending | High |

### Client Users
| Email | Username | Status | Password |
|-------|----------|--------|----------|
| john.smith@example.com | john.smith@example.com | Active | Client@123 |
| sarah.johnson@example.com | sarah.johnson@example.com | Active | Client@123 |
| michael.brown@example.com | michael.brown@example.com | Active | Client@123 |

### Loans
| Loan ID | Client | Product | Amount | Status |
|---------|--------|---------|--------|--------|
| L00001 | John Smith | Personal Loan | 600,000 LKR | Approved |
| L00002 | Sarah Johnson | Personal Loan | 700,000 LKR | Approved |
| L00003 | Michael Brown | Personal Loan | 800,000 LKR | Approved |

### Payments
| Payment ID | Loan ID | Amount | Status | Date |
|------------|---------|--------|--------|------|
| PAY... | L00001 | 20,000 LKR | Verified | Recent |
| PAY... | L00002 | 20,000 LKR | Verified | Recent |
| PAY... | L00003 | 20,000 LKR | Verified | Recent |

### Grantors
| Grantor ID | Name | Contact | Employment |
|------------|------|---------|------------|
| GR0001 | John Smith Sr. | +94771234567 | ABC Company |
| GR0002 | Sarah Johnson | +94772345678 | XYZ Corporation |
| GR0003 | Michael Brown | +94773456789 | DEF Industries |

### Notifications
| Type | Recipient | Title | Priority |
|------|-----------|-------|----------|
| info | Client | Welcome to PaySync! | Medium |
| loan_approved | Client | Loan Application Approved | High |
| payment_due | Client | Payment Reminder | Medium |

## Notes

- All seed scripts clear existing data before inserting new records
- Password hashes are placeholders and should be replaced with actual hashed passwords in production
- File URLs in documents are example URLs and should be replaced with actual file storage paths
- The seed data is designed for development and testing purposes

## Next Steps

After running the seed scripts, you can:
1. Test your API endpoints with the sample data
2. Use the staff credentials to test authentication
3. Create additional seed files for other collections (Loans, Payments, etc.)
4. Modify the sample data to match your specific requirements

## Troubleshooting

If you encounter validation errors:
1. Ensure MongoDB is running and accessible
2. Check that all required environment variables are set
3. Verify that the database connection string is correct
4. Make sure all model files are properly defined and exported

For any issues with specific seed scripts, check the console output for detailed error messages.

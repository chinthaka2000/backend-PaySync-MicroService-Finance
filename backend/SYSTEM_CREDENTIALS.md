# 🔑 PaySync System Credentials

## Complete Login Credentials for All User Roles

### 👑 **SUPER ADMIN** (Highest Level)
```
Email: super.admin@paysync.com
Password: SuperAdmin123!
Role: super_admin
Access: Full system access, all permissions
```

**Available Endpoints:**
- `GET /api/super-admin/dashboard` - System overview
- `GET /api/super-admin/system-config` - System configuration
- All moderate admin endpoints
- All regional admin endpoints
- All other endpoints

---

### 🔧 **MODERATE ADMIN** (System Management)
```
Email: moderate.admin@paysync.com
Password: ModerateAdmin123!
Role: moderate_admin
Access: Staff & region management
```

**Available Endpoints:**
- `GET /api/moderate-admin/dashboard` - Management dashboard
- `GET /api/moderate-admin/staff` - All staff management
- `GET /api/moderate-admin/regions` - All regions management
- `POST /api/moderate-admin/staff` - Create new staff
- `POST /api/moderate-admin/regions` - Create new region

---

### 🏢 **REGIONAL MANAGER** (Regional Operations)
```
Email: regional.manager@paysync.com
Password: RegionalManager123!
Role: regional_manager
Access: Regional operations
```

**Available Endpoints:**
- `GET /api/regional-admin/dashboard` - Regional dashboard
- `GET /api/regional-admin/agents` - Manage agents in region
- `GET /api/regional-admin/clients` - Regional clients

---

### 👤 **AGENT** (Field Operations)
```
Email: agent@paysync.com
Password: Agent123!
Role: agent
Access: Client & loan management
```

**Available Endpoints:**
- `GET /api/agents/dashboard` - Agent dashboard
- Client management endpoints
- Loan processing endpoints

---

### 💼 **CEO** (Executive Level)
```
Email: ceo@paysync.com
Password: CEO123!
Role: ceo
Access: Executive dashboard & reports
```

**Available Endpoints:**
- Executive dashboard
- Financial reports
- System analytics

---

## 🚀 How to Test in Postman

### Step 1: Login
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

Body:
{
  "email": "super.admin@paysync.com",
  "password": "SuperAdmin123!"
}
```

### Step 2: Copy Access Token
From the response, copy the `accessToken` value.

### Step 3: Test Protected Endpoints
```
GET http://localhost:5000/api/super-admin/dashboard
Authorization: Bearer YOUR_ACCESS_TOKEN_HERE
```

## 🔐 Security Notes

- All passwords follow the pattern: `[Role]123!`
- All emails follow the pattern: `[role].admin@paysync.com`
- JWT tokens expire in 15 minutes
- Refresh tokens are valid for 7 days
- All admin routes require proper authentication and authorization

## 🎯 Quick Test Commands

```bash
# Create/verify super admin
node create-super-admin.js

# Test all endpoints
node test-all-endpoints.js

# Test specific admin routes
node test-admin-routes.js
```

## 📋 Role Hierarchy (High to Low)

1. **Super Admin** - Full system control
2. **Moderate Admin** - Staff and region management
3. **CEO** - Executive access
4. **Regional Manager** - Regional operations
5. **Agent** - Field operations

Each higher role can access lower role endpoints, but not vice versa.
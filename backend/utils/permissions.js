// utils/permissions.js

// Define all available permissions in the system
const PERMISSIONS = {
  // Client management permissions
  VIEW_OWN_CLIENTS: 'view_own_clients',
  VIEW_REGIONAL_CLIENTS: 'view_regional_clients',
  VIEW_ALL_CLIENTS: 'view_all_clients',
  CREATE_CLIENT: 'create_client',
  UPDATE_OWN_CLIENTS: 'update_own_clients',
  UPDATE_REGIONAL_CLIENTS: 'update_regional_clients',
  UPDATE_ALL_CLIENTS: 'update_all_clients',
  DELETE_CLIENT: 'delete_client',
  MANAGE_ASSIGNED_CLIENTS: 'manage_assigned_clients',

  // Loan management permissions
  CREATE_LOAN: 'create_loan',
  VIEW_OWN_LOANS: 'view_own_loans',
  VIEW_REGIONAL_LOANS: 'view_regional_loans',
  VIEW_ALL_LOANS: 'view_all_loans',
  UPDATE_OWN_LOANS: 'update_own_loans',
  UPDATE_REGIONAL_LOANS: 'update_regional_loans',
  UPDATE_ALL_LOANS: 'update_all_loans',
  APPROVE_LOANS: 'approve_loans',
  REJECT_LOANS: 'reject_loans',
  APPROVE_HIGH_VALUE_LOANS: 'approve_high_value_loans',

  // Agreement and document permissions
  GENERATE_AGREEMENTS: 'generate_agreements',
  VIEW_AGREEMENTS: 'view_agreements',
  VIEW_ALL_AGREEMENTS: 'view_all_agreements',
  DOWNLOAD_AGREEMENTS: 'download_agreements',
  UPLOAD_DOCUMENTS: 'upload_documents',
  VIEW_DOCUMENTS: 'view_documents',

  // File management permissions
  UPLOAD_FILES: 'upload_files',
  DOWNLOAD_FILES: 'download_files',
  DELETE_FILES: 'delete_files',
  MANAGE_ALL_FILES: 'manage_all_files',
  VIEW_FILE_STATS: 'view_file_stats',
  MANAGE_CLIENTS: 'manage_clients',

  // Staff management permissions
  CREATE_STAFF: 'create_staff',
  VIEW_STAFF: 'view_staff',
  UPDATE_STAFF: 'update_staff',
  DELETE_STAFF: 'delete_staff',
  CREATE_AGENT: 'create_agent',
  CREATE_REGIONAL_MANAGER: 'create_regional_manager',
  CREATE_CEO: 'create_ceo',
  CREATE_MODERATE_ADMIN: 'create_moderate_admin',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_REGIONAL_AGENTS: 'manage_regional_agents',
  ASSIGN_AGENT_TO_REGIONAL_MANAGER: 'assign_agent_to_regional_manager',
  VIEW_STAFF_REPORTS: 'view_staff_reports',

  // Region and district management
  MANAGE_REGIONS: 'manage_regions',
  CUSTOMIZE_REGIONS: 'customize_regions',
  ASSIGN_DISTRICTS_TO_REGIONS: 'assign_districts_to_regions',
  VIEW_REGIONAL_DATA: 'view_regional_data',

  // System and administrative permissions
  SYSTEM_SETTINGS: 'system_settings',
  SYSTEM_CONFIGURATION: 'system_configuration',
  DATABASE_MANAGEMENT: 'database_management',
  SECURITY_SETTINGS: 'security_settings',
  VIEW_SYSTEM_ANALYTICS: 'view_system_analytics',
  VIEW_FINANCIAL_REPORTS: 'view_financial_reports',
  SYSTEM_OVERVIEW: 'system_overview',

  // Special permissions
  FULL_SYSTEM_ACCESS: 'full_system_access',
  ALL_PERMISSIONS: 'all_permissions'
};

// Define base role permissions first
const agentPermissions = [
  PERMISSIONS.VIEW_OWN_CLIENTS,
  PERMISSIONS.CREATE_CLIENT,
  PERMISSIONS.UPDATE_OWN_CLIENTS,
  PERMISSIONS.MANAGE_ASSIGNED_CLIENTS,
  PERMISSIONS.MANAGE_CLIENTS,
  PERMISSIONS.CREATE_LOAN,
  PERMISSIONS.VIEW_OWN_LOANS,
  PERMISSIONS.UPDATE_OWN_LOANS,
  PERMISSIONS.GENERATE_AGREEMENTS,
  PERMISSIONS.VIEW_AGREEMENTS,
  PERMISSIONS.DOWNLOAD_AGREEMENTS,
  PERMISSIONS.UPLOAD_DOCUMENTS,
  PERMISSIONS.VIEW_DOCUMENTS,
  PERMISSIONS.UPLOAD_FILES,
  PERMISSIONS.DOWNLOAD_FILES,
  PERMISSIONS.DELETE_FILES
];

const ceoPermissions = [
  PERMISSIONS.VIEW_ALL_CLIENTS,
  PERMISSIONS.VIEW_ALL_LOANS,
  PERMISSIONS.VIEW_FINANCIAL_REPORTS,
  PERMISSIONS.VIEW_SYSTEM_ANALYTICS,
  PERMISSIONS.SYSTEM_OVERVIEW,
  PERMISSIONS.APPROVE_HIGH_VALUE_LOANS,
  PERMISSIONS.VIEW_AGREEMENTS,
  PERMISSIONS.VIEW_ALL_AGREEMENTS,
  PERMISSIONS.DOWNLOAD_AGREEMENTS,
  PERMISSIONS.VIEW_STAFF_REPORTS,
  PERMISSIONS.VIEW_FILE_STATS,
  PERMISSIONS.DOWNLOAD_FILES
];

// Role-based permission mapping
const ROLE_PERMISSIONS = {
  agent: agentPermissions,

  regional_manager: [
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.VIEW_REGIONAL_CLIENTS,
    PERMISSIONS.UPDATE_REGIONAL_CLIENTS,
    PERMISSIONS.VIEW_REGIONAL_LOANS,
    PERMISSIONS.UPDATE_REGIONAL_LOANS,
    PERMISSIONS.APPROVE_LOANS,
    PERMISSIONS.REJECT_LOANS,
    PERMISSIONS.MANAGE_REGIONAL_AGENTS,
    PERMISSIONS.VIEW_REGIONAL_DATA,
    PERMISSIONS.VIEW_AGREEMENTS,
    PERMISSIONS.DOWNLOAD_AGREEMENTS,
    PERMISSIONS.VIEW_STAFF_REPORTS,
    PERMISSIONS.VIEW_FILE_STATS,
    // Include all agent permissions
    ...agentPermissions
  ],

  ceo: ceoPermissions,

  moderate_admin: [
    PERMISSIONS.CREATE_STAFF,
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.UPDATE_STAFF,
    PERMISSIONS.DELETE_STAFF,
    PERMISSIONS.CREATE_AGENT,
    PERMISSIONS.CREATE_REGIONAL_MANAGER,
    PERMISSIONS.ASSIGN_AGENT_TO_REGIONAL_MANAGER,
    PERMISSIONS.MANAGE_STAFF,
    PERMISSIONS.MANAGE_REGIONS,
    PERMISSIONS.CUSTOMIZE_REGIONS,
    PERMISSIONS.ASSIGN_DISTRICTS_TO_REGIONS,
    PERMISSIONS.VIEW_ALL_LOANS,
    PERMISSIONS.VIEW_ALL_CLIENTS,
    PERMISSIONS.UPDATE_ALL_CLIENTS,
    PERMISSIONS.UPDATE_ALL_LOANS,
    PERMISSIONS.SYSTEM_SETTINGS,
    PERMISSIONS.VIEW_SYSTEM_ANALYTICS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_AGREEMENTS,
    PERMISSIONS.VIEW_ALL_AGREEMENTS,
    PERMISSIONS.DOWNLOAD_AGREEMENTS,
    PERMISSIONS.VIEW_STAFF_REPORTS,
    PERMISSIONS.MANAGE_ALL_FILES,
    PERMISSIONS.VIEW_FILE_STATS,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.DOWNLOAD_FILES,
    PERMISSIONS.DELETE_FILES,
    // Include CEO permissions
    ...ceoPermissions
  ],

  super_admin: [
    PERMISSIONS.FULL_SYSTEM_ACCESS,
    PERMISSIONS.ALL_PERMISSIONS,
    PERMISSIONS.CREATE_STAFF,
    PERMISSIONS.VIEW_STAFF,
    PERMISSIONS.UPDATE_STAFF,
    PERMISSIONS.DELETE_STAFF,
    PERMISSIONS.CREATE_MODERATE_ADMIN,
    PERMISSIONS.CREATE_CEO,
    PERMISSIONS.SYSTEM_CONFIGURATION,
    PERMISSIONS.DATABASE_MANAGEMENT,
    PERMISSIONS.SECURITY_SETTINGS,
    // Include all other permissions
    ...Object.values(PERMISSIONS)
  ]
};

// Role hierarchy levels
const ROLE_HIERARCHY = {
  agent: 1,
  regional_manager: 2,
  ceo: 3,
  moderate_admin: 4,
  super_admin: 5
};

/**
 * Get permissions for a specific role
 * @param {string} role - The user role
 * @returns {Array} Array of permissions
 */
function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 * @param {string} role - The user role
 * @param {string} permission - The permission to check
 * @returns {boolean} True if role has permission
 */
function roleHasPermission(role, permission) {
  if (role === 'super_admin') return true;

  const rolePermissions = getPermissionsForRole(role);
  return rolePermissions.includes(permission);
}

/**
 * Check if a user has multiple permissions
 * @param {string} role - The user role
 * @param {Array} permissions - Array of permissions to check
 * @returns {boolean} True if user has all permissions
 */
function roleHasAllPermissions(role, permissions) {
  if (role === 'super_admin') return true;

  return permissions.every(permission => roleHasPermission(role, permission));
}

/**
 * Check if a role can perform an action on another role (hierarchy check)
 * @param {string} actorRole - The role performing the action
 * @param {string} targetRole - The role being acted upon
 * @returns {boolean} True if actor can act on target
 */
function canActOnRole(actorRole, targetRole) {
  const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;

  return actorLevel > targetLevel;
}

/**
 * Get roles that a specific role can create/manage
 * @param {string} role - The user role
 * @returns {Array} Array of manageable roles
 */
function getManageableRoles(role) {
  const userLevel = ROLE_HIERARCHY[role] || 0;

  return Object.keys(ROLE_HIERARCHY).filter(targetRole => {
    const targetLevel = ROLE_HIERARCHY[targetRole];
    return userLevel > targetLevel;
  });
}

/**
 * Validate if a role can create another role
 * @param {string} creatorRole - The role creating
 * @param {string} targetRole - The role being created
 * @returns {Object} Validation result
 */
function validateRoleCreation(creatorRole, targetRole) {
  // Super admin can create anyone
  if (creatorRole === 'super_admin') {
    return { valid: true, message: 'Super admin can create any role' };
  }

  // Moderate admin can create regional_manager and agent
  if (creatorRole === 'moderate_admin') {
    if (['regional_manager', 'agent'].includes(targetRole)) {
      return { valid: true, message: 'Moderate admin can create this role' };
    }
    return {
      valid: false,
      message: 'Moderate admin can only create regional_manager and agent roles'
    };
  }

  // Other roles cannot create users
  return {
    valid: false,
    message: `Role ${creatorRole} does not have permission to create users`
  };
}

/**
 * Check regional access permissions
 * @param {Object} user - User object with role and region
 * @param {string} targetRegion - Region being accessed
 * @returns {boolean} True if user can access the region
 */
function canAccessRegion(user, targetRegion) {
  // Super admin and moderate admin can access all regions
  if (['super_admin', 'moderate_admin', 'ceo'].includes(user.role)) {
    return true;
  }

  // Regional managers and agents can only access their assigned region
  if (['regional_manager', 'agent'].includes(user.role)) {
    return user.region && user.region.toString() === targetRegion.toString();
  }

  return false;
}

/**
 * Generate JWT payload with permissions
 * @param {Object} user - User object from database
 * @returns {Object} JWT payload
 */
function generateJWTPayload(user) {
  const permissions = getPermissionsForRole(user.role);

  return {
    userId: user._id,
    email: user.email,
    role: user.role,
    region: user.region,
    permissions: permissions,
    iat: Math.floor(Date.now() / 1000)
  };
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  getPermissionsForRole,
  roleHasPermission,
  roleHasAllPermissions,
  canActOnRole,
  getManageableRoles,
  validateRoleCreation,
  canAccessRegion,
  generateJWTPayload
};
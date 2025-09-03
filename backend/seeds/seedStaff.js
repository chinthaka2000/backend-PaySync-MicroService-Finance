const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Staff = require("../models/Staff");
const Region = require("../models/Region");

const seedStaff = async () => {
  try {
    console.log("Seeding Staff collection...");

    // Get regions for assignment
    const regions = await Region.find({});
    const westernRegion = regions.find((r) => r.code === "WEST001");
    const centralRegion = regions.find((r) => r.code === "CENT001");
    const southernRegion = regions.find((r) => r.code === "SOUT001");

    // Hash passwords
    const saltRounds = 10;
    const hashedPasswords = {
      superAdmin: await bcrypt.hash("Super@123", saltRounds),
      moderateAdmin: await bcrypt.hash("Moderate@123", saltRounds),
      regionalManager1: await bcrypt.hash("RMWestern@123", saltRounds),
      regionalManager2: await bcrypt.hash("RMCentral@123", saltRounds),
      regionalManager3: await bcrypt.hash("RMSouthern@123", saltRounds),
      agent: await bcrypt.hash("Agent@123", saltRounds),
    };

    // Create staff data with hierarchical relationships
    const staffData = [
      // Super Admin
      {
        name: "System Administrator",
        email: "superadmin@example.com",
        passwordHash: hashedPasswords.superAdmin,
        role: "super_admin",
        status: "active",
        profile: {
          firstName: "System",
          lastName: "Administrator",
          phoneNumber: "+94771234567",
          employeeId: "SA000001",
          department: "IT",
          position: "System Administrator",
          hireDate: new Date("2023-01-01"),
        },
        permissions: ["all"],
        rolePermissions: {
          canCreateUsers: true,
          canManageRegions: true,
          canApproveLoans: true,
          canViewAllData: true,
          canManageSystem: true,
          maxLoanApprovalAmount: Number.MAX_SAFE_INTEGER,
        },
        metrics: {
          totalClientsManaged: 0,
          totalLoansProcessed: 0,
          averageProcessingTime: 0,
          approvalRate: 0,
          lastPerformanceReview: new Date(),
          performanceScore: 95,
        },
      },

      // Moderate Admin
      {
        name: "Operations Manager",
        email: "moderateadmin@example.com",
        passwordHash: hashedPasswords.moderateAdmin,
        role: "moderate_admin",
        status: "active",
        profile: {
          firstName: "Operations",
          lastName: "Manager",
          phoneNumber: "+94772345678",
          employeeId: "MA000001",
          department: "Operations",
          position: "Operations Manager",
          hireDate: new Date("2023-02-01"),
        },
        permissions: ["manage_users", "approve_loans", "view_reports"],
        rolePermissions: {
          canCreateUsers: true,
          canManageRegions: true,
          canApproveLoans: true,
          canViewAllData: true,
          canManageSystem: false,
          maxLoanApprovalAmount: 10000000,
        },
        metrics: {
          totalClientsManaged: 0,
          totalLoansProcessed: 0,
          averageProcessingTime: 0,
          approvalRate: 0,
          lastPerformanceReview: new Date(),
          performanceScore: 88,
        },
      },

      // Regional Managers (3)
      {
        name: "Western Regional Manager",
        email: "rm.western@example.com",
        passwordHash: hashedPasswords.regionalManager1,
        role: "regional_manager",
        status: "active",
        region: westernRegion?._id,
        assignedDistricts: ["Colombo", "Gampaha", "Kalutara"],
        reportsTo: null, // Reports to moderate admin
        profile: {
          firstName: "Western",
          lastName: "Regional Manager",
          phoneNumber: "+94773456789",
          employeeId: "RM000001",
          department: "Regional Management",
          position: "Regional Manager - Western",
          hireDate: new Date("2023-03-01"),
        },
        permissions: ["manage_agents", "approve_loans", "view_regional_data"],
        rolePermissions: {
          canCreateUsers: false,
          canManageRegions: false,
          canApproveLoans: true,
          canViewAllData: false,
          canManageSystem: false,
          maxLoanApprovalAmount: 5000000,
        },
        metrics: {
          totalClientsManaged: 0,
          totalLoansProcessed: 0,
          averageProcessingTime: 0,
          approvalRate: 0,
          lastPerformanceReview: new Date(),
          performanceScore: 92,
        },
      },

      {
        name: "Central Regional Manager",
        email: "rm.central@example.com",
        passwordHash: hashedPasswords.regionalManager2,
        role: "regional_manager",
        status: "active",
        region: centralRegion?._id,
        assignedDistricts: ["Kandy", "Matale", "Nuwara Eliya"],
        reportsTo: null, // Reports to moderate admin
        profile: {
          firstName: "Central",
          lastName: "Regional Manager",
          phoneNumber: "+94774567890",
          employeeId: "RM000002",
          department: "Regional Management",
          position: "Regional Manager - Central",
          hireDate: new Date("2023-03-15"),
        },
        permissions: ["manage_agents", "approve_loans", "view_regional_data"],
        rolePermissions: {
          canCreateUsers: false,
          canManageRegions: false,
          canApproveLoans: true,
          canViewAllData: false,
          canManageSystem: false,
          maxLoanApprovalAmount: 4000000,
        },
        metrics: {
          totalClientsManaged: 0,
          totalLoansProcessed: 0,
          averageProcessingTime: 0,
          approvalRate: 0,
          lastPerformanceReview: new Date(),
          performanceScore: 89,
        },
      },

      {
        name: "Southern Regional Manager",
        email: "rm.southern@example.com",
        passwordHash: hashedPasswords.regionalManager3,
        role: "regional_manager",
        status: "active",
        region: southernRegion?._id,
        assignedDistricts: ["Galle", "Matara", "Hambantota"],
        reportsTo: null, // Reports to moderate admin
        profile: {
          firstName: "Southern",
          lastName: "Regional Manager",
          phoneNumber: "+94775678901",
          employeeId: "RM000003",
          department: "Regional Management",
          position: "Regional Manager - Southern",
          hireDate: new Date("2023-04-01"),
        },
        permissions: ["manage_agents", "approve_loans", "view_regional_data"],
        rolePermissions: {
          canCreateUsers: false,
          canManageRegions: false,
          canApproveLoans: true,
          canViewAllData: false,
          canManageSystem: false,
          maxLoanApprovalAmount: 3000000,
        },
        metrics: {
          totalClientsManaged: 0,
          totalLoansProcessed: 0,
          averageProcessingTime: 0,
          approvalRate: 0,
          lastPerformanceReview: new Date(),
          performanceScore: 91,
        },
      },
    ];

    // Add agents for each regional manager (4 agents per region = 12 total)
    const regionalManagers = staffData.filter(
      (s) => s.role === "regional_manager"
    );

    regionalManagers.forEach((rm, rmIndex) => {
      const regionAgents = [
        {
          name: `Agent ${rm.profile.firstName} 1`,
          email: `agent.${rm.profile.firstName.toLowerCase()}.1@example.com`,
          passwordHash: hashedPasswords.agent,
          role: "agent",
          status: "active",
          region: rm.region,
          assignedDistricts: [rm.assignedDistricts[0]], // First district
          managedBy: null, // Will be set after insertion
          reportsTo: null, // Will be set after insertion
          profile: {
            firstName: `Agent${rmIndex + 1}`,
            lastName: `One`,
            phoneNumber: `+94776${String(10000 + rmIndex * 1000 + 1).slice(
              -5
            )}`,
            employeeId: `AG${String(1001 + rmIndex * 4 + 1).padStart(6, "0")}`,
            department: "Field Operations",
            position: "Loan Agent",
            hireDate: new Date("2023-05-01"),
          },
          permissions: ["create_clients", "process_applications"],
          rolePermissions: {
            canCreateUsers: false,
            canManageRegions: false,
            canApproveLoans: false,
            canViewAllData: false,
            canManageSystem: false,
            maxLoanApprovalAmount: 0,
          },
          metrics: {
            totalClientsManaged: 0,
            totalLoansProcessed: 0,
            averageProcessingTime: 0,
            approvalRate: 0,
            lastPerformanceReview: new Date(),
            performanceScore: 85 + Math.floor(Math.random() * 10),
          },
        },
        {
          name: `Agent ${rm.profile.firstName} 2`,
          email: `agent.${rm.profile.firstName.toLowerCase()}.2@example.com`,
          passwordHash: hashedPasswords.agent,
          role: "agent",
          status: "active",
          region: rm.region,
          assignedDistricts: [rm.assignedDistricts[1]], // Second district
          managedBy: null,
          reportsTo: null,
          profile: {
            firstName: `Agent${rmIndex + 1}`,
            lastName: `Two`,
            phoneNumber: `+94776${String(10000 + rmIndex * 1000 + 2).slice(
              -5
            )}`,
            employeeId: `AG${String(1001 + rmIndex * 4 + 2).padStart(6, "0")}`,
            department: "Field Operations",
            position: "Loan Agent",
            hireDate: new Date("2023-05-15"),
          },
          permissions: ["create_clients", "process_applications"],
          rolePermissions: {
            canCreateUsers: false,
            canManageRegions: false,
            canApproveLoans: false,
            canViewAllData: false,
            canManageSystem: false,
            maxLoanApprovalAmount: 0,
          },
          metrics: {
            totalClientsManaged: 0,
            totalLoansProcessed: 0,
            averageProcessingTime: 0,
            approvalRate: 0,
            lastPerformanceReview: new Date(),
            performanceScore: 80 + Math.floor(Math.random() * 15),
          },
        },
        {
          name: `Agent ${rm.profile.firstName} 3`,
          email: `agent.${rm.profile.firstName.toLowerCase()}.3@example.com`,
          passwordHash: hashedPasswords.agent,
          role: "agent",
          status: "active",
          region: rm.region,
          assignedDistricts: [rm.assignedDistricts[2]], // Third district
          managedBy: null,
          reportsTo: null,
          profile: {
            firstName: `Agent${rmIndex + 1}`,
            lastName: `Three`,
            phoneNumber: `+94776${String(10000 + rmIndex * 1000 + 3).slice(
              -5
            )}`,
            employeeId: `AG${String(1001 + rmIndex * 4 + 3).padStart(6, "0")}`,
            department: "Field Operations",
            position: "Senior Loan Agent",
            hireDate: new Date("2023-06-01"),
          },
          permissions: [
            "create_clients",
            "process_applications",
            "review_applications",
          ],
          rolePermissions: {
            canCreateUsers: false,
            canManageRegions: false,
            canApproveLoans: false,
            canViewAllData: false,
            canManageSystem: false,
            maxLoanApprovalAmount: 0,
          },
          metrics: {
            totalClientsManaged: 0,
            totalLoansProcessed: 0,
            averageProcessingTime: 0,
            approvalRate: 0,
            lastPerformanceReview: new Date(),
            performanceScore: 88 + Math.floor(Math.random() * 10),
          },
        },
        {
          name: `Agent ${rm.profile.firstName} 4`,
          email: `agent.${rm.profile.firstName.toLowerCase()}.4@example.com`,
          passwordHash: hashedPasswords.agent,
          role: "agent",
          status: "active",
          region: rm.region,
          assignedDistricts: [rm.assignedDistricts[0]], // Back to first district
          managedBy: null,
          reportsTo: null,
          profile: {
            firstName: `Agent${rmIndex + 1}`,
            lastName: `Four`,
            phoneNumber: `+94776${String(10000 + rmIndex * 1000 + 4).slice(
              -5
            )}`,
            employeeId: `AG${String(1001 + rmIndex * 4 + 4).padStart(6, "0")}`,
            department: "Field Operations",
            position: "Loan Agent",
            hireDate: new Date("2023-06-15"),
          },
          permissions: ["create_clients", "process_applications"],
          rolePermissions: {
            canCreateUsers: false,
            canManageRegions: false,
            canApproveLoans: false,
            canViewAllData: false,
            canManageSystem: false,
            maxLoanApprovalAmount: 0,
          },
          metrics: {
            totalClientsManaged: 0,
            totalLoansProcessed: 0,
            averageProcessingTime: 0,
            approvalRate: 0,
            lastPerformanceReview: new Date(),
            performanceScore: 82 + Math.floor(Math.random() * 12),
          },
        },
      ];

      staffData.push(...regionAgents);
    });

    // Clear existing data and insert new data
    await Staff.deleteMany({});

    // Insert all staff
    const insertedStaff = await Staff.insertMany(staffData);

    // Now update hierarchical relationships
    const superAdmin = insertedStaff.find((s) => s.role === "super_admin");
    const moderateAdmin = insertedStaff.find(
      (s) => s.role === "moderate_admin"
    );
    const regionalManagersInserted = insertedStaff.filter(
      (s) => s.role === "regional_manager"
    );
    const agentsInserted = insertedStaff.filter((s) => s.role === "agent");

    // Update regional managers to report to moderate admin
    for (const rm of regionalManagersInserted) {
      await Staff.findByIdAndUpdate(rm._id, {
        reportsTo: moderateAdmin._id,
        createdBy: superAdmin._id,
      });
    }

    // Update agents to report to their regional managers and be managed by them
    for (const rm of regionalManagersInserted) {
      const regionAgents = agentsInserted.filter(
        (agent) => agent.region?.toString() === rm.region?.toString()
      );

      // Update agents
      for (const agent of regionAgents) {
        await Staff.findByIdAndUpdate(agent._id, {
          reportsTo: rm._id,
          managedBy: rm._id,
          createdBy: rm._id,
        });
      }

      // Update regional manager's subordinates
      await Staff.findByIdAndUpdate(rm._id, {
        subordinates: regionAgents.map((a) => a._id),
      });
    }

    // Update moderate admin's subordinates (regional managers)
    await Staff.findByIdAndUpdate(moderateAdmin._id, {
      subordinates: regionalManagersInserted.map((rm) => rm._id),
      createdBy: superAdmin._id,
    });

    console.log(
      `Seeded Staff collection with ${insertedStaff.length} staff members`
    );
    console.log(`- Super Admin: 1`);
    console.log(`- Moderate Admin: 1`);
    console.log(`- Regional Managers: ${regionalManagersInserted.length}`);
    console.log(`- Agents: ${agentsInserted.length}`);
  } catch (error) {
    console.error("Error seeding Staff:", error);
    throw error;
  }
};

module.exports = seedStaff;

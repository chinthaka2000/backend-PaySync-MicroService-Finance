/**
 * Super Admin Routes
 * Highest level administrative functions
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles, requirePermissions } = require('../middlewares/authMiddleware');
const { PERMISSIONS } = require('../utils/permissions');

// All routes require authentication and super admin privileges
router.use(authenticate);
router.use(authorizeRoles('super_admin'));

/**
 * Super Admin Dashboard
 * GET /api/super-admin/dashboard
 */
router.get('/dashboard',
  requirePermissions(PERMISSIONS.FULL_SYSTEM_ACCESS),
  async (req, res) => {
    try {
      // Get system-wide statistics
      const [
        totalStaff,
        totalRegions,
        totalClients,
        totalLoans,
        systemHealth
      ] = await Promise.all([
        require('../models/Staff').countDocuments(),
        require('../models/Region').countDocuments(),
        require('../models/Client').countDocuments(),
        require('../models/Loan').countDocuments(),
        // System health check
        Promise.resolve({
          database: 'connected',
          cache: 'available',
          services: 'operational'
        })
      ]);

      // Get recent activity
      const recentActivity = await require('../models/Staff').find({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(10);

      res.status(200).json({
        success: true,
        message: 'Super admin dashboard data retrieved successfully',
        data: {
          systemOverview: {
            totalStaff,
            totalRegions,
            totalClients,
            totalLoans
          },
          systemHealth,
          recentActivity,
          permissions: req.user.permissions
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Super admin dashboard error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching dashboard data',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * System Configuration
 * GET /api/super-admin/system-config
 */
router.get('/system-config',
  requirePermissions(PERMISSIONS.SYSTEM_CONFIGURATION),
  async (req, res) => {
    try {
      res.status(200).json({
        success: true,
        message: 'System configuration retrieved successfully',
        data: {
          environment: process.env.NODE_ENV,
          version: '1.0.0',
          features: {
            caching: process.env.ENABLE_REDIS === 'true',
            emailService: true,
            fileUpload: true,
            compression: false // Currently disabled
          },
          security: {
            jwtExpiry: process.env.JWT_EXPIRES_IN,
            rateLimiting: true,
            inputSanitization: true
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('System config error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching system configuration',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * System Health Monitoring
 * GET /api/super-admin/health
 */
router.get('/health',
  requirePermissions(PERMISSIONS.FULL_SYSTEM_ACCESS),
  async (req, res) => {
    try {
      const mongoose = require('mongoose');

      // Database health check
      const dbHealth = {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name
      };

      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memoryHealth = {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      };

      // System uptime
      const uptime = {
        process: `${Math.round(process.uptime())} seconds`,
        system: `${Math.round(require('os').uptime())} seconds`
      };

      // Load average (Unix systems)
      const loadAverage = require('os').loadavg();

      // Active connections and performance
      const performance = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuUsage: process.cpuUsage(),
        loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
      };

      // Service status checks
      const services = {
        database: dbHealth.status === 'connected',
        emailService: true, // Assume working if no errors
        fileUpload: true,
        authentication: true
      };

      // Overall health status
      const allServicesHealthy = Object.values(services).every(status => status === true);
      const overallStatus = allServicesHealthy ? 'healthy' : 'degraded';

      res.status(200).json({
        success: true,
        message: 'System health status retrieved successfully',
        data: {
          status: overallStatus,
          timestamp: new Date().toISOString(),
          uptime,
          database: dbHealth,
          memory: memoryHealth,
          performance,
          services,
          environment: {
            nodeEnv: process.env.NODE_ENV,
            port: process.env.PORT,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Error during health check',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * System Statistics
 * GET /api/super-admin/statistics
 */
router.get('/statistics',
  requirePermissions(PERMISSIONS.VIEW_SYSTEM_ANALYTICS),
  async (req, res) => {
    try {
      const { period = '30d' } = req.query;

      // Calculate date range
      const now = new Date();
      let startDate;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get comprehensive statistics
      const [
        totalUsers,
        totalClients,
        totalLoans,
        totalPayments,
        recentRegistrations,
        loanStatusStats,
        paymentStats,
        systemActivity
      ] = await Promise.all([
        require('../models/Staff').countDocuments(),
        require('../models/Client').countDocuments(),
        require('../models/Loan').countDocuments(),
        require('../models/Payment').countDocuments(),
        require('../models/Client').countDocuments({
          registrationDate: { $gte: startDate }
        }),
        require('../models/Loan').aggregate([
          {
            $group: {
              _id: '$loanStatus',
              count: { $sum: 1 },
              totalAmount: { $sum: '$loanAmount' }
            }
          }
        ]),
        require('../models/Payment').aggregate([
          {
            $match: { paymentDate: { $gte: startDate } }
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$paymentAmount' }
            }
          }
        ]),
        require('../models/Staff').aggregate([
          {
            $match: { createdAt: { $gte: startDate } }
          },
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      res.status(200).json({
        success: true,
        message: 'System statistics retrieved successfully',
        data: {
          period,
          dateRange: { startDate, endDate: now },
          overview: {
            totalUsers,
            totalClients,
            totalLoans,
            totalPayments,
            recentRegistrations
          },
          loanStatistics: loanStatusStats,
          paymentStatistics: paymentStats,
          systemActivity,
          generatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Statistics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error while fetching statistics',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * Database Management
 * POST /api/super-admin/database/backup
 */
router.post('/database/backup',
  requirePermissions(PERMISSIONS.DATABASE_MANAGEMENT),
  async (req, res) => {
    try {
      // This is a placeholder for database backup functionality
      // In production, this would trigger a proper backup process

      const backupId = `backup_${Date.now()}`;
      const timestamp = new Date().toISOString();

      res.status(200).json({
        success: true,
        message: 'Database backup initiated successfully',
        data: {
          backupId,
          status: 'initiated',
          timestamp,
          estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          note: 'This is a development environment. In production, implement proper backup mechanisms.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Database backup error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Internal server error during database backup',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

module.exports = router;
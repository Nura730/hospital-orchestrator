const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const adminDashboardRoutes = require('./adminDashboard.routes');
const adminRoutes = require('./admin.routes');
const bedRoutes = require('./bed.routes');
const peopleRoutes = require('./people.routes');
const doctorDashboardRoutes = require('./doctorDashboard.routes');
const doctorRoutes = require('./doctor.routes');
const otRoutes = require('./ot.routes');
const equipmentRoutes = require('./equipment.routes');
const alertRoutes = require('./alert.routes');
const notificationRoutes = require('./notification.routes');
const kpiRoutes = require('./kpi.routes');
const flowRoutes = require('./flow.routes');

const router = Router();

// Health check endpoint
router.use('/health', healthRoutes);

// Authentication endpoints
router.use('/auth', authRoutes);

// Hospital Admin Dashboard & Admin Management
router.use('/admin', adminDashboardRoutes);
router.use('/admin', adminRoutes);

// Doctor Dashboard & Doctor Workflows
router.use('/doctor', doctorDashboardRoutes);
router.use('/doctor', doctorRoutes);

// OT Management, Rooms & Scheduling
router.use('/ot', otRoutes);

// Bed Management
router.use('/beds', bedRoutes);

// People Directory & Census
router.use('/people', peopleRoutes);

// Equipment Tracking & Maintenance
router.use('/equipment', equipmentRoutes);

// Alerts Management
router.use('/alerts', alertRoutes);

// Notifications
router.use('/notifications', notificationRoutes);

// KPI & Analytics
router.use('/kpis', kpiRoutes);

// Predictive Flow Intelligence
router.use('/flow', flowRoutes);

module.exports = router;

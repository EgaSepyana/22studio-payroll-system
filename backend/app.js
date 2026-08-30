import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import articleCategoryRoutes from './routes/articleCategoryRoutes.js';
import workLogRoutes from './routes/workLogRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import cashAdvanceRoutes from './routes/cashAdvanceRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import suratJalanRoutes from './routes/suratJalanRoutes.js';
import lembarPORoutes from './routes/lembarPORoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import cmsRoutes from './routes/cmsRoutes.js';
import ownerSettingsRoutes from './routes/ownerSettingsRoutes.js';
import ownerCashRoutes from './routes/ownerCashRoutes.js';
import cashAccountLookupRoutes from './routes/cashAccountLookupRoutes.js';
import ownerIncomeRoutes from './routes/ownerIncomeRoutes.js';
import ownerExpenseRoutes from './routes/ownerExpenseRoutes.js';
import ownerLiabilityRoutes from './routes/ownerLiabilityRoutes.js';
import ownerDashboardRoutes from './routes/ownerDashboardRoutes.js';
import ownerAssetRoutes from './routes/ownerAssetRoutes.js';
import ownerInventoryRoutes from './routes/ownerInventoryRoutes.js';
import ownerReportRoutes from './routes/ownerReportRoutes.js';
import publicOrderRoutes from './routes/publicOrderRoutes.js';
import publicCmsRoutes from './routes/publicCmsRoutes.js';
import shortLinkRoutes from './routes/shortLinkRoutes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'OK' }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/article-categories', articleCategoryRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/cashadvances', cashAdvanceRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/surat-jalan', suratJalanRoutes);
app.use('/api/lembar-po', lembarPORoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/owner/dashboard', ownerDashboardRoutes);
app.use('/api/owner/settings', ownerSettingsRoutes);
app.use('/api/owner/cash', ownerCashRoutes);
app.use('/api/cash-accounts', cashAccountLookupRoutes);
app.use('/api/owner/income', ownerIncomeRoutes);
app.use('/api/owner/expenses', ownerExpenseRoutes);
app.use('/api/owner/liabilities', ownerLiabilityRoutes);
app.use('/api/owner/assets', ownerAssetRoutes);
app.use('/api/owner/inventory', ownerInventoryRoutes);
app.use('/api/owner/reports', ownerReportRoutes);
// Mounted at distinct sub-paths (not both at /api/public) so each router's
// own rate limiter only ever applies to its own requests — two routers
// sharing one prefix would otherwise both run their middleware for every
// request under that prefix, double-limiting whichever one is stricter.
app.use('/api/public', publicOrderRoutes);
app.use('/api/public/cms', publicCmsRoutes);
// Not under /api — this is meant to be a short, human-clickable URL
// (e.g. https://backend.com/s/aB3xY), not an API endpoint.
app.use('/s', shortLinkRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

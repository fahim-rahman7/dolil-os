import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { publicAuthRouter, privateAuthRouter } from './modules/auth/auth.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import landRoutes from './modules/lands/lands.routes.js';
import deedRoutes from './modules/deeds/deeds.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import documentRoutes from './modules/documents/documents.routes.js';
import userRoutes from './modules/users/users.routes.js';
import settingsRoutes, { officeInfoRouter } from './modules/settings/settings.routes.js';
import templateRoutes from './modules/templates/templates.routes.js';
import rateRoutes from './modules/rates/rates.routes.js';
import calcRoutes from './modules/calc/calc.routes.js';
import { auth } from './middleware/auth.js';
import { errors, notFound, requestId } from './middleware/errors.js';

const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', exposedHeaders: ['Content-Disposition', 'X-Request-Id'] }));

// Documents carry base64 payloads: give that router its own larger body limit before the global parser.
app.use('/api/documents', express.json({ limit: '8mb' }), auth, documentRoutes);
app.use(express.json({ limit: '1mb' }));

const loginLimiter =
  process.env.RATE_LIMIT_DISABLED === '1'
    ? (_req: any, _res: any, next: any) => next()
    : rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many sign-in attempts. Try again later.' } });
app.use('/api/auth/login', loginLimiter);

app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/auth', publicAuthRouter, privateAuthRouter);
app.use('/api/office', auth, officeInfoRouter);
app.use('/api/settings', auth, settingsRoutes);
app.use('/api/users', auth, userRoutes);
app.use('/api/templates', auth, templateRoutes);
app.use('/api/rates', auth, rateRoutes);
app.use('/api/calculations', auth, calcRoutes);
app.use('/api/customers', auth, customerRoutes);
app.use('/api/lands', auth, landRoutes);
app.use('/api/deeds', auth, deedRoutes);
app.use('/api/payments', auth, paymentRoutes);
app.use('/api/reports', auth, reportRoutes);
app.use(notFound);
app.use(errors);

export default app;

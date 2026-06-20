import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import gmailRoutes from './modules/gmail/gmail.routes.js';
import emailsRoutes from './modules/emails/emails.routes.js';
import summariesRoutes from './modules/summaries/summaries.routes.js';
import categoriesRoutes from './modules/categories/categories.routes.js';
import composeRoutes from './modules/compose/compose.routes.js';
import chatRoutes from './modules/chat/chat.routes.js';
import newsletterRoutes from './modules/newsletter/newsletter.routes.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/summary', summariesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api', composeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/newsletter', newsletterRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'MailMind AI server started');
});

export default app;

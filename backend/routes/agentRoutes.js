import { Router } from 'express';
import * as agentController from '../controllers/agentController.js';
import { requireAuth, requireAgentScope } from '../middleware/auth.js';
import { ANY_AGENT_SCOPE } from '../config/agentScopes.js';

// Agent-only endpoints: no human role is allowed on any of them.
const router = Router();
router.use(requireAuth);

router.get('/me', requireAgentScope(ANY_AGENT_SCOPE), agentController.me);
router.get('/orders/public-summary', requireAgentScope('orders:public-summary'), agentController.publicSummary);
router.get('/orders/:id/design-brief', requireAgentScope('orders:read-design'), agentController.designBrief);

export default router;

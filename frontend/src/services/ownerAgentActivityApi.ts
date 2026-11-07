import { api } from './api'
import type { AgentActivity, ApiResponse } from '@/types'

export async function getAgentActivity(agent?: string) {
  const res = await api.get<ApiResponse<AgentActivity>>('/owner/agent-activity', {
    params: agent ? { agent } : {},
  })
  return res.data.data
}

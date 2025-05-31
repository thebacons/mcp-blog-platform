// src/registry.js
import logger from './logger.js';

const agentRegistry = new Map(); // In-memory store for registered agents

export function registerAgent(agentDetails) {
  if (!agentDetails || !agentDetails.agentId || !agentDetails.capabilities || !agentDetails.endpoint) {
    logger.error('Invalid agent details for registration:', agentDetails);
    throw new Error('Invalid agent details provided for registration.');
  }
  if (agentRegistry.has(agentDetails.agentId)) {
    logger.warn(`Agent ${agentDetails.agentId} is already registered. Updating details.`);
  }
  agentRegistry.set(agentDetails.agentId, agentDetails);
  logger.info(`Agent ${agentDetails.agentId} registered/updated with endpoint ${agentDetails.endpoint} and capabilities: ${agentDetails.capabilities.map(c => c.name).join(', ')}`);
}

export function getAgentById(agentId) {
  return agentRegistry.get(agentId);
}

export function findAgentsByCapability(capabilityName) {
  const matchingAgents = [];
  for (const agent of agentRegistry.values()) {
    if (agent.capabilities && agent.capabilities.some(cap => cap.name === capabilityName)) {
      matchingAgents.push(agent);
    }
  }
  logger.debug(`Found ${matchingAgents.length} agents for capability "${capabilityName}"`);
  return matchingAgents;
}

export function clearRegistry() {
  agentRegistry.clear();
  logger.info('Agent registry cleared.');
}

/**
 * Get a single agent that can handle the specified capability
 * @param {string} capabilityName - Name of the capability to look for
 * @returns {Object|null} - The first matching agent or null if none found
 */
export function getAgentByCapability(capabilityName) {
  const agents = findAgentsByCapability(capabilityName);
  if (agents && agents.length > 0) {
    // Return the first matching agent
    // In a production system, you might want to implement more sophisticated
    // selection logic (load balancing, agent preferences, etc.)
    return agents[0];
  }
  logger.warn(`No agent found for capability: ${capabilityName}`);
  return null;
}

/**
 * Get the endpoint URL for a specific agent
 * @param {string} agentId - ID of the agent
 * @returns {string|null} - The endpoint URL or null if agent not found
 */
export function getAgentEndpoint(agentId) {
  const agent = getAgentById(agentId);
  if (agent && agent.endpoint) {
    return agent.endpoint;
  }
  logger.warn(`No endpoint found for agent: ${agentId}`);
  return null;
}

export default {
  registerAgent,
  getAgentById,
  findAgentsByCapability,
  getAgentByCapability,
  getAgentEndpoint,
  clearRegistry,
  _getRegistry: () => agentRegistry 
};

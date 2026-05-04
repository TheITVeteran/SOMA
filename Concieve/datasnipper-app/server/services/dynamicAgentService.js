const fs = require('fs').promises;
const path = require('path');
const somaService = require('./somaService');

class DynamicAgentService {
  constructor() {
    this.agentsPath = path.join(__dirname, '../data/dynamic_agents.json');
    this.agents = {};
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.dirname(this.agentsPath), { recursive: true });
      
      // Load agents
      try {
        const data = await fs.readFile(this.agentsPath, 'utf8');
        this.agents = JSON.parse(data);
      } catch (err) {
        // File doesn't exist yet, start empty
        this.agents = {};
      }
      
      this.initialized = true;
      console.log(`[DYNAMIC AGENTS] Loaded ${Object.keys(this.agents).length} custom agents.`);
    } catch (error) {
      console.error('[DYNAMIC AGENTS] Initialization error:', error.message);
    }
  }

  /**
   * Create a new custom agent powered by SOMA
   */
  async createAgent(name, description, instructions, ownerId = 'system') {
    if (!this.initialized) await this.initialize();
    
    const id = name.toLowerCase().replace(/\s+/g, '_');
    
    if (this.agents[id]) {
        throw new Error(`Agent '${name}' already exists.`);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
    
    this.agents[id] = {
      id,
      name,
      description,
      instructions,
      owner: ownerId,
      shared: false, // Private by default
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      permanent: false
    };

    await this.saveAgents();
    return this.agents[id];
  }

  /**
   * Rename an agent (Changes ID and Name)
   */
  async renameAgent(oldName, newName, userId) {
    if (!this.initialized) await this.initialize();
    
    const oldId = oldName.toLowerCase().replace(/\s+/g, '_');
    const newId = newName.toLowerCase().replace(/\s+/g, '_');
    
    const agent = this.agents[oldId];
    if (!agent) throw new Error(`Agent '${oldName}' not found.`);

    // Permission check
    if (agent.owner !== 'system' && agent.owner !== userId) {
        throw new Error("You don't have permission to rename this agent.");
    }

    if (this.agents[newId]) throw new Error(`Name '${newName}' is already taken.`);

    // Create new entry
    this.agents[newId] = {
        ...agent,
        id: newId,
        name: newName
    };

    // Delete old entry
    delete this.agents[oldId];

    await this.saveAgents();
    return this.agents[newId];
  }

  /**
   * Share an agent with the team (Automatically persists it)
   */
  async toggleShareAgent(agentName, userId, shouldShare = true) {
    if (!this.initialized) await this.initialize();
    const id = agentName.toLowerCase().replace(/\s+/g, '_');
    const agent = this.agents[id];
    
    if (!agent) throw new Error(`Agent '${agentName}' not found.`);

    // Permission check
    if (agent.owner !== 'system' && agent.owner !== userId) {
        throw new Error("You don't have permission to share this agent.");
    }

    agent.shared = shouldShare;
    
    // Sharing makes it permanent (valuable team asset)
    if (shouldShare) {
        agent.permanent = true;
        delete agent.expires_at;
    }

    await this.saveAgents();
    return agent;
  }

  /**
   * Make an agent permanent (remove expiration)
   */
  async persistAgent(agentName) {
    if (!this.initialized) await this.initialize();
    const id = agentName.toLowerCase().replace(/\s+/g, '_');
    
    if (this.agents[id]) {
      this.agents[id].permanent = true;
      delete this.agents[id].expires_at;
      await this.saveAgents();
      return this.agents[id];
    }
    throw new Error(`Agent '${agentName}' not found.`);
  }

  /**
   * Delete an agent immediately
   */
  async deleteAgent(agentName, userId) {
    if (!this.initialized) await this.initialize();
    const id = agentName.toLowerCase().replace(/\s+/g, '_');
    const agent = this.agents[id];
    
    if (!agent) throw new Error(`Agent '${agentName}' not found.`);

    // Permission check (allow if owner OR if user is admin/system)
    if (userId !== 'admin' && agent.owner !== 'system' && agent.owner !== userId) {
        throw new Error("You can only delete your own agents.");
    }

    delete this.agents[id];
    await this.saveAgents();
    return { success: true, message: `Agent '${agentName}' deleted.` };
  }

  /**
   * Check if agent is expired
   */
  isExpired(agent) {
    if (agent.permanent) return false;
    if (!agent.expires_at) return false;
    return new Date(agent.expires_at) < new Date();
  }

  /**
   * Call a custom agent to process data
   */
  async invokeAgent(agentName, query, context = {}) {
    if (!this.initialized) await this.initialize();

    const id = agentName.toLowerCase().replace(/\s+/g, '_');
    const agent = this.agents[id];

    if (!agent) {
      throw new Error(`Agent '${agentName}' not found.`);
    }

    // Check expiration
    if (this.isExpired(agent)) {
      delete this.agents[id];
      await this.saveAgents();
      throw new Error(`Agent '${agentName}' has expired and dissolved.`);
    }

    console.log(`[DYNAMIC AGENTS] Invoking ${agent.name}...`);

    // Construct the "Persona" for SOMA
    const systemPrompt = `
YOU ARE: ${agent.name}
DESCRIPTION: ${agent.description}
YOUR INSTRUCTIONS: ${agent.instructions}

TASK: ${query}
`;

    // Call SOMA
    try {
      const result = await somaService.assistWithQuery(
        systemPrompt, 
        { 
            userId: `agent_${id}`, 
            context: JSON.stringify(context) 
        }
      );

      return {
        agent: agent.name,
        response: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[DYNAMIC AGENTS] ${agent.name} failed:`, error.message);
      throw error;
    }
  }

  async saveAgents() {
    // Optional: Cleanup expired agents during save
    for (const id in this.agents) {
        if (this.isExpired(this.agents[id])) {
            delete this.agents[id];
        }
    }
    await fs.writeFile(this.agentsPath, JSON.stringify(this.agents, null, 2));
  }

  getAgentList(userId = 'anonymous') {
    // Filter: Show agents that are NOT expired AND (Public OR Owned by User)
    return Object.values(this.agents)
        .filter(a => !this.isExpired(a))
        .filter(a => a.shared || a.owner === userId || a.owner === 'system')
        .map(a => ({
            name: a.name,
            description: a.description,
            id: a.id,
            owner: a.owner,
            shared: !!a.shared,
            permanent: !!a.permanent,
            expires_at: a.expires_at || 'Never'
        }));
  }
}

module.exports = new DynamicAgentService();

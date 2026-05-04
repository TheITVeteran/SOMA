const fs = require('fs').promises;
const path = require('path');

class BeliefService {
  constructor() {
    this.beliefsPath = path.join(__dirname, '../data/user_beliefs.json');
    this.beliefs = {}; // { userId: { riskTolerance: 'low', verbosity: 'concise', history: [] } }
    this.initialized = false;
  }

  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.beliefsPath), { recursive: true });
      try {
        const data = await fs.readFile(this.beliefsPath, 'utf8');
        this.beliefs = JSON.parse(data);
      } catch (err) {
        this.beliefs = {};
      }
      this.initialized = true;
      console.log(`[BELIEFS] Loaded profiles for ${Object.keys(this.beliefs).length} users.`);
    } catch (error) {
      console.error('[BELIEFS] Initialization error:', error.message);
    }
  }

  /**
   * Get the psychological profile for a user
   */
  async getUserProfile(userId) {
    if (!this.initialized) await this.initialize();
    
    // Default profile
    if (!this.beliefs[userId]) {
        this.beliefs[userId] = {
            riskTolerance: 'medium', // low, medium, high
            explanationStyle: 'balanced', // concise, balanced, detailed
            auditPosture: 'conservative', // aggressive, conservative
            observations: 0,
            lastSeen: new Date().toISOString()
        };
        await this.save();
    }
    return this.beliefs[userId];
  }

  /**
   * Update a belief based on user action
   * e.g., User rejected a risk warning -> Increase risk tolerance
   */
  async recordInteraction(userId, type, details) {
      if (!this.initialized) await this.initialize();
      const profile = await this.getUserProfile(userId);

      // Simple heuristic updates (SOMA would do this more complexly in reality)
      if (type === 'rejected_warning') {
          profile.riskTolerance = 'high'; // User ignores warnings
      } else if (type === 'asked_for_detail') {
          profile.explanationStyle = 'detailed';
      } else if (type === 'asked_for_summary') {
          profile.explanationStyle = 'concise';
      }

      profile.observations++;
      profile.lastSeen = new Date().toISOString();
      await this.save();
  }

  /**
   * Generate the "System Prompt" context for SOMA based on this user
   */
  async getContextString(userId) {
      const profile = await this.getUserProfile(userId);
      return `
USER PROFILE (THE THINKER'S MEMORY):
- Risk Tolerance: ${profile.riskTolerance.toUpperCase()}
- Explanation Style: ${profile.explanationStyle.toUpperCase()}
- Audit Posture: ${profile.auditPosture.toUpperCase()}
- Experience Level: ${profile.observations > 50 ? 'EXPERT' : 'NOVICE'}

ADAPT YOUR RESPONSE:
- If risk tolerance is LOW, highlight all minor anomalies.
- If explanation style is CONCISE, use bullet points and brevity.
`;
  }

  async save() {
    await fs.writeFile(this.beliefsPath, JSON.stringify(this.beliefs, null, 2));
  }
}

module.exports = new BeliefService();

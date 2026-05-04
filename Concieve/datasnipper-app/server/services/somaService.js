const axios = require('axios');
const fs = require('fs');
const path = require('path');
const beliefService = require('./beliefService'); // The Belief System

// SOMA ULTRA Launcher runs on 3001 by default
const SOMA_API_URL = process.env.SOMA_API_URL || 'http://localhost:3001';

const CURATED_PERSONAS = [
  {
    name: 'tax-advisor',
    specialty: 'Tax provision, compliance, audit support, and review-ready documentation.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\business-analytics\\agents\\tax-advisor.md'
  },
  {
    name: 'business-analyst',
    specialty: 'Business intelligence, KPI frameworks, and executive dashboards.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\business-analytics\\agents\\business-analyst.md'
  },
  {
    name: 'security-auditor',
    specialty: 'Security controls, audit evidence, compliance verification.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\security-compliance\\agents\\security-auditor.md'
  },
  {
    name: 'risk-manager',
    specialty: 'Risk identification, mitigation planning, and control narratives.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\startup-business-analyst\\agents\\risk-manager.md'
  },
  {
    name: 'quant-analyst',
    specialty: 'Quantitative analysis, variance modeling, statistical validation.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\quantitative-trading\\agents\\quant-analyst.md'
  },
  {
    name: 'startup-analyst',
    specialty: 'Operational insights, financial modeling, and growth analysis.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\startup-business-analyst\\agents\\startup-analyst.md'
  },
  {
    name: 'payment-integration',
    specialty: 'Payments, ledger reconciliation, and transaction flows.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\payment-processing\\agents\\payment-integration.md'
  },
  {
    name: 'database-architect',
    specialty: 'Data models, evidence storage, and audit trail design.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\database-design\\agents\\database-architect.md'
  },
  {
    name: 'database-admin',
    specialty: 'Data governance, access controls, and retention policy hygiene.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\database-design\\agents\\database-admin.md'
  },
  {
    name: 'backend-security-coder',
    specialty: 'Secure backend services, compliance-safe integrations.',
    source: 'C:\\Users\\barry\\Desktop\\SOMA\\agents_repo\\plugins\\backend-api-security\\agents\\backend-security-coder.md'
  }
];

class SomaService {
  constructor() {
    this.apiUrl = SOMA_API_URL;
    this._cachedPersonality = null;
    // Initialize beliefs
    beliefService.initialize();
    console.log(`[SOMA] Service initialized, connecting to REAL SOMA at ${this.apiUrl}`);
  }

  // ... (checkHealth remains same)
  async checkHealth() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/health`, { timeout: 2000 });
      return response.status === 200 && (response.data.status === 'active' || response.data.status === 'initializing');
    } catch (error) {
      return false;
    }
  }

  async loadPersonalityProfile() {
    try {
      const personalityPath = process.env.SOMA_PERSONALITY_PATH ||
        'C:\\Users\\barry\\Desktop\\SOMA\\SOMA\\personality\\personality.json';
      if (!fs.existsSync(personalityPath)) return null;
      const raw = fs.readFileSync(personalityPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  async getKevinPersonality() {
    try {
      const res = await axios.get(`${this.apiUrl}/api/kevin/personality`, { timeout: 2000 });
      return res.data?.personality || res.data || null;
    } catch (error) {
      return null;
    }
  }

  async getKevinStatus() {
    try {
      const res = await axios.get(`${this.apiUrl}/api/kevin/status`, { timeout: 2000 });
      return res.data || null;
    } catch (error) {
      return null;
    }
  }

  async buildThinkerPersona(context = {}) {
    if (!this._cachedPersonality) {
      this._cachedPersonality = await this.loadPersonalityProfile();
    }

    const kevinPersonality = await this.getKevinPersonality();
    const kevinStatus = await this.getKevinStatus();

    const steveTraits = {
      name: 'Steve',
      focus: 'systems architecture, structured reasoning, tool-first execution',
      tone: 'precise, technical, pragmatic',
      behaviors: ['asks for constraints', 'proposes steps', 'validates assumptions']
    };

    return {
      somaPersonality: this._cachedPersonality?.personality || null,
      kevinPersonality,
      kevinStatus,
      steveTraits,
      curatedPersonas: CURATED_PERSONAS,
      domain: 'finance_audit',
      style: 'executive-brief, evidence-first, audit-ready',
      userContext: context
    };
  }

  /**
   * THE THINKER (Public Interface)
   */
  async assistWithQuery(message, context = {}) {
    try {
        const userId = context.userId || 'default_user';
        
        // 1. Fetch User Beliefs (Who am I talking to?)
        const beliefContext = await beliefService.getContextString(userId);

        // 2. Context Construction
        const persona = await this.buildThinkerPersona(context);

        const structuredContext = {
            role: "The Thinker",
            mission: "Translate SOMA's pattern recognition into audit-grade human judgment.",
            domain: 'finance_audit',
            groupMode: true,
            persona,
            user_context: context,
            belief_system: beliefContext
        };

        // 3. Consult SOMA (Cognitive Core)
        // Pass the beliefs as part of the query context so SOMA sees them
        const fullContext = JSON.stringify(structuredContext) + "\n" + beliefContext;
        
        const somaRaw = await this.consultSoma(message, { 
            ...structuredContext, 
            context: fullContext 
        });

        // 4. Update Beliefs (Learning Loop)
        // If the query was explicit feedback, record it
        if (message.toLowerCase().includes('too long') || message.toLowerCase().includes('summarize')) {
            beliefService.recordInteraction(userId, 'asked_for_summary');
        } else if (message.toLowerCase().includes('explain') || message.toLowerCase().includes('why')) {
            beliefService.recordInteraction(userId, 'asked_for_detail');
        }

        // 5. Synthesis
        return this.synthesizeResponse(somaRaw);

    } catch (error) {
        console.error('[THE THINKER] Connection error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            return "I cannot reach my cognitive core (SOMA) right now. Please ensure the engine is running.";
        }
        return "I need to pause. My internal processing encountered an error.";
    }
  }

  /**
   * INTERNAL: SOMA (Cognitive Core)
   */
  async consultSoma(query, internalContext) {
      const response = await axios.post(`${this.apiUrl}/api/reason`, {
        query: query,
        userId: internalContext.user_context?.userId || 'default_user',
        context: internalContext.context || JSON.stringify(internalContext),
        mode: 'analytical'
      }, { timeout: 60000 });

      return response.data;
  }

  /**
   * INTERNAL: Synthesis Layer
   */
  synthesizeResponse(somaRaw) {
      const confidence = somaRaw.confidence || 0.5;
      const rawText = somaRaw.response || "";
      const brain = somaRaw.brain || "SOMA";

      // Visual Cognitive Signature (Improvement #2)
      const signature = `[${brain.toUpperCase()} | ${(confidence * 100).toFixed(0)}%] `;

      let prefix = "";
      
      if (confidence > 0.9) {
          prefix = ""; 
      } else if (confidence > 0.7) {
          prefix = "Based on the current patterns, it appears likely that... ";
      } else if (confidence > 0.4) {
          prefix = "My working hypothesis is... ";
      } else {
          return this.wrapProfessionalResponse(
            `${signature} I don't have enough data to form a conclusion yet.`,
            {
              addClarifier: true
            }
          );
      }

      let cleanedText = rawText.replace(/\[.*?\]/g, "").trim();

      return this.wrapProfessionalResponse(`${signature} ${prefix}${cleanedText}`);
  }

  wrapProfessionalResponse(text, options = {}) {
    const { addClarifier = false } = options;

    const softOpeners = [
      "Absolutely — here’s a clear, consultant‑friendly take:",
      "Of course. Here’s a concise, client‑ready summary:",
      "Certainly. Here’s a practical, audit‑grade response:",
      "Happy to help. Here’s the distilled view:"
    ];

    const clarifiers = [
      "To tailor this precisely, could you share the specific account, period, or document?",
      "If you can share the key file or report name, I can be more exact.",
      "Which business unit or period should I anchor this to?"
    ];

    const nextSteps = [
      "Suggested next step: identify the primary source document and confirm the period under review.",
      "Suggested next step: validate the top 2–3 variances against supporting schedules.",
      "Suggested next step: confirm materiality thresholds and any known exceptions."
    ];

    const opener = softOpeners[Math.floor(Math.random() * softOpeners.length)];
    const closer = addClarifier ? clarifiers[Math.floor(Math.random() * clarifiers.length)] : nextSteps[Math.floor(Math.random() * nextSteps.length)];

    return `${opener}\n\n${text}\n\n${closer}`;
  }

  // ... (analyzeFile remains similar but uses synthesizeResponse)
  async analyzeFile(content, metadata = {}) {
    try {
      const query = `Analyze this document (${metadata.filename}). Identify patterns, risk factors, and financial anomalies.`;

      const somaRaw = await this.consultSoma(query, {
          type: "file_analysis",
          metadata: metadata,
          content_snippet: content.substring(0, 1000)
      });

      return {
        summary: this.synthesizeResponse(somaRaw),
        brain: somaRaw.brain,
        confidence: somaRaw.confidence,
        raw: somaRaw
      };
    } catch (error) {
      console.error('[SOMA] Analysis error:', error.message);
      throw error;
    }
  }
}

module.exports = new SomaService();

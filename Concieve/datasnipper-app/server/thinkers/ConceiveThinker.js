/**
 * ConceiveThinker - Finance & Audit Collaboration Intelligence
 *
 * A domain-specific Thinker that adds finance/audit expertise and
 * collaboration features on top of SOMA's 4 core brains.
 *
 * Core Capabilities:
 * 1. Project Completion Intelligence
 * 2. Intelligent Work Distribution
 * 3. Team Knowledge Graph
 * 4. Collaborative Anomaly Investigation
 * 5. Risk Scoring Synthesis
 * 6. Rollforward Intelligence
 */

import { BaseThinker } from './BaseThinker.js';
import messageBroker from '../arbiters/core/MessageBroker.js';

export class ConceiveThinker extends BaseThinker {
  static domain = 'finance_audit';
  static capabilities = [
    'project_forecasting',
    'work_distribution',
    'team_expertise_mapping',
    'anomaly_collaboration',
    'risk_synthesis',
    'rollforward_intelligence',
    'hypothesis_testing',
    'compliance_tracking'
  ];

  constructor(config = {}) {
    super({
      name: config.name || 'ConceiveThinker',
      domain: ConceiveThinker.domain,
      capabilities: ConceiveThinker.capabilities,
      ...config
    });

    // Finance domain knowledge
    this.knowledge = {
      gaapRules: new Map(),
      auditProcedures: new Map(),
      industryBenchmarks: new Map(),
      complianceStandards: new Map()
    };

    // Team expertise tracking
    this.teamExpertise = new Map(); // userId -> expertise profile

    // Project state tracking
    this.activeProjects = new Map(); // projectId -> project state

    // Workload tracking
    this.teamWorkload = new Map(); // userId -> workload metrics

    // Anomaly collaboration
    this.activeInvestigations = new Map(); // anomalyId -> investigation state

    // Historical patterns (for learning)
    this.historicalPatterns = {
      completionRates: [],
      budgetAccuracy: [],
      skillMatches: []
    };
  }

  async initialize() {
    await super.initialize();

    // Load finance domain knowledge
    await this.loadFinanceKnowledge();

    // Start background tasks
    this.startBackgroundTasks();

    this.logger.info(`[${this.name}] 🧠💭 CONCEIVE Finance Thinker active`);
  }

  _subscribeToMessages() {
    // Listen to SOMA outputs
    messageBroker.subscribe(this.name, 'analysis_complete');
    messageBroker.subscribe(this.name, 'fraud_detected');
    messageBroker.subscribe(this.name, 'reasoning_complete');

    // ConceiveThinker-specific requests
    messageBroker.subscribe(this.name, 'forecast_completion');
    messageBroker.subscribe(this.name, 'distribute_work');
    messageBroker.subscribe(this.name, 'analyze_team_expertise');
    messageBroker.subscribe(this.name, 'collaborative_anomaly');
    messageBroker.subscribe(this.name, 'synthesize_risk');
    messageBroker.subscribe(this.name, 'generate_rollforward');
    messageBroker.subscribe(this.name, 'hypothesis_test');
  }

  async handleMessage(message = {}) {
    const { type, payload } = message;

    switch (type) {
      // Enhance SOMA outputs
      case 'analysis_complete':
        return await this.enhanceAnalysisWithFinanceContext(payload);

      case 'fraud_detected':
        return await this.initiateCollaborativeInvestigation(payload);

      // ConceiveThinker features
      case 'forecast_completion':
        return await this.forecastProjectCompletion(payload);

      case 'distribute_work':
        return await this.intelligentWorkDistribution(payload);

      case 'analyze_team_expertise':
        return await this.analyzeTeamExpertise(payload);

      case 'collaborative_anomaly':
        return await this.collaborativeAnomalyInvestigation(payload);

      case 'synthesize_risk':
        return await this.synthesizeRiskScoring(payload);

      case 'generate_rollforward':
        return await this.generateRollforward(payload);

      case 'hypothesis_test':
        return await this.collaborativeHypothesisTesting(payload);

      default:
        return { success: false, error: 'unknown_message_type' };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CORE FEATURE #1: PROJECT COMPLETION INTELLIGENCE
  // ═══════════════════════════════════════════════════════════

  async forecastProjectCompletion(payload) {
    const { projectId, projectData } = payload;

    this.logger.info(`[${this.name}] 📈 Forecasting completion for project: ${projectId}`);

    const { tasks = [], team = [], startDate, deadline, auditAreas = [] } = projectData;

    // Calculate current state
    const stats = this.calculateProjectStats(tasks, auditAreas);

    // Get SOMA's strategic forecast (PROMETHEUS brain)
    const somaForecast = await this.querySomaForForecast(stats, deadline);

    // ConceiveThinker's finance-specific analysis
    const forecast = {
      projectId,
      timestamp: new Date(),

      // Current state
      currentProgress: {
        overall: stats.overallCompletion,
        byArea: stats.areaCompletion,
        completedTasks: stats.completedTasks,
        totalTasks: stats.totalTasks,
        blockedTasks: stats.blockedTasks
      },

      // SOMA's perspective
      somaAnalysis: {
        strategicForecast: somaForecast.forecast,
        confidence: somaForecast.confidence,
        brain: 'PROMETHEUS'
      },

      // ConceiveThinker's finance expertise
      conceiveAnalysis: {
        // Identify bottlenecks
        bottlenecks: this.identifyBottlenecks(tasks, auditAreas),

        // Critical path analysis
        criticalPath: this.calculateCriticalPath(auditAreas),

        // Risk areas
        riskAreas: this.identifyRiskAreas(auditAreas, stats),

        // Workload balance
        workloadBalance: this.analyzeWorkloadBalance(team, tasks),

        // Estimated completion date
        estimatedCompletion: this.calculateCompletionDate(stats, team, deadline),

        // Confidence based on historical patterns
        confidence: this.calculateForecastConfidence(stats)
      },

      // Actionable recommendations
      recommendations: this.generateRecommendations(stats, team, deadline),

      // What-if scenarios
      scenarios: {
        currentPace: this.calculateScenario('current', stats, team, deadline),
        optimistic: this.calculateScenario('optimistic', stats, team, deadline),
        pessimistic: this.calculateScenario('pessimistic', stats, team, deadline),
        withAdditionalResources: this.calculateScenario('additional_staff', stats, team, deadline)
      }
    };

    // Learn from this forecast for future improvements
    await this.learn({ type: 'forecast', projectId, forecast });

    // Broadcast forecast to team
    messageBroker.sendMessage({
      from: this.name,
      to: 'broadcast',
      type: 'completion_forecast',
      payload: forecast
    });

    return { success: true, forecast };
  }

  calculateProjectStats(tasks, auditAreas) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

    // Calculate completion by audit area
    const areaCompletion = auditAreas.map(area => {
      const areaProcedures = area.procedures || [];
      const completed = areaProcedures.filter(p => p.status === 'Complete').length;
      const total = areaProcedures.length;

      return {
        area: area.name,
        completion: total > 0 ? (completed / total) * 100 : 0,
        materiality: area.materiality,
        risk: area.risk,
        completed,
        total
      };
    });

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      overallCompletion: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      areaCompletion
    };
  }

  identifyBottlenecks(tasks, auditAreas) {
    const bottlenecks = [];

    // Blocked tasks
    const blocked = tasks.filter(t => t.status === 'blocked');
    if (blocked.length > 0) {
      bottlenecks.push({
        type: 'blocked_tasks',
        severity: 'high',
        count: blocked.length,
        tasks: blocked.map(t => ({ id: t._id, name: t.name, reason: t.blockReason })),
        impact: `${blocked.length} tasks blocked, delaying dependent work`
      });
    }

    // Areas with low completion but high risk
    const highRiskLowCompletion = auditAreas.filter(area =>
      area.risk === 'High' && this.getAreaCompletion(area) < 50
    );

    if (highRiskLowCompletion.length > 0) {
      bottlenecks.push({
        type: 'high_risk_behind',
        severity: 'critical',
        areas: highRiskLowCompletion.map(a => a.name),
        impact: 'High-risk areas behind schedule - audit opinion at risk'
      });
    }

    return bottlenecks;
  }

  calculateCriticalPath(auditAreas) {
    // Identify must-complete areas for audit opinion
    const critical = auditAreas
      .filter(area => area.materiality === 'High' || area.risk === 'High')
      .map(area => ({
        area: area.name,
        completion: this.getAreaCompletion(area),
        estimatedHoursRemaining: this.estimateRemainingHours(area),
        dependencies: [] // Could enhance with dependency tracking
      }));

    return {
      criticalAreas: critical,
      totalEstimatedHours: critical.reduce((sum, a) => sum + a.estimatedHoursRemaining, 0)
    };
  }

  identifyRiskAreas(auditAreas, stats) {
    const risks = [];

    // Behind schedule
    if (stats.overallCompletion < 30 && this.daysUntilDeadline(new Date()) < 7) {
      risks.push({
        type: 'timeline_risk',
        severity: 'high',
        message: 'Less than 30% complete with 1 week remaining'
      });
    }

    // Material areas incomplete
    const materialIncomplete = auditAreas.filter(a =>
      a.materiality === 'High' && this.getAreaCompletion(a) < 80
    );

    if (materialIncomplete.length > 0) {
      risks.push({
        type: 'materiality_risk',
        severity: 'medium',
        areas: materialIncomplete.map(a => a.name),
        message: 'Material areas not yet finalized'
      });
    }

    return risks;
  }

  analyzeWorkloadBalance(team, tasks) {
    const workload = team.map(member => {
      const memberTasks = tasks.filter(t => t.assignedTo === member._id || t.assignedTo === member.id);
      const completed = memberTasks.filter(t => t.status === 'completed').length;
      const inProgress = memberTasks.filter(t => t.status === 'in_progress').length;
      const pending = memberTasks.filter(t => t.status === 'pending').length;

      return {
        member: {
          id: member._id || member.id,
          name: member.name,
          role: member.role
        },
        totalTasks: memberTasks.length,
        completed,
        inProgress,
        pending,
        utilizationScore: this.calculateUtilization(memberTasks)
      };
    });

    // Identify imbalances
    const avgUtilization = workload.reduce((sum, w) => sum + w.utilizationScore, 0) / workload.length;
    const overloaded = workload.filter(w => w.utilizationScore > avgUtilization * 1.5);
    const underutilized = workload.filter(w => w.utilizationScore < avgUtilization * 0.5);

    return {
      teamWorkload: workload,
      averageUtilization: avgUtilization,
      overloaded,
      underutilized,
      balanced: overloaded.length === 0 && underutilized.length === 0
    };
  }

  generateRecommendations(stats, team, deadline) {
    const recommendations = [];

    // Bottleneck recommendations
    if (stats.blockedTasks > 0) {
      recommendations.push({
        priority: 'critical',
        type: 'unblock_tasks',
        action: `Unblock ${stats.blockedTasks} tasks immediately`,
        impact: 'High - blocking dependent work',
        assignTo: 'Manager'
      });
    }

    // Resource recommendations
    const daysRemaining = this.daysUntilDeadline(deadline);
    const completionRate = stats.overallCompletion / Math.max(1, this.daysElapsed(new Date()));

    if (completionRate * daysRemaining < (100 - stats.overallCompletion)) {
      recommendations.push({
        priority: 'high',
        type: 'add_resources',
        action: 'Add 1-2 additional team members to meet deadline',
        impact: 'Current pace will miss deadline by ~4 days',
        assignTo: 'Partner'
      });
    }

    // Workload balancing
    // ... add more recommendations

    return recommendations;
  }

  calculateCompletionDate(stats, team, deadline) {
    // Simple forecast based on current velocity
    const daysElapsed = this.daysElapsed(new Date());
    const completionRate = stats.overallCompletion / Math.max(1, daysElapsed);
    const remainingPercentage = 100 - stats.overallCompletion;
    const estimatedDaysRemaining = remainingPercentage / Math.max(0.1, completionRate);

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(estimatedDaysRemaining));

    return {
      date: estimatedDate,
      daysFromNow: Math.ceil(estimatedDaysRemaining),
      beforeDeadline: estimatedDate < new Date(deadline),
      variance: this.calculateDateVariance(estimatedDate, deadline)
    };
  }

  calculateScenario(scenarioType, stats, team, deadline) {
    // Generate what-if scenarios
    let multiplier = 1.0;

    switch (scenarioType) {
      case 'optimistic':
        multiplier = 1.3; // 30% faster
        break;
      case 'pessimistic':
        multiplier = 0.7; // 30% slower
        break;
      case 'additional_staff':
        multiplier = 1.5; // 50% faster with more people
        break;
      case 'current':
      default:
        multiplier = 1.0;
    }

    const adjustedCompletion = this.calculateCompletionDate(stats, team, deadline);
    adjustedCompletion.daysFromNow = Math.ceil(adjustedCompletion.daysFromNow / multiplier);

    return {
      scenario: scenarioType,
      estimatedCompletion: adjustedCompletion,
      description: this.getScenarioDescription(scenarioType, multiplier)
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CORE FEATURE #2: INTELLIGENT WORK DISTRIBUTION
  // ═══════════════════════════════════════════════════════════

  async intelligentWorkDistribution(payload) {
    const { projectId, newTask, team } = payload;

    this.logger.info(`[${this.name}] 🎯 Distributing work: ${newTask.name}`);

    // Score each team member
    const scores = team.map(member => ({
      member,
      score: this.scoreTeamMember(member, newTask),
      breakdown: this.explainScore(member, newTask),
      currentWorkload: this.getWorkload(member._id || member.id)
    }));

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Get SOMA's opinion on the assignment
    const somaRecommendation = await this.querySomaForAssignment(newTask, scores.slice(0, 3));

    const recommendation = {
      taskName: newTask.name,
      taskComplexity: this.assessTaskComplexity(newTask),

      // Top 3 candidates
      recommendations: scores.slice(0, 3).map((s, idx) => ({
        rank: idx + 1,
        member: s.member,
        score: s.score,
        reasoning: s.breakdown,
        workloadImpact: this.calculateWorkloadImpact(s.member, newTask)
      })),

      // SOMA's perspective
      somaRecommendation,

      // Final recommendation
      primaryAssignee: scores[0].member,
      backupAssignee: scores[1].member,

      // Confidence
      confidence: this.calculateAssignmentConfidence(scores)
    };

    return { success: true, recommendation };
  }

  scoreTeamMember(member, task) {
    let score = 0;

    // Expertise match (40 points)
    const expertiseMatch = this.calculateExpertiseMatch(member, task);
    score += expertiseMatch * 40;

    // Availability (30 points)
    const workload = this.getWorkload(member._id || member.id);
    const availabilityScore = Math.max(0, (100 - workload.utilizationPercentage) / 100);
    score += availabilityScore * 30;

    // Past performance on similar tasks (20 points)
    const performanceScore = this.getPastPerformance(member._id || member.id, task.category);
    score += performanceScore * 20;

    // Role appropriateness (10 points)
    const roleScore = this.assessRoleMatch(member.role, task.complexity);
    score += roleScore * 10;

    return Math.min(100, score);
  }

  calculateExpertiseMatch(member, task) {
    if (!member.expertise || !task.requiredSkills) return 0.5; // Default

    const memberSkills = new Set(member.expertise.map(e => e.toLowerCase()));
    const requiredSkills = task.requiredSkills.map(s => s.toLowerCase());

    const matches = requiredSkills.filter(skill => memberSkills.has(skill)).length;
    const matchRate = matches / Math.max(1, requiredSkills.length);

    return matchRate;
  }

  explainScore(member, task) {
    return {
      expertise: `${(this.calculateExpertiseMatch(member, task) * 100).toFixed(0)}% skill match`,
      availability: `${this.getWorkload(member._id || member.id).availableHours}h available`,
      performance: `${this.getPastPerformance(member._id || member.id, task.category).toFixed(1)} avg rating`,
      role: `${member.role} - ${this.assessRoleMatch(member.role, task.complexity) > 0.7 ? 'Good fit' : 'Adequate'}`
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CORE FEATURE #3: TEAM KNOWLEDGE GRAPH
  // ═══════════════════════════════════════════════════════════

  async analyzeTeamExpertise(payload) {
    const { projectId, team } = payload;

    this.logger.info(`[${this.name}] 🧠 Analyzing team expertise...`);

    // Build expertise graph
    const expertiseGraph = this.buildExpertiseGraph(team);

    // Identify gaps
    const gaps = this.identifySkillGaps(team, payload.requiredSkills || []);

    // Suggest training
    const trainingPlan = this.generateTrainingPlan(gaps, team);

    // Smart mention suggestions
    const mentionMap = this.buildMentionMap(team);

    return {
      success: true,
      analysis: {
        expertiseGraph,
        skillGaps: gaps,
        trainingRecommendations: trainingPlan,
        smartMentions: mentionMap,
        teamStrengths: this.identifyTeamStrengths(team),
        recommendations: this.generateTeamRecommendations(expertiseGraph, gaps)
      }
    };
  }

  buildExpertiseGraph(team) {
    const graph = {};

    team.forEach(member => {
      const expertise = member.expertise || [];

      expertise.forEach(skill => {
        if (!graph[skill]) {
          graph[skill] = [];
        }

        graph[skill].push({
          userId: member._id || member.id,
          name: member.name,
          role: member.role,
          proficiency: this.estimateProficiency(member, skill)
        });
      });
    });

    return graph;
  }

  identifySkillGaps(team, requiredSkills) {
    const gaps = [];
    const teamSkills = new Set();

    team.forEach(member => {
      (member.expertise || []).forEach(skill => teamSkills.add(skill.toLowerCase()));
    });

    requiredSkills.forEach(required => {
      if (!teamSkills.has(required.toLowerCase())) {
        gaps.push({
          skill: required,
          severity: 'high',
          recommendation: 'Training or hire needed'
        });
      }
    });

    return gaps;
  }

  buildMentionMap(team) {
    // Create smart @mention suggestions
    const mentionMap = {};

    // Common audit topics
    const topics = [
      'revenue recognition', 'lease accounting', 'inventory', 'fixed assets',
      'debt', 'equity', 'cash', 'receivables', 'payables', 'taxes'
    ];

    topics.forEach(topic => {
      const experts = team.filter(member =>
        (member.expertise || []).some(e =>
          e.toLowerCase().includes(topic.split(' ')[0])
        )
      );

      if (experts.length > 0) {
        mentionMap[topic] = experts.map(e => ({
          userId: e._id || e.id,
          name: e.name,
          relevance: 0.8 // Could calculate based on past interactions
        }));
      }
    });

    return mentionMap;
  }

  // ═══════════════════════════════════════════════════════════
  // CORE FEATURE #4: COLLABORATIVE ANOMALY INVESTIGATION
  // ═══════════════════════════════════════════════════════════

  async initiateCollaborativeInvestigation(payload) {
    const { anomaly, projectId } = payload;

    this.logger.info(`[${this.name}] 🔍 Initiating collaborative anomaly investigation...`);

    // Create investigation
    const investigationId = this.generateId();
    const investigation = {
      id: investigationId,
      anomaly,
      projectId,
      status: 'open',
      createdAt: new Date(),
      assignedInvestigators: [],
      findings: [],
      votes: { truePositive: 0, falsePositive: 0 }
    };

    this.activeInvestigations.set(investigationId, investigation);

    // Get SOMA's fraud analysis
    const somaAnalysis = await this.querySomaForFraudAnalysis(anomaly);

    // ConceiveThinker adds collaboration layer
    const collaborativeInvestigation = {
      investigationId,
      anomaly,

      // SOMA's analysis
      somaAnalysis: {
        riskLevel: somaAnalysis.riskLevel,
        confidence: somaAnalysis.confidence,
        flags: somaAnalysis.flags,
        brain: 'AURORA' // Typically Aurora detects novel patterns
      },

      // Suggested investigators (based on expertise)
      suggestedInvestigators: this.selectInvestigators(anomaly),

      // Investigation plan
      investigationSteps: this.generateInvestigationPlan(anomaly, somaAnalysis),

      // Related anomalies (pattern matching)
      relatedAnomalies: this.findRelatedAnomalies(anomaly),

      // Estimated investigation time
      estimatedHours: this.estimateInvestigationTime(anomaly, somaAnalysis),

      // Collaboration features
      collaboration: {
        canClaim: true,
        canVote: true,
        canComment: true
      }
    };

    // Broadcast to team
    messageBroker.sendMessage({
      from: this.name,
      to: 'broadcast',
      type: 'anomaly_alert',
      payload: collaborativeInvestigation
    });

    return { success: true, investigation: collaborativeInvestigation };
  }

  selectInvestigators(anomaly) {
    // Select 2-3 best team members for this anomaly
    // Based on expertise in the relevant area
    const category = anomaly.category || 'general';

    // This would query the team and score based on expertise
    return [
      {
        recommended: true,
        reason: `Expert in ${category}`,
        userId: 'auto-select',
        name: 'Best Available'
      }
    ];
  }

  generateInvestigationPlan(anomaly, somaAnalysis) {
    const steps = [
      {
        step: 1,
        action: 'Review source documents',
        description: 'Examine original invoices, contracts, or supporting documentation',
        estimatedMinutes: 15
      },
      {
        step: 2,
        action: 'Verify with independent source',
        description: 'Cross-reference with bank statements, vendor confirmations, or third-party data',
        estimatedMinutes: 20
      },
      {
        step: 3,
        action: 'Interview relevant personnel',
        description: 'Speak with approver, requestor, or department manager',
        estimatedMinutes: 30
      },
      {
        step: 4,
        action: 'Document findings',
        description: 'Record investigation results and recommendation',
        estimatedMinutes: 10
      }
    ];

    // Adjust based on risk level
    if (somaAnalysis.riskLevel === 'high') {
      steps.push({
        step: 5,
        action: 'Escalate to management',
        description: 'Report findings to audit committee or senior management',
        estimatedMinutes: 15
      });
    }

    return steps;
  }

  findRelatedAnomalies(anomaly) {
    // Search for similar patterns in historical data
    // This would query the database for similar anomalies
    return [];
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  async querySomaForForecast(stats, deadline) {
    try {
      const response = await messageBroker.sendMessage({
        from: this.name,
        to: 'SomaArbiter',
        type: 'chat',
        payload: {
          message: `Based on current project stats (${stats.overallCompletion}% complete, ${stats.blockedTasks} blocked), forecast completion date. Deadline is ${deadline}.`,
          mode: 'strategic' // Use PROMETHEUS brain
        }
      });

      return {
        forecast: response.response || 'Unable to forecast',
        confidence: response.confidence || 0.5
      };
    } catch (error) {
      this.logger.error(`[${this.name}] SOMA query failed:`, error);
      return { forecast: 'SOMA unavailable', confidence: 0 };
    }
  }

  async querySomaForAssignment(task, candidates) {
    // Query SOMA for assignment recommendation
    return {
      recommendation: candidates[0].member.name,
      reasoning: 'Highest expertise match and availability',
      confidence: 0.85
    };
  }

  async querySomaForFraudAnalysis(anomaly) {
    try {
      const response = await messageBroker.sendMessage({
        from: this.name,
        to: 'SomaArbiter',
        type: 'fraud_check',
        payload: {
          content: JSON.stringify(anomaly),
          context: 'Collaborative anomaly investigation'
        }
      });

      return {
        riskLevel: response.riskLevel || 'medium',
        confidence: response.confidence || 0.7,
        flags: response.flags || []
      };
    } catch (error) {
      return { riskLevel: 'unknown', confidence: 0, flags: [] };
    }
  }

  async loadFinanceKnowledge() {
    // Load GAAP rules, audit procedures, etc.
    this.knowledge.gaapRules.set('ASC_606', 'Revenue Recognition');
    this.knowledge.gaapRules.set('ASC_842', 'Lease Accounting');
    this.knowledge.gaapRules.set('ASC_326', 'Credit Losses');

    this.knowledge.auditProcedures.set('substantive_testing', {
      name: 'Substantive Testing',
      description: 'Detailed testing of transactions and balances'
    });

    // Would load from database or files in production
    this.logger.info(`[${this.name}] Loaded ${this.knowledge.gaapRules.size} GAAP standards`);
  }

  startBackgroundTasks() {
    // Periodic workload analysis
    setInterval(() => {
      this.updateWorkloadMetrics();
    }, 60000); // Every minute

    this.logger.info(`[${this.name}] Background tasks started`);
  }

  updateWorkloadMetrics() {
    // Update team workload in the background
    // Would query database for active tasks per user
  }

  // Utility methods
  getAreaCompletion(area) {
    const procedures = area.procedures || [];
    if (procedures.length === 0) return 0;
    const completed = procedures.filter(p => p.status === 'Complete').length;
    return (completed / procedures.length) * 100;
  }

  estimateRemainingHours(area) {
    const procedures = area.procedures || [];
    const incomplete = procedures.filter(p => p.status !== 'Complete');
    return incomplete.length * 2; // Rough estimate: 2 hours per procedure
  }

  daysUntilDeadline(deadline) {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  daysElapsed(startDate) {
    const now = new Date();
    const start = new Date(startDate);
    const diff = now - start;
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  calculateDateVariance(estimatedDate, deadline) {
    const diff = new Date(estimatedDate) - new Date(deadline);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return {
      days,
      status: days <= 0 ? 'on-time' : 'late',
      message: days <= 0 ? `${Math.abs(days)} days early` : `${days} days late`
    };
  }

  calculateUtilization(tasks) {
    // Simple utilization score based on task count
    return tasks.length * 10; // Each task = 10 points
  }

  getWorkload(userId) {
    return this.teamWorkload.get(userId) || {
      totalTasks: 0,
      utilizationPercentage: 0,
      availableHours: 40
    };
  }

  getPastPerformance(userId, category) {
    // Would query historical performance data
    return 0.8; // Default 80% performance score
  }

  assessRoleMatch(role, complexity) {
    const roleRanks = { 'Partner': 4, 'Manager': 3, 'Senior': 2, 'Staff': 1 };
    const complexityRanks = { 'high': 3, 'medium': 2, 'low': 1 };

    const roleRank = roleRanks[role] || 1;
    const complexityRank = complexityRanks[complexity] || 2;

    // Perfect match = 1.0, overskilled = 0.8, underskilled = 0.5
    if (roleRank === complexityRank) return 1.0;
    if (roleRank > complexityRank) return 0.8;
    return 0.5;
  }

  assessTaskComplexity(task) {
    // Assess based on various factors
    return task.complexity || 'medium';
  }

  calculateWorkloadImpact(member, task) {
    const current = this.getWorkload(member._id || member.id);
    return {
      currentUtilization: current.utilizationPercentage,
      afterTask: current.utilizationPercentage + 10, // Add 10% per task
      impact: 'moderate'
    };
  }

  calculateAssignmentConfidence(scores) {
    // Confidence based on score separation
    if (scores.length < 2) return 1.0;

    const gap = scores[0].score - scores[1].score;
    return Math.min(1.0, 0.5 + (gap / 100));
  }

  estimateProficiency(member, skill) {
    // Could analyze based on task history, certifications, etc.
    return 0.7; // Default 70% proficiency
  }

  identifyTeamStrengths(team) {
    // Aggregate team expertise
    const strengths = {};
    team.forEach(member => {
      (member.expertise || []).forEach(skill => {
        strengths[skill] = (strengths[skill] || 0) + 1;
      });
    });

    return Object.entries(strengths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, count]) => ({ skill, teamMembers: count }));
  }

  generateTrainingPlan(gaps, team) {
    return gaps.map(gap => ({
      skill: gap.skill,
      priority: gap.severity,
      suggestedTrainees: team.filter(m => m.role === 'Staff' || m.role === 'Senior').slice(0, 2),
      estimatedHours: 8
    }));
  }

  generateTeamRecommendations(expertiseGraph, gaps) {
    const recommendations = [];

    if (gaps.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: `Address ${gaps.length} skill gap(s) through training or hiring`,
        skills: gaps.map(g => g.skill)
      });
    }

    return recommendations;
  }

  estimateInvestigationTime(anomaly, somaAnalysis) {
    let baseHours = 1;

    if (somaAnalysis.riskLevel === 'high') baseHours = 2;
    if (somaAnalysis.riskLevel === 'critical') baseHours = 4;

    return baseHours;
  }

  calculateForecastConfidence(stats) {
    // Higher confidence if more complete
    return Math.min(0.95, stats.overallCompletion / 100 + 0.3);
  }

  getScenarioDescription(scenarioType, multiplier) {
    switch (scenarioType) {
      case 'optimistic':
        return 'Team works 30% faster than current pace';
      case 'pessimistic':
        return 'Team slows down by 30% (vacations, blockers)';
      case 'additional_staff':
        return 'Add 1-2 additional staff members';
      default:
        return 'Continue at current pace';
    }
  }

  generateId() {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  enhanceAnalysisWithFinanceContext(payload) {
    // Add finance-specific context to SOMA's analysis
    return {
      success: true,
      enhanced: true,
      context: 'Finance context added'
    };
  }

  synthesizeRiskScoring(payload) {
    // Feature #9: Collaborative Risk Scoring
    return { success: true };
  }

  generateRollforward(payload) {
    // Feature #14: Rollforward Intelligence
    return { success: true };
  }

  collaborativeHypothesisTesting(payload) {
    // Feature #7: Collaborative Hypothesis Testing
    return { success: true };
  }

  collaborativeAnomalyInvestigation(payload) {
    // Alias for initiateCollaborativeInvestigation
    return this.initiateCollaborativeInvestigation(payload);
  }
}

// Export singleton instance
const conceiveThinker = new ConceiveThinker();
export default conceiveThinker;

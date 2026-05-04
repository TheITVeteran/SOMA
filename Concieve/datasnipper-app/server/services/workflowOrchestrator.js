const arbitersService = require('./arbitersService');
const aiAgentsService = require('../services/aiAgentsService');

class WorkflowOrchestrator {
  constructor() {
    this.activeWorkflows = new Map();
    this.workflowTemplates = new Map();
    this.setupDefaultWorkflows();
  }

  setupDefaultWorkflows() {
    // Month-End Close Workflow
    this.workflowTemplates.set('month-end-close', {
      name: 'Month-End Close',
      description: 'Automated month-end financial close process',
      steps: [
        {
          id: 'reconcile-cash',
          name: 'Cash Reconciliation',
          arbiter: 'reconciliation',
          input: 'cash_accounts',
          dependencies: []
        },
        {
          id: 'fraud-scan',
          name: 'Fraud Detection Scan',
          arbiter: 'fraud',
          input: 'monthly_transactions',
          dependencies: []
        },
        {
          id: 'journal-review',
          name: 'Journal Entry Audit',
          arbiter: 'audit',
          input: 'journal_entries',
          dependencies: []
        },
        {
          id: 'variance-analysis',
          name: 'Budget Variance Analysis', 
          arbiter: 'analysis',
          input: 'budget_actual',
          dependencies: ['reconcile-cash']
        },
        {
          id: 'executive-report',
          name: 'Generate Executive Summary',
          arbiter: 'reporting',
          input: 'all_results',
          dependencies: ['reconcile-cash', 'fraud-scan', 'journal-review', 'variance-analysis']
        }
      ],
      triggers: ['month-end', 'manual'],
      alerts: {
        on_failure: ['cfo@company.com', 'controller@company.com'],
        on_complete: ['accounting-team@company.com']
      }
    });

    // Real-time Fraud Monitoring Workflow
    this.workflowTemplates.set('continuous-fraud-monitoring', {
      name: 'Continuous Fraud Monitoring',
      description: 'Real-time transaction monitoring and fraud detection',
      steps: [
        {
          id: 'transaction-scan',
          name: 'Real-time Transaction Scan',
          arbiter: 'fraud',
          input: 'live_transactions',
          dependencies: []
        },
        {
          id: 'vendor-validation',
          name: 'Vendor Validation Check',
          arbiter: 'fraud',
          input: 'vendor_data',
          dependencies: []
        },
        {
          id: 'threshold-analysis',
          name: 'Threshold Gaming Detection',
          arbiter: 'fraud',
          input: 'approval_limits',
          dependencies: ['transaction-scan']
        },
        {
          id: 'alert-dispatch',
          name: 'Fraud Alert Dispatch',
          arbiter: 'reporting',
          input: 'fraud_findings',
          dependencies: ['transaction-scan', 'vendor-validation', 'threshold-analysis']
        }
      ],
      triggers: ['transaction-upload', 'scheduled-hourly'],
      alerts: {
        on_high_risk: ['security@company.com', 'cfo@company.com'],
        on_critical: ['all-executives@company.com']
      }
    });

    // Audit Trail Workflow
    this.workflowTemplates.set('comprehensive-audit', {
      name: 'Comprehensive Audit Trail',
      description: 'Full audit process with cross-validation',
      steps: [
        {
          id: 'sox-compliance',
          name: 'SOX Compliance Check',
          arbiter: 'audit',
          input: 'financial_data',
          dependencies: []
        },
        {
          id: 'internal-controls',
          name: 'Internal Controls Testing',
          arbiter: 'audit',
          input: 'control_data',
          dependencies: []
        },
        {
          id: 'cross-reconciliation',
          name: 'Multi-Source Reconciliation',
          arbiter: 'reconciliation',
          input: 'multiple_sources',
          dependencies: ['sox-compliance']
        },
        {
          id: 'risk-assessment',
          name: 'Risk Assessment',
          arbiter: 'analysis',
          input: 'risk_factors',
          dependencies: ['internal-controls', 'cross-reconciliation']
        },
        {
          id: 'audit-report',
          name: 'Comprehensive Audit Report',
          arbiter: 'reporting',
          input: 'audit_results',
          dependencies: ['sox-compliance', 'internal-controls', 'cross-reconciliation', 'risk-assessment']
        }
      ],
      triggers: ['quarterly', 'audit-request'],
      alerts: {
        on_violations: ['audit-committee@company.com', 'external-auditor@firm.com'],
        on_complete: ['board@company.com']
      }
    });
  }

  async executeWorkflow(workflowId, inputData = {}) {
    const template = this.workflowTemplates.get(workflowId);
    if (!template) {
      throw new Error(`Workflow template '${workflowId}' not found`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow = {
      id: executionId,
      template: workflowId,
      name: template.name,
      status: 'running',
      startTime: Date.now(),
      steps: template.steps.map(step => ({
        ...step,
        status: 'pending',
        result: null,
        error: null,
        startTime: null,
        endTime: null
      })),
      results: {},
      inputData,
      alerts: []
    };

    this.activeWorkflows.set(executionId, workflow);
    console.log(`[WORKFLOW] Starting execution: ${template.name} (ID: ${executionId})`);

    try {
      await this.executeSteps(workflow);
      workflow.status = 'completed';
      workflow.endTime = Date.now();
      
      console.log(`[WORKFLOW] Completed: ${template.name} in ${workflow.endTime - workflow.startTime}ms`);
      
      return {
        success: true,
        executionId,
        workflow: this.sanitizeWorkflowForResponse(workflow)
      };
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = Date.now();
      workflow.error = error.message;
      
      console.error(`[WORKFLOW] Failed: ${template.name} - ${error.message}`);
      
      return {
        success: false,
        executionId,
        error: error.message,
        workflow: this.sanitizeWorkflowForResponse(workflow)
      };
    }
  }

  async executeSteps(workflow) {
    const completed = new Set();
    const inProgress = new Set();
    
    while (completed.size < workflow.steps.length) {
      // Find steps ready to execute
      const ready = workflow.steps.filter(step => 
        step.status === 'pending' &&
        !inProgress.has(step.id) &&
        step.dependencies.every(dep => completed.has(dep))
      );

      if (ready.length === 0) {
        const pending = workflow.steps.filter(s => s.status === 'pending');
        if (pending.length > 0) {
          throw new Error(`Workflow deadlock detected. Pending steps: ${pending.map(s => s.id).join(', ')}`);
        }
        break;
      }

      // Execute ready steps in parallel
      const promises = ready.map(step => this.executeStep(workflow, step));
      
      for (const step of ready) {
        inProgress.add(step.id);
      }

      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        const step = ready[index];
        inProgress.delete(step.id);
        
        if (result.status === 'fulfilled') {
          step.status = 'completed';
          step.result = result.value;
          completed.add(step.id);
        } else {
          step.status = 'failed';
          step.error = result.reason.message;
          throw new Error(`Step '${step.id}' failed: ${result.reason.message}`);
        }
      });
    }
  }

  async executeStep(workflow, step) {
    console.log(`[WORKFLOW] Executing step: ${step.name}`);
    
    step.status = 'running';
    step.startTime = Date.now();
    
    try {
      let result;
      
      // Route to appropriate arbiter
      switch (step.arbiter) {
        case 'reconciliation':
          result = await this.executeReconciliationStep(workflow, step);
          break;
        case 'fraud':
          result = await this.executeFraudStep(workflow, step);
          break;
        case 'audit':
          result = await this.executeAuditStep(workflow, step);
          break;
        case 'analysis':
          result = await this.executeAnalysisStep(workflow, step);
          break;
        case 'reporting':
          result = await this.executeReportingStep(workflow, step);
          break;
        default:
          throw new Error(`Unknown arbiter: ${step.arbiter}`);
      }
      
      step.endTime = Date.now();
      workflow.results[step.id] = result;
      
      console.log(`[WORKFLOW] Completed step: ${step.name} in ${step.endTime - step.startTime}ms`);
      
      return result;
      
    } catch (error) {
      step.endTime = Date.now();
      console.error(`[WORKFLOW] Step failed: ${step.name} - ${error.message}`);
      throw error;
    }
  }

  async executeReconciliationStep(workflow, step) {
    // Get reconciliation data from workflow input or previous steps
    const internalLedger = this.getStepInput(workflow, step, 'internal_ledger') || [
      { tx_id: 'W001', amount: 5000, description: 'Monthly Revenue' },
      { tx_id: 'W002', amount: 1200, description: 'Office Rent' }
    ];
    
    const externalLedger = this.getStepInput(workflow, step, 'external_ledger') || [
      { tx_id: 'W001', amount: 5000, description: 'Monthly Revenue' },
      { tx_id: 'W002', amount: 1250, description: 'Office Rent' } // Variance!
    ];

    return await arbitersService.reconcileLedgers(internalLedger, externalLedger);
  }

  async executeFraudStep(workflow, step) {
    const invoices = this.getStepInput(workflow, step, 'invoices') || [
      { invoice_number: 'WF-001', amount: 2500, vendor: 'Office Supplies Co' },
      { invoice_number: 'WF-001', amount: 2500, vendor: 'Office Supplies Co' } // Duplicate
    ];
    
    const transactions = this.getStepInput(workflow, step, 'transactions') || [
      { id: 'WFT001', amount: 9950, approver: 'Manager A' } // Threshold gaming
    ];

    return await arbitersService.checkForFraud(invoices, transactions, []);
  }

  async executeAuditStep(workflow, step) {
    const journalEntries = this.getStepInput(workflow, step, 'journal_entries') || [
      { amount: 50000, source: 'manual', description: 'Month-end adjustment' }, // Suspicious
      { amount: 1234.56, source: 'auto', description: 'Automated accrual' }
    ];

    return await arbitersService.performAudit(journalEntries, []);
  }

  async executeAnalysisStep(workflow, step) {
    // Simulate advanced analysis
    const previousResults = Object.values(workflow.results);
    const findings = {
      total_variances: 0,
      fraud_risks: 0,
      audit_issues: 0,
      recommendation: 'Continue monitoring'
    };

    // Analyze previous step results
    previousResults.forEach(result => {
      if (result.data) {
        if (result.data.total_drift) findings.total_variances += result.data.total_drift;
        if (result.data.duplicate_invoices) findings.fraud_risks += result.data.duplicate_invoices.length;
        if (result.data.suspicious_entries) findings.audit_issues += result.data.suspicious_entries.length;
      }
    });

    if (findings.total_variances > 1000 || findings.fraud_risks > 0 || findings.audit_issues > 0) {
      findings.recommendation = 'Immediate review required';
    }

    return {
      success: true,
      data: findings,
      message: `Hello! I'm The Thinker - Analysis Arbiter. Workflow analysis complete. Found ${findings.fraud_risks} fraud risks, ${findings.audit_issues} audit issues, and $${findings.total_variances} in variances.`
    };
  }

  async executeReportingStep(workflow, step) {
    // Generate comprehensive report from all previous results
    const allResults = Object.entries(workflow.results);
    const summary = {
      execution_id: workflow.id,
      workflow_name: workflow.name,
      execution_time: Date.now() - workflow.startTime,
      steps_completed: allResults.length,
      key_findings: [],
      recommendations: [],
      risk_level: 'LOW'
    };

    // Analyze all results for key findings
    allResults.forEach(([stepId, result]) => {
      if (result.data) {
        if (result.data.total_drift > 0) {
          summary.key_findings.push(`Reconciliation variance of $${result.data.total_drift} detected`);
          summary.risk_level = 'MEDIUM';
        }
        if (result.data.duplicate_invoices && result.data.duplicate_invoices.length > 0) {
          summary.key_findings.push(`${result.data.duplicate_invoices.length} duplicate invoices found`);
          summary.risk_level = 'HIGH';
        }
        if (result.data.suspicious_entries && result.data.suspicious_entries.length > 0) {
          summary.key_findings.push(`${result.data.suspicious_entries.length} suspicious journal entries identified`);
          summary.risk_level = 'HIGH';
        }
      }
    });

    // Generate recommendations based on findings
    if (summary.key_findings.length === 0) {
      summary.recommendations.push('No significant issues detected. Continue standard monitoring.');
    } else {
      summary.recommendations.push('Review flagged items immediately');
      summary.recommendations.push('Consider enhanced controls for high-risk areas');
      if (summary.risk_level === 'HIGH') {
        summary.recommendations.push('Escalate to management and external auditors');
      }
    }

    return {
      success: true,
      data: summary,
      message: `Hello! I'm The Thinker - Reporting Arbiter. Executive summary generated. Risk level: ${summary.risk_level}. ${summary.key_findings.length} key findings identified.`
    };
  }

  getStepInput(workflow, step, inputKey) {
    // Try to get from workflow input data first
    if (workflow.inputData && workflow.inputData[inputKey]) {
      return workflow.inputData[inputKey];
    }
    
    // Try to get from previous step results
    for (const [stepId, result] of Object.entries(workflow.results)) {
      if (result.data && result.data[inputKey]) {
        return result.data[inputKey];
      }
    }
    
    return null;
  }

  sanitizeWorkflowForResponse(workflow) {
    return {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      startTime: workflow.startTime,
      endTime: workflow.endTime,
      duration: workflow.endTime ? workflow.endTime - workflow.startTime : null,
      steps: workflow.steps.map(step => ({
        id: step.id,
        name: step.name,
        status: step.status,
        arbiter: step.arbiter,
        duration: step.endTime && step.startTime ? step.endTime - step.startTime : null,
        error: step.error
      })),
      keyFindings: this.extractKeyFindings(workflow),
      riskLevel: this.calculateRiskLevel(workflow)
    };
  }

  extractKeyFindings(workflow) {
    const findings = [];
    
    Object.values(workflow.results).forEach(result => {
      if (result.data) {
        if (result.data.total_drift > 0) findings.push(`$${result.data.total_drift} reconciliation variance`);
        if (result.data.duplicate_invoices) findings.push(`${result.data.duplicate_invoices.length} duplicate invoices`);
        if (result.data.suspicious_entries) findings.push(`${result.data.suspicious_entries.length} suspicious entries`);
      }
    });
    
    return findings;
  }

  calculateRiskLevel(workflow) {
    let risk = 'LOW';
    
    Object.values(workflow.results).forEach(result => {
      if (result.data) {
        if (result.data.total_drift > 1000 || 
            (result.data.duplicate_invoices && result.data.duplicate_invoices.length > 0) ||
            (result.data.suspicious_entries && result.data.suspicious_entries.length > 2)) {
          risk = 'HIGH';
        } else if (result.data.total_drift > 100 || 
                   (result.data.suspicious_entries && result.data.suspicious_entries.length > 0)) {
          if (risk !== 'HIGH') risk = 'MEDIUM';
        }
      }
    });
    
    return risk;
  }

  getWorkflowStatus(executionId) {
    const workflow = this.activeWorkflows.get(executionId);
    if (!workflow) {
      return null;
    }
    
    return this.sanitizeWorkflowForResponse(workflow);
  }

  getAvailableWorkflows() {
    return Array.from(this.workflowTemplates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description,
      steps: template.steps.length,
      triggers: template.triggers
    }));
  }

  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values()).map(workflow => 
      this.sanitizeWorkflowForResponse(workflow)
    );
  }
}

module.exports = new WorkflowOrchestrator();
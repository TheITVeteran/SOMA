const arbitersService = require('./arbitersService');

class AnomalyDetector {
  constructor() {
    this.patterns = new Map();
    this.thresholds = {
      transaction_amount: { min: 1, max: 50000 },
      frequency_variance: 0.3, // 30% variance from normal
      time_patterns: { business_hours: [9, 17], weekend_activity: 0.1 },
      vendor_patterns: { new_vendor_limit: 5000, po_box_limit: 10000 }
    };
    
    this.learningMode = true;
    this.baselineData = {
      transaction_amounts: [],
      transaction_frequencies: [],
      time_distributions: [],
      vendor_patterns: []
    };
  }

  async analyzeTransactionPatterns(transactions) {
    const anomalies = {
      amount_anomalies: [],
      time_anomalies: [],
      frequency_anomalies: [],
      pattern_anomalies: [],
      risk_score: 0
    };

    // Amount-based anomaly detection
    const amounts = transactions.map(tx => tx.amount);
    const amountStats = this.calculateStats(amounts);
    
    transactions.forEach(tx => {
      const zScore = Math.abs((tx.amount - amountStats.mean) / amountStats.stdDev);
      
      if (zScore > 3) { // 3 standard deviations from mean
        anomalies.amount_anomalies.push({
          transaction: tx,
          z_score: zScore.toFixed(2),
          reason: 'Unusual transaction amount',
          severity: zScore > 4 ? 'HIGH' : 'MEDIUM'
        });
      }
    });

    // Time-based anomaly detection
    const timeAnomalies = this.detectTimeAnomalies(transactions);
    anomalies.time_anomalies = timeAnomalies;

    // Frequency pattern detection
    const frequencyAnomalies = this.detectFrequencyAnomalies(transactions);
    anomalies.frequency_anomalies = frequencyAnomalies;

    // Advanced pattern matching
    const patternAnomalies = await this.detectAdvancedPatterns(transactions);
    anomalies.pattern_anomalies = patternAnomalies;

    // Calculate overall risk score
    anomalies.risk_score = this.calculateRiskScore(anomalies);

    return {
      success: true,
      data: anomalies,
      message: `Hello! I'm The Thinker - Anomaly Detector. Found ${Object.values(anomalies).flat().length - 1} potential anomalies with risk score ${anomalies.risk_score}/100.`
    };
  }

  detectTimeAnomalies(transactions) {
    const anomalies = [];
    const timePattern = this.analyzeTimePatterns(transactions);
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.timestamp || Date.now());
      const hour = txDate.getHours();
      const dayOfWeek = txDate.getDay();
      
      // Weekend activity anomaly
      if ((dayOfWeek === 0 || dayOfWeek === 6) && tx.amount > 1000) {
        anomalies.push({
          transaction: tx,
          reason: 'Large transaction on weekend',
          severity: 'MEDIUM',
          time_info: { day: dayOfWeek, hour }
        });
      }
      
      // After-hours activity
      if ((hour < 7 || hour > 19) && tx.amount > 5000) {
        anomalies.push({
          transaction: tx,
          reason: 'Large transaction outside business hours',
          severity: 'MEDIUM',
          time_info: { day: dayOfWeek, hour }
        });
      }
    });
    
    return anomalies;
  }

  detectFrequencyAnomalies(transactions) {
    const anomalies = [];
    const vendorFreq = new Map();
    const amountFreq = new Map();
    
    // Analyze vendor frequencies
    transactions.forEach(tx => {
      const vendor = tx.vendor || tx.payee || 'Unknown';
      vendorFreq.set(vendor, (vendorFreq.get(vendor) || 0) + 1);
    });
    
    // Detect suspicious vendor patterns
    vendorFreq.forEach((count, vendor) => {
      const vendorTxs = transactions.filter(tx => 
        (tx.vendor || tx.payee || 'Unknown') === vendor
      );
      
      // Multiple transactions just under approval limits
      const nearLimitTxs = vendorTxs.filter(tx => 
        tx.amount > 9500 && tx.amount < 10000
      );
      
      if (nearLimitTxs.length > 1) {
        anomalies.push({
          vendor,
          transactions: nearLimitTxs,
          reason: 'Multiple transactions near approval limits',
          severity: 'HIGH',
          pattern: 'threshold_avoidance'
        });
      }
      
      // Unusual frequency spike
      if (count > 10) {
        const totalAmount = vendorTxs.reduce((sum, tx) => sum + tx.amount, 0);
        anomalies.push({
          vendor,
          transaction_count: count,
          total_amount: totalAmount,
          reason: 'Unusual frequency of transactions with vendor',
          severity: 'MEDIUM',
          pattern: 'frequency_spike'
        });
      }
    });
    
    return anomalies;
  }

  async detectAdvancedPatterns(transactions) {
    const patterns = [];
    
    // Round number bias detection
    const roundNumbers = transactions.filter(tx => 
      tx.amount % 100 === 0 && tx.amount >= 1000
    );
    
    if (roundNumbers.length > transactions.length * 0.3) {
      patterns.push({
        pattern: 'round_number_bias',
        transactions: roundNumbers.length,
        percentage: ((roundNumbers.length / transactions.length) * 100).toFixed(1),
        reason: 'Unusually high percentage of round-number transactions',
        severity: 'MEDIUM'
      });
    }
    
    // Duplicate description pattern
    const descriptions = new Map();
    transactions.forEach(tx => {
      if (tx.description) {
        const desc = tx.description.toLowerCase().trim();
        descriptions.set(desc, (descriptions.get(desc) || 0) + 1);
      }
    });
    
    descriptions.forEach((count, description) => {
      if (count > 5 && description.length > 10) {
        patterns.push({
          pattern: 'duplicate_descriptions',
          description,
          count,
          reason: 'Identical transaction descriptions may indicate automated/fraudulent activity',
          severity: count > 10 ? 'HIGH' : 'MEDIUM'
        });
      }
    });
    
    // Sequential transaction detection
    const sequentialPatterns = this.detectSequentialPatterns(transactions);
    patterns.push(...sequentialPatterns);
    
    return patterns;
  }

  detectSequentialPatterns(transactions) {
    const patterns = [];
    const sortedTx = transactions
      .filter(tx => tx.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    for (let i = 0; i < sortedTx.length - 2; i++) {
      const window = sortedTx.slice(i, i + 3);
      const amounts = window.map(tx => tx.amount);
      const times = window.map(tx => new Date(tx.timestamp).getTime());
      
      // Check for arithmetic progression in amounts
      if (this.isArithmeticProgression(amounts)) {
        patterns.push({
          pattern: 'sequential_amounts',
          transactions: window,
          reason: 'Sequential transaction amounts detected',
          severity: 'MEDIUM',
          sequence_type: 'arithmetic'
        });
      }
      
      // Check for suspiciously regular timing
      const timeDiffs = [];
      for (let j = 1; j < times.length; j++) {
        timeDiffs.push(times[j] - times[j-1]);
      }
      
      const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
      const timeDiffVariance = this.calculateVariance(timeDiffs);
      
      if (timeDiffVariance < avgTimeDiff * 0.1) { // Very regular timing
        patterns.push({
          pattern: 'regular_timing',
          transactions: window,
          reason: 'Suspiciously regular transaction timing',
          severity: 'MEDIUM',
          timing_info: {
            avg_interval: avgTimeDiff,
            variance: timeDiffVariance
          }
        });
      }
    }
    
    return patterns;
  }

  async runComprehensiveAnalysis(data) {
    const results = {
      timestamp: Date.now(),
      analysis_type: 'comprehensive_anomaly_detection',
      datasets_analyzed: Object.keys(data).length,
      total_anomalies: 0,
      risk_level: 'LOW',
      findings: {}
    };

    // Analyze transactions
    if (data.transactions && data.transactions.length > 0) {
      const txAnalysis = await this.analyzeTransactionPatterns(data.transactions);
      results.findings.transaction_anomalies = txAnalysis.data;
      results.total_anomalies += Object.values(txAnalysis.data).flat().length - 1; // Subtract risk_score
    }

    // Cross-reference with FINPOLYMER arbiters
    if (data.transactions) {
      // Run fraud detection
      const fraudCheck = await arbitersService.checkForFraud(
        data.invoices || [],
        data.transactions,
        data.vendors || []
      );
      
      if (fraudCheck.success && fraudCheck.data) {
        results.findings.fraud_patterns = fraudCheck.data;
        
        // Count fraud findings
        Object.values(fraudCheck.data).forEach(findings => {
          if (Array.isArray(findings)) {
            results.total_anomalies += findings.length;
          }
        });
      }
    }

    // Reconciliation anomalies
    if (data.internal_ledger && data.external_ledger) {
      const reconAnalysis = await arbitersService.reconcileLedgers(
        data.internal_ledger,
        data.external_ledger
      );
      
      if (reconAnalysis.success && reconAnalysis.data) {
        results.findings.reconciliation_anomalies = reconAnalysis.data;
        results.total_anomalies += (reconAnalysis.data.missing_in_external?.length || 0) +
                                  (reconAnalysis.data.missing_in_internal?.length || 0) +
                                  (reconAnalysis.data.amount_mismatches?.length || 0);
      }
    }

    // Calculate overall risk level
    results.risk_level = this.calculateOverallRisk(results);

    return {
      success: true,
      data: results,
      message: `Hello! I'm The Thinker - Anomaly Detector. Comprehensive analysis complete. Found ${results.total_anomalies} anomalies across ${results.datasets_analyzed} datasets. Risk level: ${results.risk_level}.`
    };
  }

  calculateStats(numbers) {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
    const stdDev = Math.sqrt(variance);
    
    return { mean, variance, stdDev };
  }

  calculateVariance(numbers) {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    return numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  }

  isArithmeticProgression(numbers) {
    if (numbers.length < 3) return false;
    
    const diff = numbers[1] - numbers[0];
    for (let i = 2; i < numbers.length; i++) {
      if (numbers[i] - numbers[i-1] !== diff) return false;
    }
    
    return Math.abs(diff) > 0.01; // Avoid floating point issues
  }

  analyzeTimePatterns(transactions) {
    const hourDistribution = new Array(24).fill(0);
    const dayDistribution = new Array(7).fill(0);
    
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp || Date.now());
      hourDistribution[date.getHours()]++;
      dayDistribution[date.getDay()]++;
    });
    
    return { hourDistribution, dayDistribution };
  }

  calculateRiskScore(anomalies) {
    let score = 0;
    
    // Weight different types of anomalies
    score += (anomalies.amount_anomalies?.length || 0) * 15;
    score += (anomalies.time_anomalies?.length || 0) * 10;
    score += (anomalies.frequency_anomalies?.length || 0) * 20;
    score += (anomalies.pattern_anomalies?.length || 0) * 25;
    
    // Factor in severity
    [...(anomalies.amount_anomalies || []), ...(anomalies.time_anomalies || [])].forEach(anomaly => {
      if (anomaly.severity === 'HIGH') score += 10;
      else if (anomaly.severity === 'CRITICAL') score += 25;
    });
    
    return Math.min(score, 100); // Cap at 100
  }

  calculateOverallRisk(results) {
    if (results.total_anomalies === 0) return 'LOW';
    if (results.total_anomalies > 20) return 'CRITICAL';
    if (results.total_anomalies > 10) return 'HIGH';
    if (results.total_anomalies > 5) return 'MEDIUM';
    return 'LOW';
  }

  // Machine Learning-like pattern learning (simplified)
  learnFromData(transactions) {
    if (!this.learningMode) return;
    
    // Update baseline patterns
    transactions.forEach(tx => {
      this.baselineData.transaction_amounts.push(tx.amount);
      
      if (tx.timestamp) {
        const hour = new Date(tx.timestamp).getHours();
        this.baselineData.time_distributions.push(hour);
      }
    });
    
    // Keep only recent data for learning (sliding window)
    if (this.baselineData.transaction_amounts.length > 10000) {
      this.baselineData.transaction_amounts = this.baselineData.transaction_amounts.slice(-5000);
      this.baselineData.time_distributions = this.baselineData.time_distributions.slice(-5000);
    }
    
    // Update dynamic thresholds based on learned patterns
    if (this.baselineData.transaction_amounts.length > 100) {
      const stats = this.calculateStats(this.baselineData.transaction_amounts);
      
      // Update transaction amount thresholds
      this.thresholds.transaction_amount.max = stats.mean + (3 * stats.stdDev);
      this.thresholds.transaction_amount.min = Math.max(1, stats.mean - (3 * stats.stdDev));
    }
    
    console.log(`[ANOMALY-DETECTOR] Learned from ${transactions.length} transactions. Baseline size: ${this.baselineData.transaction_amounts.length}`);
  }

  getDetectorStatus() {
    return {
      learning_mode: this.learningMode,
      baseline_size: this.baselineData.transaction_amounts.length,
      current_thresholds: this.thresholds,
      patterns_learned: this.patterns.size,
      last_analysis: this.lastAnalysis || null
    };
  }
}

module.exports = new AnomalyDetector();
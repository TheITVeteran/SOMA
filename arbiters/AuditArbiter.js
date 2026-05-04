/**
 * arbiters/AuditArbiter.js
 * 
 * SOMA Enterprise Audit Layer.
 * 
 * Orchestrates high-fidelity reconciliation (Three-Way Match) and 
 * provides a system of record for financial verification.
 */

import { BaseArbiterV4, ArbiterRole, ArbiterCapability } from './BaseArbiter.js';
import { ForensicVerdictArbiter } from './ForensicVerdictArbiter.js';
import path from 'path';

export class AuditArbiter extends BaseArbiterV4 {
    constructor(opts = {}) {
        super({
            ...opts,
            name: 'AuditArbiter',
            role: ArbiterRole.MAINTAINER,
            capabilities: [ArbiterCapability.REASONING, ArbiterCapability.KNOWLEDGE_SYNTHESIS],
        });

        this.system = opts.system;
        this.forensics = new ForensicVerdictArbiter(this.system);
        this.verificationLog = [];
    }

    async initialize() {
        this.auditLogger.success(`🏛️ [${this.name}] Audit Layer Online. Industrial-grade reconciliation active.`);
    }

    /**
     * Three-Way Match: Reconcile Purchase Order, Invoice, and Payment/GL Entry.
     */
    async performThreeWayMatch(poPath, invoicePath, glPath) {
        this.auditLogger.info(`🏛️ [Audit] Initiating Three-Way Match.`);
        
        // 1. Forensic TIE: Invoice vs GL
        const invoiceVsGL = await this.forensics.performTie(invoicePath, glPath);
        
        // 2. Forensic TIE: PO vs GL
        const poVsGL = await this.forensics.performTie(poPath, glPath);

        // 3. Synthesis: Cross-match all three
        const matchResult = {
            success: invoiceVsGL.success && poVsGL.success,
            timestamp: new Date().toISOString(),
            verdict: this._synthesizeThreeWayVerdict(invoiceVsGL, poVsGL),
            invoice_fidelity: invoiceVsGL.matching.tie_fidelity,
            po_fidelity: poVsGL.matching.tie_fidelity,
            discrepancies: [
                ...invoiceVsGL.matching.discrepancies || [],
                ...poVsGL.matching.discrepancies || []
            ],
            audit_trail: `Three-way match performed between PO: ${path.basename(poPath)}, Invoice: ${path.basename(invoicePath)}, and GL: ${path.basename(glPath)}`
        };

        this.verificationLog.push(matchResult);
        return matchResult;
    }

    _synthesizeThreeWayVerdict(inv, po) {
        const fidelity = (inv.matching.tie_fidelity + po.matching.tie_fidelity) / 2;
        if (fidelity > 0.95) return "VERIFIED - FULL HANDSHAKE";
        if (fidelity > 0.8) return "PARTIAL MATCH - HUMAN REVIEW REQUIRED";
        return "CRITICAL MISMATCH - AUDIT FAILED";
    }

    getStatus() {
        return {
            name: this.name,
            verifiedCount: this.verificationLog.length,
            latestVerdict: this.verificationLog[this.verificationLog.length - 1]?.verdict || 'None'
        };
    }
}

export default AuditArbiter;

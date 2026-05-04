const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { DatabaseManager, OrganizerAgent } = require('./auditSystem');
const ollamaService = require('./ollamaService');

class VectorStore {
  constructor(dbManager) {
    this.db = dbManager;
    this.initVectorTables();
  }

  async initVectorTables() {
    // Create tables for storing document embeddings and chunks
    const queries = [
      `CREATE TABLE IF NOT EXISTS document_chunks (
        chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id INTEGER,
        chunk_text TEXT,
        chunk_index INTEGER,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doc_id) REFERENCES documents_index(doc_id)
      )`,
      `CREATE TABLE IF NOT EXISTS chunk_embeddings (
        embedding_id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id INTEGER,
        embedding_vector TEXT,
        model_name TEXT DEFAULT 'ollama',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chunk_id) REFERENCES document_chunks(chunk_id)
      )`,
      // Full-text search index for quick retrieval
      `CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
        chunk_text, 
        metadata, 
        content=document_chunks, 
        content_rowid=chunk_id
      )`,
      // Triggers to keep FTS index updated
      `CREATE TRIGGER IF NOT EXISTS chunk_fts_insert AFTER INSERT ON document_chunks BEGIN
        INSERT INTO chunk_fts(rowid, chunk_text, metadata) 
        VALUES (new.chunk_id, new.chunk_text, new.metadata);
      END`,
      `CREATE TRIGGER IF NOT EXISTS chunk_fts_delete AFTER DELETE ON document_chunks BEGIN
        DELETE FROM chunk_fts WHERE rowid = old.chunk_id;
      END`,
      `CREATE TRIGGER IF NOT EXISTS chunk_fts_update AFTER UPDATE ON document_chunks BEGIN
        UPDATE chunk_fts SET chunk_text = new.chunk_text, metadata = new.metadata 
        WHERE rowid = new.chunk_id;
      END`
    ];

    for (const query of queries) {
      await this.db.run(query).catch(err => {
        if (!err.message.includes('already exists')) {
          console.error('Error creating table:', err);
        }
      });
    }
  }

  async storeChunk(docId, chunkText, chunkIndex, metadata = {}) {
    const result = await this.db.run(
      `INSERT INTO document_chunks (doc_id, chunk_text, chunk_index, metadata)
       VALUES (?, ?, ?, ?)`,
      [docId, chunkText, chunkIndex, JSON.stringify(metadata)]
    );
    return result.lastID;
  }

  async searchChunks(query, limit = 10) {
    // Use FTS5 for efficient full-text search
    const results = await this.db.all(
      `SELECT dc.*, di.logical_name, di.uploader
       FROM chunk_fts 
       JOIN document_chunks dc ON chunk_fts.rowid = dc.chunk_id
       JOIN documents_index di ON dc.doc_id = di.doc_id
       WHERE chunk_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      [query, limit]
    );
    return results;
  }

  async getChunksByDocId(docId) {
    return await this.db.all(
      `SELECT * FROM document_chunks WHERE doc_id = ? ORDER BY chunk_index`,
      [docId]
    );
  }

  async storeEmbedding(chunkId, embedding, modelName = 'ollama') {
    const result = await this.db.run(
      `INSERT INTO chunk_embeddings (chunk_id, embedding_vector, model_name)
       VALUES (?, ?, ?)`,
      [chunkId, JSON.stringify(embedding), modelName]
    );
    return result.lastID;
  }

  async findSimilarChunks(queryEmbedding, limit = 5) {
    // For now, use text similarity since we don't have true vector search in SQLite
    // In production, you'd use a vector database like Pinecone, Weaviate, or pgvector
    // This is a placeholder for semantic similarity
    const allChunks = await this.db.all(
      `SELECT dc.*, ce.embedding_vector 
       FROM document_chunks dc
       LEFT JOIN chunk_embeddings ce ON dc.chunk_id = ce.chunk_id
       LIMIT 100`
    );

    // Calculate cosine similarity if embeddings exist
    const scored = allChunks.map(chunk => {
      let similarity = 0;
      if (chunk.embedding_vector) {
        const embedding = JSON.parse(chunk.embedding_vector);
        similarity = this.cosineSimilarity(queryEmbedding, embedding);
      }
      return { ...chunk, similarity };
    });

    // Sort by similarity and return top results
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

class DocumentProcessor {
  constructor(vectorStore, chunkSize = 500, chunkOverlap = 50) {
    this.vectorStore = vectorStore;
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  async processDocument(docId, content, metadata = {}) {
    // Split document into chunks
    const chunks = this.splitIntoChunks(content);
    
    console.log(`Processing document ${docId}: ${chunks.length} chunks`);
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkMetadata = {
        ...metadata,
        chunk_number: i + 1,
        total_chunks: chunks.length,
        chunk_size: chunks[i].length
      };
      
      const chunkId = await this.vectorStore.storeChunk(
        docId,
        chunks[i],
        i,
        chunkMetadata
      );

      // Generate embedding using Ollama (optional - for semantic search)
      // This would require an embedding model in Ollama
      // For now, we'll rely on text search
      
      // const embedding = await this.generateEmbedding(chunks[i]);
      // await this.vectorStore.storeEmbedding(chunkId, embedding);
    }

    return chunks.length;
  }

  splitIntoChunks(text) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let wordCount = 0;
    
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      
      if (wordCount + words.length > this.chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Add overlap
        const overlapWords = currentChunk.split(/\s+/).slice(-this.chunkOverlap);
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
        wordCount = overlapWords.length + words.length;
      } else {
        currentChunk += ' ' + sentence;
        wordCount += words.length;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  async generateEmbedding(text) {
    // This would call Ollama with an embedding model
    // For now, return a mock embedding
    // In production, you'd use: ollama.embeddings({ model: 'nomic-embed-text', prompt: text })
    return Array(384).fill(0).map(() => Math.random());
  }
}

class RAGService {
  constructor(config = {}) {
    this.dbPath = config.dbPath || path.join(__dirname, '../../audit_database.db');
    this.dbManager = new DatabaseManager(this.dbPath);
    this.vectorStore = new VectorStore(this.dbManager);
    this.processor = new DocumentProcessor(this.vectorStore);
    this.contextWindow = config.contextWindow || 3; // Number of chunks to retrieve
    this.maxTokens = config.maxTokens || 2000;
  }

  async indexDocument(docId, content, metadata = {}) {
    try {
      const chunksProcessed = await this.processor.processDocument(docId, content, metadata);
      console.log(`Indexed document ${docId} with ${chunksProcessed} chunks`);
      return { success: true, chunks: chunksProcessed };
    } catch (error) {
      console.error('Error indexing document:', error);
      return { success: false, error: error.message };
    }
  }

  async query(question, projectContext = {}) {
    try {
      // Step 1: Retrieve relevant documents
      const relevantChunks = await this.retrieveContext(question);
      
      // Step 2: Build context from retrieved chunks
      const context = this.buildContext(relevantChunks);
      
      // Step 3: Generate response using Ollama with context
      const response = await this.generateResponse(question, context, projectContext);
      
      return {
        answer: response,
        sources: relevantChunks.map(chunk => ({
          document: chunk.logical_name,
          chunk: chunk.chunk_text.substring(0, 100) + '...',
          relevance: chunk.rank || chunk.similarity || 0
        })),
        context_used: context.substring(0, 500) + '...',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('RAG query error:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async retrieveContext(query) {
    // Use both keyword search and semantic search
    const keywordResults = await this.vectorStore.searchChunks(query, this.contextWindow * 2);
    
    // For semantic search, we'd generate an embedding of the query
    // and find similar chunks. For now, we'll use keyword search
    // const queryEmbedding = await this.processor.generateEmbedding(query);
    // const semanticResults = await this.vectorStore.findSimilarChunks(queryEmbedding, this.contextWindow);
    
    // Combine and deduplicate results
    const seen = new Set();
    const combined = [];
    
    for (const chunk of keywordResults) {
      if (!seen.has(chunk.chunk_id)) {
        seen.add(chunk.chunk_id);
        combined.push(chunk);
      }
    }
    
    // Return top results
    return combined.slice(0, this.contextWindow);
  }

  buildContext(chunks) {
    if (!chunks || chunks.length === 0) {
      return '';
    }
    
    let context = 'Based on the following information from your documents:\n\n';
    
    for (const chunk of chunks) {
      const metadata = JSON.parse(chunk.metadata || '{}');
      context += `[Source: ${chunk.logical_name || 'Unknown'}`;
      if (metadata.chunk_number) {
        context += `, Section ${metadata.chunk_number}/${metadata.total_chunks}`;
      }
      context += `]\n${chunk.chunk_text}\n\n`;
    }
    
    return context;
  }

  async generateResponse(question, context, projectContext) {
    const prompt = `You are an intelligent audit assistant with access to the user's documents.

${context ? `Context from documents:\n${context}\n` : ''}

Project information:
${JSON.stringify(projectContext, null, 2)}

User Question: ${question}

Please provide a comprehensive answer based on the context provided. If the context contains relevant information, cite the specific documents. If the context doesn't contain sufficient information, indicate what additional information would be helpful.

Guidelines:
1. Be specific and reference actual data from the context when available
2. Identify patterns, anomalies, or insights from the data
3. Suggest actionable next steps when appropriate
4. Maintain professional audit standards
5. If numbers or statistics are mentioned, include them in your response

Response:`;

    try {
      const response = await ollamaService.generate(prompt);
      return response;
    } catch (error) {
      // Fallback response if Ollama is not available
      if (context) {
        return `Based on your documents, here's what I found:\n\n${context.substring(0, 500)}...\n\nFor a more detailed analysis, please ensure Ollama is running.`;
      }
      return 'I need access to your documents to answer this question. Please upload relevant files or ensure the AI service is running.';
    }
  }

  async searchDocuments(query, filters = {}) {
    const chunks = await this.vectorStore.searchChunks(query, 20);
    
    // Group by document
    const documentGroups = {};
    for (const chunk of chunks) {
      if (!documentGroups[chunk.doc_id]) {
        documentGroups[chunk.doc_id] = {
          doc_id: chunk.doc_id,
          logical_name: chunk.logical_name,
          uploader: chunk.uploader,
          chunks: []
        };
      }
      documentGroups[chunk.doc_id].chunks.push({
        text: chunk.chunk_text,
        index: chunk.chunk_index
      });
    }
    
    return Object.values(documentGroups);
  }

  async getSummary(docId) {
    const chunks = await this.vectorStore.getChunksByDocId(docId);
    
    if (!chunks || chunks.length === 0) {
      return 'No content available for this document.';
    }
    
    const fullText = chunks
      .sort((a, b) => a.chunk_index - b.chunk_index)
      .map(c => c.chunk_text)
      .join('\n');
    
    const prompt = `Please provide a comprehensive summary of the following document:

${fullText.substring(0, 5000)}${fullText.length > 5000 ? '...' : ''}

Summary should include:
1. Main topics covered
2. Key findings or data points
3. Important dates or deadlines mentioned
4. Any risks or issues identified
5. Action items or recommendations

Summary:`;

    try {
      const summary = await ollamaService.generate(prompt);
      return summary;
    } catch (error) {
      return 'Summary generation failed. Please ensure Ollama is running.';
    }
  }

  async compareDocuments(docId1, docId2) {
    const chunks1 = await this.vectorStore.getChunksByDocId(docId1);
    const chunks2 = await this.vectorStore.getChunksByDocId(docId2);
    
    const text1 = chunks1.map(c => c.chunk_text).join('\n').substring(0, 2000);
    const text2 = chunks2.map(c => c.chunk_text).join('\n').substring(0, 2000);
    
    const prompt = `Compare these two documents and identify:

Document 1:
${text1}

Document 2:
${text2}

Please identify:
1. Key similarities
2. Important differences
3. Conflicting information
4. Complementary data points
5. Overall assessment

Comparison:`;

    try {
      const comparison = await ollamaService.generate(prompt);
      return comparison;
    } catch (error) {
      return 'Comparison failed. Please ensure Ollama is running.';
    }
  }

  async analyzeProject(projectId, question) {
    // Get all documents for a project and analyze them together
    const projectDocs = await this.dbManager.all(
      `SELECT DISTINCT dc.* 
       FROM document_chunks dc
       JOIN documents_index di ON dc.doc_id = di.doc_id
       WHERE di.doc_tags LIKE ?`,
      [`%project:${projectId}%`]
    );

    const context = projectDocs.map(doc => doc.chunk_text).join('\n\n').substring(0, 4000);
    
    return this.generateResponse(question, context, { projectId });
  }
}

// Integration with existing audit system
class RAGAuditIntegration {
  constructor(ragService, auditSystem) {
    this.rag = ragService;
    this.audit = auditSystem;
  }

  async processAuditDocument(filepath, metadata = {}) {
    // First, process with audit system
    const auditResult = await this.audit.parser.parseDocument(filepath);
    
    // Then, index for RAG
    if (auditResult && !auditResult.error) {
      const content = this.extractTextFromAuditResult(auditResult);
      const docId = metadata.doc_id || Date.now();
      
      await this.rag.indexDocument(docId, content, {
        ...metadata,
        audit_type: auditResult.type,
        statistics: auditResult.statistics
      });
      
      return {
        audit: auditResult,
        rag_indexed: true,
        doc_id: docId
      };
    }
    
    return {
      audit: auditResult,
      rag_indexed: false,
      error: auditResult.error
    };
  }

  extractTextFromAuditResult(result) {
    let text = '';
    
    if (result.type === 'csv' || result.type === 'excel') {
      // Convert transactions to text
      if (result.transactions) {
        text += 'Transactions:\n';
        result.transactions.forEach(t => {
          text += `Date: ${t.date}, Amount: ${t.amount}, Vendor: ${t.vendor}, Description: ${t.description}\n`;
        });
      }
      
      // Add statistics
      if (result.statistics) {
        text += '\nStatistics:\n' + JSON.stringify(result.statistics, null, 2);
      }
    } else if (result.type === 'pdf') {
      text = result.text || '';
      if (result.extractedData) {
        text += '\n\nExtracted Data:\n' + result.extractedData;
      }
    }
    
    // Add metadata
    if (result.metadata) {
      text += '\n\nMetadata:\n' + JSON.stringify(result.metadata, null, 2);
    }
    
    return text;
  }

  async queryWithAuditContext(question, sessionId) {
    // Get audit session data
    const session = await this.audit.dbManager.get(
      'SELECT * FROM audit_sessions WHERE session_id = ?',
      [sessionId]
    );
    
    const findings = await this.audit.dbManager.all(
      'SELECT * FROM findings WHERE session_id = ?',
      [sessionId]
    );
    
    // Build audit context
    let auditContext = '';
    if (session) {
      auditContext += `Audit Session: ${sessionId}\n`;
      auditContext += `Risk Score: ${session.risk_score}\n`;
      auditContext += `Files Processed: ${session.files_processed}\n`;
      auditContext += `Total Transactions: ${session.total_transactions}\n\n`;
    }
    
    if (findings && findings.length > 0) {
      auditContext += 'Key Findings:\n';
      findings.forEach(f => {
        auditContext += `- ${f.type}: ${f.description} (Severity: ${f.severity})\n`;
      });
    }
    
    // Query RAG with audit context
    const ragResult = await this.rag.query(question, { 
      audit_session: sessionId,
      audit_context: auditContext 
    });
    
    return {
      ...ragResult,
      audit_session: sessionId,
      findings_count: findings.length
    };
  }
}

module.exports = {
  VectorStore,
  DocumentProcessor,
  RAGService,
  RAGAuditIntegration
};
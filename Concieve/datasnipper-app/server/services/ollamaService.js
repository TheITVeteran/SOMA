const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434/api';
    this.model = 'tinyllama'; // Smaller, faster model for lower-end hardware
  }

  // Generate a response from Ollama
  async generate(prompt, context = '') {
    try {
      const response = await axios.post(`${this.baseURL}/generate`, {
        model: this.model,
        prompt: context ? `${context}\n\n${prompt}` : prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_predict: 500, // Limit response length for faster processing
          stop: ['\n\n\n', 'END'] // Stop tokens to prevent overly long responses
        }
      }, {
        timeout: 30000 // 30 second timeout for generation
      });
      
      return response.data.response;
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw error;
    }
  }

  // Chat with Ollama (maintains conversation history)
  async chat(messages) {
    try {
      const response = await axios.post(`${this.baseURL}/chat`, {
        model: this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      });
      
      return response.data.message.content;
    } catch (error) {
      console.error('Ollama chat error:', error);
      throw error;
    }
  }

  // AI Agent specific methods
  async parseDocument(documentContent, documentType) {
    const prompt = `You are a document parsing AI agent. Extract and structure the key information from the following ${documentType} document:

${documentContent}

Please provide:
1. A summary of the document
2. Key data points and figures
3. Important dates mentioned
4. Any financial amounts or metrics
5. Notable entities (people, companies, etc.)

Format your response in a clear, structured manner.`;

    return this.generate(prompt);
  }

  async analyzeData(data, analysisType) {
    const prompt = `You are a data analysis AI agent specialized in ${analysisType}. Analyze the following data:

${JSON.stringify(data, null, 2)}

Please provide:
1. Key patterns or trends identified
2. Any anomalies or outliers
3. Statistical insights
4. Recommendations based on the analysis
5. Risk factors if any

Be specific and actionable in your analysis.`;

    return this.generate(prompt);
  }

  async crossLinkDocuments(doc1, doc2, linkType) {
    const prompt = `You are a document cross-linking AI agent. Find connections between these documents:

Document 1:
${doc1}

Document 2:
${doc2}

Link Type: ${linkType}

Please identify:
1. Common references or entities
2. Related transactions or events
3. Matching data points
4. Discrepancies that need attention
5. Suggested linking points

Focus on accuracy and relevance.`;

    return this.generate(prompt);
  }

  async summarizeProject(projectData) {
    const prompt = `You are a summarization AI agent. Create an executive summary for this project:

Project: ${projectData.name}
Status: ${projectData.status}
Progress: ${projectData.progress}%
Team Size: ${projectData.members}
Documents: ${projectData.files}

Recent Activities:
${JSON.stringify(projectData.recentActivities || [], null, 2)}

Please provide:
1. Executive summary (2-3 sentences)
2. Key achievements
3. Current challenges
4. Next steps
5. Risk assessment

Keep it concise and actionable.`;

    return this.generate(prompt);
  }

  async reviewCompliance(data, complianceType) {
    const prompt = `You are a compliance review AI agent. Review the following for ${complianceType} compliance:

${JSON.stringify(data, null, 2)}

Please identify:
1. Compliance status (Compliant/Non-compliant/Needs Review)
2. Any violations or missing requirements
3. Specific items that need attention
4. Recommendations for compliance
5. Priority level of issues found

Be thorough and specific.`;

    return this.generate(prompt);
  }

  async assistWithQuery(query, projectContext) {
    const prompt = `You are an AI assistant for an audit and accounting collaboration platform. 

Project Context:
${JSON.stringify(projectContext, null, 2)}

User Query: ${query}

Please provide a helpful, specific response that:
1. Directly addresses the user's question
2. References relevant project information if applicable
3. Suggests actionable next steps
4. Is concise and professional

Focus on being helpful and accurate.`;

    return this.generate(prompt);
  }

  // Orchestrator that routes queries to appropriate agents
  async orchestrate(query, projectData) {
    // First try to get context from RAG if available
    let ragContext = '';
    try {
      const { RAGService } = require('./ragSystem');
      const ragService = new RAGService();
      const ragResult = await ragService.query(query, projectData);
      if (ragResult.answer && !ragResult.error) {
        // Return RAG-enhanced response directly
        return {
          query,
          agents: ['RAG-Enhanced Assistant'],
          responses: [{ agent: 'RAG-Enhanced Assistant', response: ragResult.answer }],
          sources: ragResult.sources,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      // RAG not available, continue with normal orchestration
      console.log('RAG not available, using standard orchestration');
    }

    // Determine which agent(s) to use based on the query
    const queryLower = query.toLowerCase();
    let agentResponses = [];

    try {
      if (queryLower.includes('parse') || queryLower.includes('extract')) {
        const response = await this.parseDocument(query, 'general');
        agentResponses.push({ agent: 'Parser', response });
      }
      
      if (queryLower.includes('analyze') || queryLower.includes('trend') || queryLower.includes('anomal')) {
        const response = await this.analyzeData(projectData, 'financial');
        agentResponses.push({ agent: 'Analyzer', response });
      }
      
      if (queryLower.includes('link') || queryLower.includes('match') || queryLower.includes('reconcil')) {
        const response = await this.crossLinkDocuments('', '', 'general');
        agentResponses.push({ agent: 'CrossLink', response });
      }
      
      if (queryLower.includes('summar') || queryLower.includes('report')) {
        const response = await this.summarizeProject(projectData);
        agentResponses.push({ agent: 'Summarizer', response });
      }
      
      if (queryLower.includes('compliance') || queryLower.includes('review') || queryLower.includes('audit')) {
        const response = await this.reviewCompliance(projectData, 'audit');
        agentResponses.push({ agent: 'Reviewer', response });
      }
      
      // If no specific agent matched, use the assistant
      if (agentResponses.length === 0) {
        const response = await this.assistWithQuery(query, projectData);
        agentResponses.push({ agent: 'Assistant', response });
      }
      
      return {
        query,
        agents: agentResponses.map(r => r.agent),
        responses: agentResponses,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Orchestration error:', error);
      return {
        query,
        agents: ['Fallback'],
        responses: [{
          agent: 'The Thinker',
          response: `I encountered an error processing your request. ${error.message.includes('timeout') ? 'The AI service is taking too long. Try a simpler query or check if Ollama is running properly.' : 'Please try again or check if Ollama is running on localhost:11434.'}`
        }],
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new OllamaService();
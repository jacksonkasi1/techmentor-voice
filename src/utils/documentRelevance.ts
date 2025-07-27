// utils/documentRelevance.ts
interface DocumentChunk {
  content: string;
  relevanceScore: number;
  source: string;
}

export function scoreDocumentRelevance(query: string, documentation: string): DocumentChunk[] {
  if (!documentation || !query) return [];

  // Split documentation into logical chunks
  const chunks = splitIntoChunks(documentation);
  
  // Score each chunk for relevance
  const scoredChunks = chunks.map(chunk => ({
    content: chunk,
    relevanceScore: calculateRelevanceScore(query, chunk),
    source: 'context7_mcp'
  }));

  // Sort by relevance score (highest first)
  return scoredChunks
    .filter(chunk => chunk.relevanceScore > 0.1) // Minimum relevance threshold
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3); // Return top 3 chunks
}

function splitIntoChunks(text: string): string[] {
  // Split by code blocks first
  const codeBlockPattern = /```[\s\S]*?```/g;
  const codeBlocks = text.match(codeBlockPattern) || [];
  
  // Remove code blocks temporarily
  const textWithoutCode = text.replace(codeBlockPattern, '|||CODE_BLOCK|||');
  
  // Split by sentences and paragraphs
  const sentences = textWithoutCode
    .split(/\n{2,}|\. (?=[A-Z])/)
    .filter(s => s.trim().length > 50); // Minimum chunk size
  
  // Restore code blocks
  let codeBlockIndex = 0;
  const chunks = sentences.map(sentence => {
    if (sentence.includes('|||CODE_BLOCK|||')) {
      return sentence.replace('|||CODE_BLOCK|||', codeBlocks[codeBlockIndex++] || '');
    }
    return sentence;
  });

  return chunks.filter(chunk => chunk.trim().length > 0);
}

function calculateRelevanceScore(query: string, chunk: string): number {
  const queryTerms = extractKeyTerms(query);
  const chunkTerms = extractKeyTerms(chunk);
  
  let score = 0;
  const totalTerms = queryTerms.length;
  
  for (const term of queryTerms) {
    // Exact match gets highest score
    if (chunkTerms.includes(term)) {
      score += 1.0;
    }
    // Partial match gets lower score
    else if (chunkTerms.some(chunkTerm => 
      chunkTerm.includes(term) || term.includes(chunkTerm)
    )) {
      score += 0.5;
    }
  }
  
  // Bonus for code examples if query seems technical
  if (isTechnicalQuery(query) && hasCodeExample(chunk)) {
    score += 0.3;
  }
  
  // Normalize score
  return totalTerms > 0 ? score / totalTerms : 0;
}

function extractKeyTerms(text: string): string[] {
  // Extract meaningful terms, prioritizing technical keywords
  const technicalPatterns = [
    /\b[a-zA-Z][a-zA-Z0-9]*\(\)/g, // Function calls
    /\b[A-Z][a-zA-Z0-9]*Component\b/g, // React components  
    /\b(useState|useEffect|useContext|props|state)\b/g, // React terms
    /\b(async|await|Promise|fetch|API)\b/g, // Async terms
    /\b\w+\.\w+\b/g // Method calls
  ];
  
  const terms = new Set<string>();
  
  // Extract technical patterns first
  for (const pattern of technicalPatterns) {
    const matches = text.match(pattern) || [];
    matches.forEach(match => terms.add(match.toLowerCase()));
  }
  
  // Extract regular important words
  const words = text.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !isStopWord(word) &&
      !isCommonWord(word)
    )
    .slice(0, 10); // Limit terms
  
  words.forEach(word => terms.add(word));
  
  return Array.from(terms);
}

function isTechnicalQuery(query: string): boolean {
  const technicalIndicators = [
    'code', 'function', 'component', 'api', 'implementation',
    'example', 'syntax', 'method', 'class', 'interface'
  ];
  
  return technicalIndicators.some(indicator => 
    query.toLowerCase().includes(indicator)
  );
}

function hasCodeExample(chunk: string): boolean {
  return /```|function|const|let|var|class|interface|import|export/.test(chunk);
}

function isStopWord(word: string): boolean {
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
  return stopWords.includes(word);
}

function isCommonWord(word: string): boolean {
  const commonWords = ['use', 'get', 'set', 'make', 'take', 'see', 'look', 'find', 'know', 'think', 'say', 'tell', 'ask', 'try', 'want', 'need', 'work', 'help'];
  return commonWords.includes(word);
}

// Modified MCP context function to use relevance scoring
export async function getMostRelevantContext(query: string, documentation: string): Promise<string> {
  if (!documentation) return '';
  
  const relevantChunks = scoreDocumentRelevance(query, documentation);
  
  if (relevantChunks.length === 0) {
    // Fallback to first 500 chars if no relevant chunks found
    return documentation.substring(0, 500);
  }
  
  // Return the highest scoring chunk only
  return relevantChunks[0].content;
}
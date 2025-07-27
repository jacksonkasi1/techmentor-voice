export interface VoiceQueryRequest {
  query: string;
  timestamp: number;
}

export interface VoiceQueryResponse {
  success: boolean;
  response: string;
  queryCorrection?: {
    original: string;
    corrected: string;
  };
  context?: {
    libraries: string[];
    hasDocumentation: boolean;
  };
  processingTime?: number;
  timestamp?: string;
  fallback?: boolean;
}

export interface MCPSearchResult {
  documentation: string;
  libraries: string[];
}

export interface ProcessingContext {
  query: string;
  correctedQuery: string;
  documentation: string;
  libraries: string[];
  isConversational: boolean;
}

export const CONVERSATIONAL_PHRASES = [
  'hello', 'hi', 'hey', 'can you hear me', 'test', 'testing',
  'how are you', 'are you there', 'are you working', 'am i audible'
];

export const MCP_ENDPOINT = 'https://mcp.context7.com/mcp';
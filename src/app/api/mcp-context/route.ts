import { NextRequest, NextResponse } from 'next/server';

interface MCPRequest {
  query: string;
}

interface MCPLibraryResult {
  id: string;
  name: string;
  version?: string;
  description?: string;
  documentation?: string;
  examples?: string[];
}

interface MCPContextResponse {
  context?: string;
  libraries?: string[];
  documentation?: string;
  examples?: string[];
}

// Context7 MCP Remote Endpoint
const MCP_ENDPOINT = 'https://mcp.context7.com/mcp';

export async function POST(request: NextRequest) {
  try {
    const { query }: MCPRequest = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching MCP context for query: "${query}"`);

    // Step 1: Resolve library IDs from the query
    const libraryIds = await resolveLibraryIds(query);
    
    if (libraryIds.length === 0) {
      // No specific libraries detected, return general programming context
      return NextResponse.json({
        context: `General programming query: "${query}". No specific libraries detected.`,
        libraries: [],
        documentation: null,
        examples: []
      });
    }

    // Step 2: Get documentation for detected libraries
    const libraryDocs = await Promise.all(
      libraryIds.map(libId => getLibraryDocumentation(libId, query))
    );

    // Step 3: Combine and format the context
    const validDocs = libraryDocs.filter(doc => doc !== null) as MCPLibraryResult[];
    
    const combinedContext = formatMCPContext(query, validDocs);

    return NextResponse.json({
      context: combinedContext,
      libraries: validDocs.map(doc => doc.name),
      documentation: validDocs.map(doc => doc.documentation).join('\n\n'),
      examples: validDocs.flatMap(doc => doc.examples || [])
    });

  } catch (error) {
    console.error('MCP context error:', error);
    
    // Return a graceful fallback instead of throwing
    return NextResponse.json({
      context: `Programming query: "${(await request.json()).query}". Context retrieval temporarily unavailable.`,
      libraries: [],
      documentation: null,
      examples: []
    });
  }
}

async function resolveLibraryIds(query: string): Promise<string[]> {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'resolve-library-id',
          arguments: {
            query: query
          }
        }
      })
    });

    if (!response.ok) {
      console.warn(`MCP resolve-library-id failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.result?.content) {
      // Parse the library IDs from the response
      const content = Array.isArray(data.result.content) 
        ? data.result.content[0]?.text || ''
        : data.result.content;
      
      // Extract library IDs (format may vary)
      const libraryIds = extractLibraryIds(content, query);
      console.log(`Detected libraries: ${libraryIds.join(', ')}`);
      return libraryIds;
    }

    return [];
  } catch (error) {
    console.warn('Library ID resolution failed:', error);
    return fallbackLibraryDetection(query);
  }
}

async function getLibraryDocumentation(libraryId: string, query: string): Promise<MCPLibraryResult | null> {
  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get-library-docs',
          arguments: {
            library_id: libraryId,
            query: query
          }
        }
      })
    });

    if (!response.ok) {
      console.warn(`MCP get-library-docs failed for ${libraryId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.result?.content) {
      const content = Array.isArray(data.result.content) 
        ? data.result.content[0]?.text || ''
        : data.result.content;

      return {
        id: libraryId,
        name: libraryId,
        documentation: content,
        examples: extractCodeExamples(content)
      };
    }

    return null;
  } catch (error) {
    console.warn(`Documentation retrieval failed for ${libraryId}:`, error);
    return null;
  }
}

function extractLibraryIds(content: string, query: string): string[] {
  const libraries: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Common web development libraries
  const webLibraries = [
    'next.js', 'nextjs', 'react', 'typescript', 'javascript', 'node.js', 'nodejs',
    'express', 'tailwind', 'tailwindcss', 'prisma', 'mongodb', 'postgresql',
    'cloudflare', 'vercel', 'supabase', 'firebase'
  ];

  // AI/ML libraries
  const aiLibraries = [
    'openai', 'anthropic', 'langchain', 'transformers', 'tensorflow', 
    'pytorch', 'scikit-learn', 'pandas', 'numpy'
  ];

  // Python libraries
  const pythonLibraries = [
    'python', 'django', 'flask', 'fastapi', 'pydantic', 'requests',
    'asyncio', 'sqlalchemy', 'pytest'
  ];

  const allLibraries = [...webLibraries, ...aiLibraries, ...pythonLibraries];

  for (const lib of allLibraries) {
    if (lowerQuery.includes(lib.toLowerCase()) || content.toLowerCase().includes(lib.toLowerCase())) {
      libraries.push(lib);
    }
  }

  return [...new Set(libraries)]; // Remove duplicates
}

function fallbackLibraryDetection(query: string): string[] {
  // Simple keyword-based detection as fallback
  const lowerQuery = query.toLowerCase();
  const detected: string[] = [];

  if (lowerQuery.includes('next') || lowerQuery.includes('react')) detected.push('next.js');
  if (lowerQuery.includes('typescript') || lowerQuery.includes('ts')) detected.push('typescript');
  if (lowerQuery.includes('python') || lowerQuery.includes('py')) detected.push('python');
  if (lowerQuery.includes('javascript') || lowerQuery.includes('js')) detected.push('javascript');
  if (lowerQuery.includes('cloudflare')) detected.push('cloudflare');
  if (lowerQuery.includes('tailwind')) detected.push('tailwindcss');

  return detected;
}

function extractCodeExamples(content: string): string[] {
  const examples: string[] = [];
  
  // Extract code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = content.match(codeBlockRegex);
  
  if (matches) {
    examples.push(...matches.map(match => match.replace(/```\w*\n?/g, '').trim()));
  }

  return examples;
}

function formatMCPContext(query: string, docs: MCPLibraryResult[]): string {
  if (docs.length === 0) {
    return `Query: "${query}". No specific documentation found.`;
  }

  let context = `Query: "${query}"\n\nRelevant Documentation:\n\n`;
  
  for (const doc of docs) {
    context += `## ${doc.name}\n`;
    if (doc.documentation) {
      context += `${doc.documentation}\n\n`;
    }
    if (doc.examples && doc.examples.length > 0) {
      context += `### Examples:\n${doc.examples.join('\n\n')}\n\n`;
    }
  }

  return context;
}

export async function GET() {
  return NextResponse.json({
    service: 'Context7 MCP Integration',
    status: 'running',
    endpoint: MCP_ENDPOINT,
    capabilities: ['resolve-library-id', 'get-library-docs'],
    timestamp: new Date().toISOString()
  });
}
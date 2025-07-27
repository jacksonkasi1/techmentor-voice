import { NextRequest, NextResponse } from 'next/server';

interface MCPRequest {
  query: string;
}

// Context7 MCP Remote Endpoint
const MCP_ENDPOINT = 'https://mcp.context7.com/mcp';

export async function POST(request: NextRequest) {
  console.log('📚 MCP Context API called');
  
  try {
    const { query }: MCPRequest = await request.json();

    if (!query || !query.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching MCP context for query: "${query}"`);

    // Step 1: Resolve library IDs from the query with timeout
    const libraryIds = await resolveLibraryIds(query);
    console.log('📖 Detected libraries:', libraryIds);
    
    if (libraryIds.length === 0) {
      // Return helpful response even without specific libraries detected
      const generalContext = generateGeneralContext(query);
      return NextResponse.json({
        context: generalContext,
        libraries: [],
        documentation: null,
        examples: []
      });
    }

    // Step 2: Get documentation for detected libraries (with error handling)
    const libraryDocs = await Promise.allSettled(
      libraryIds.map(libId => getLibraryDocumentation(libId, query))
    );

    // Process results, filtering out failures
    const validDocs = libraryDocs
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    console.log(`✅ Retrieved docs for ${validDocs.length}/${libraryIds.length} libraries`);

    // Step 3: Format the context
    const combinedContext = formatMCPContext(query, validDocs);

    return NextResponse.json({
      context: combinedContext,
      libraries: validDocs.map(doc => doc.name),
      documentation: validDocs.map(doc => doc.documentation).join('\n\n'),
      examples: validDocs.flatMap(doc => doc.examples || [])
    });

  } catch (error) {
    console.error('❌ MCP context error:', error);
    
    // Return graceful fallback instead of failing
    const query = (await request.json().catch(() => ({ query: 'unknown' }))).query;
    
    return NextResponse.json({
      context: `Programming query: "${query}". Unable to fetch live documentation at the moment, but I can still help with general programming concepts and best practices.`,
      libraries: [],
      documentation: null,
      examples: [],
      error: 'MCP service temporarily unavailable'
    });
  }
}

async function resolveLibraryIds(query: string): Promise<string[]> {
  try {
    console.log('🔍 Resolving library IDs...');
    
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
      }),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`⚠️ MCP resolve-library-id failed: ${response.status}`);
      return fallbackLibraryDetection(query);
    }

    const data = await response.json();
    
    if (data.result?.content) {
      const content = Array.isArray(data.result.content) 
        ? data.result.content[0]?.text || ''
        : data.result.content;
      
      const libraryIds = extractLibraryIds(content, query);
      console.log(`📚 Detected libraries from MCP: ${libraryIds.join(', ')}`);
      return libraryIds;
    }

    return fallbackLibraryDetection(query);
  } catch (error) {
    console.warn('⚠️ Library ID resolution failed:', error);
    return fallbackLibraryDetection(query);
  }
}

async function getLibraryDocumentation(libraryId: string, query: string): Promise<any | null> {
  try {
    console.log(`📖 Getting documentation for: ${libraryId}`);
    
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
      }),
      // Timeout for individual doc requests
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`⚠️ MCP get-library-docs failed for ${libraryId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.result?.content) {
      const content = Array.isArray(data.result.content) 
        ? data.result.content[0]?.text || ''
        : data.result.content;

      console.log(`✅ Got documentation for ${libraryId} (${content.length} chars)`);

      return {
        id: libraryId,
        name: libraryId,
        documentation: content,
        examples: extractCodeExamples(content)
      };
    }

    return null;
  } catch (error) {
    console.warn(`⚠️ Documentation retrieval failed for ${libraryId}:`, error);
    return null;
  }
}

function fallbackLibraryDetection(query: string): string[] {
  console.log('🔄 Using fallback library detection...');
  const lowerQuery = query.toLowerCase();
  const detected: string[] = [];

  // Common web development libraries
  const detectionRules = [
    { keywords: ['next.js', 'nextjs', 'next'], library: 'next.js' },
    { keywords: ['react'], library: 'react' },
    { keywords: ['typescript', 'ts'], library: 'typescript' },
    { keywords: ['javascript', 'js'], library: 'javascript' },
    { keywords: ['python', 'py'], library: 'python' },
    { keywords: ['node.js', 'nodejs', 'node'], library: 'nodejs' },
    { keywords: ['express'], library: 'express' },
    { keywords: ['tailwind', 'tailwindcss'], library: 'tailwindcss' },
    { keywords: ['prisma'], library: 'prisma' },
    { keywords: ['mongodb', 'mongo'], library: 'mongodb' },
    { keywords: ['postgresql', 'postgres'], library: 'postgresql' },
    { keywords: ['cloudflare'], library: 'cloudflare' },
    { keywords: ['vercel'], library: 'vercel' },
    { keywords: ['supabase'], library: 'supabase' },
    { keywords: ['firebase'], library: 'firebase' },
    { keywords: ['openai'], library: 'openai' },
    { keywords: ['anthropic'], library: 'anthropic' },
    { keywords: ['langchain'], library: 'langchain' }
  ];

  for (const rule of detectionRules) {
    if (rule.keywords.some(keyword => lowerQuery.includes(keyword))) {
      detected.push(rule.library);
    }
  }

  const uniqueDetected = [...new Set(detected)];
  console.log(`🎯 Fallback detected: ${uniqueDetected.join(', ')}`);
  return uniqueDetected;
}

function extractLibraryIds(content: string, query: string): string[] {
  const libraries: string[] = [];
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Extract from content and query
  const allText = `${lowerContent} ${lowerQuery}`;
  
  // Web development libraries
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
    if (allText.includes(lib.toLowerCase())) {
      libraries.push(lib);
    }
  }

  return [...new Set(libraries)];
}

function extractCodeExamples(content: string): string[] {
  const examples: string[] = [];
  
  // Extract code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = content.match(codeBlockRegex);
  
  if (matches) {
    examples.push(...matches.map(match => match.replace(/```\w*\n?/g, '').trim()));
  }

  // Extract inline code if no code blocks found
  if (examples.length === 0) {
    const inlineCodeRegex = /`([^`]+)`/g;
    const inlineMatches = content.match(inlineCodeRegex);
    if (inlineMatches) {
      examples.push(...inlineMatches.slice(0, 3)); // Limit to first 3
    }
  }

  return examples;
}

function formatMCPContext(query: string, docs: any[]): string {
  if (docs.length === 0) {
    return generateGeneralContext(query);
  }

  let context = `Query: "${query}"\n\nRelevant Documentation:\n\n`;
  
  for (const doc of docs) {
    context += `## ${doc.name}\n`;
    if (doc.documentation) {
      // Limit documentation length to prevent huge contexts
      const truncatedDoc = doc.documentation.length > 1000 
        ? doc.documentation.substring(0, 1000) + '...'
        : doc.documentation;
      context += `${truncatedDoc}\n\n`;
    }
    if (doc.examples && doc.examples.length > 0) {
      context += `### Examples:\n${doc.examples[0]}\n\n`; // Just first example
    }
  }

  return context;
}

function generateGeneralContext(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('next.js') || lowerQuery.includes('nextjs')) {
    return `Query: "${query}"\n\nGeneral Next.js Context:\nNext.js is a React framework for production with features like server-side rendering, static site generation, API routes, and automatic code splitting. Common patterns include using pages router or app router, getServerSideProps, getStaticProps, and API routes for backend functionality.`;
  }
  
  if (lowerQuery.includes('react')) {
    return `Query: "${query}"\n\nGeneral React Context:\nReact is a JavaScript library for building user interfaces with components, hooks, and state management. Key concepts include JSX, useState, useEffect, props, component lifecycle, and modern patterns like custom hooks and context API.`;
  }
  
  if (lowerQuery.includes('typescript')) {
    return `Query: "${query}"\n\nGeneral TypeScript Context:\nTypeScript adds static typing to JavaScript with features like interfaces, types, generics, and better IDE support. Common patterns include defining interfaces for props, using union types, generic functions, and proper type annotations for better code safety.`;
  }
  
  return `Query: "${query}"\n\nGeneral Programming Context:\nThis appears to be a programming-related question. Common best practices include writing clean, readable code, following SOLID principles, proper error handling, testing, and using version control.`;
}

export async function GET() {
  return NextResponse.json({
    service: 'Context7 MCP Integration',
    status: 'running',
    endpoint: MCP_ENDPOINT,
    capabilities: ['resolve-library-id', 'get-library-docs'],
    fallback: 'Intelligent fallback when MCP unavailable',
    timeout: '5 seconds per request',
    timestamp: new Date().toISOString()
  });
}
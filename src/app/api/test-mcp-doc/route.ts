import { NextResponse } from 'next/server';

const CONTEXT7_MCP = 'https://mcp.context7.com/mcp';

export async function GET() {
  const results: any = { timestamp: new Date().toISOString(), libraries: [], docs: [], debug: {} };
  
  try {
    // 1. Search for libraries
    const searchRes = await fetch(CONTEXT7_MCP, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0', 
        id: 1, 
        method: 'tools/call',
        params: { 
          name: 'resolve-library-id', 
          arguments: { 
            libraryName: 'better-auth'
          }
        }
      })
    });
    
    const searchText = await searchRes.text();
    
    // Parse SSE response
    let searchData;
    if (searchText.includes('data: ')) {
      const dataLines = searchText.split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.substring(6).trim())
        .filter(line => line && line !== '[DONE]');
      
      if (dataLines.length > 0) {
        searchData = JSON.parse(dataLines[dataLines.length - 1]);
      }
    } else {
      searchData = JSON.parse(searchText);
    }
    
    const content = searchData?.result?.content?.[0]?.text || '';
    
    // Parse libraries from content
    if (content) {
      const sections = content.split(/[-]{5,}/).filter((s: string) => s.trim());
      
      results.libraries = sections.map((section: string) => {
        const lines = section.split('\n').map(l => l.trim()).filter(l => l);
        
        const getField = (fieldNames: string[]) => {
          for (const fieldName of fieldNames) {
            const line = lines.find(l => l.toLowerCase().includes(fieldName.toLowerCase()));
            if (line && line.includes(':')) {
              return line.split(':').slice(1).join(':').trim();
            }
          }
          return '';
        };
        
        const lib = {
          id: getField(['Context7-compatible library ID', 'library ID', 'ID']),
          name: getField(['Title', 'Name', 'Library']),
          desc: getField(['Description', 'Summary']),
          snippets: parseInt(getField(['Code Snippets', 'Snippets']) || '0'),
          trust: parseFloat(getField(['Trust Score', 'Score']) || '0')
        };
        
        return lib;
      })
      .filter((lib: any) => 
        lib.id && 
        lib.id.length > 0 && 
        !lib.id.includes('format:') &&
        lib.id.startsWith('/')
      )
      .sort((a: any, b: any) => b.trust - a.trust)
      .slice(0, 5);
    }
    
    // Fetch docs for each library with the correct parameter name
    for (const lib of results.libraries) {
      try {
        const docRes = await fetch(CONTEXT7_MCP, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0', 
            id: Date.now(), 
            method: 'tools/call',
            params: { 
              name: 'get-library-docs', 
              arguments: { 
                context7CompatibleLibraryID: lib.id,  // Correct parameter name!
                tokens: 20000,  // Request more tokens for fuller documentation
                topic: ''  // No specific topic filter
              }
            }
          })
        });
        
        const docText = await docRes.text();
        
        let docData;
        if (docText.includes('data: ')) {
          const dataLines = docText.split('\n')
            .filter(line => line.startsWith('data: '))
            .map(line => line.substring(6).trim())
            .filter(line => line && line !== '[DONE]');
          
          if (dataLines.length > 0) {
            docData = JSON.parse(dataLines[dataLines.length - 1]);
          }
        } else {
          docData = JSON.parse(docText);
        }
        
        const docContent = docData?.result?.content?.[0]?.text || '';
        
        results.docs.push({
          library: lib.name,
          id: lib.id,
          content: docContent.substring(0, 5000), // First 5k chars
          length: docContent.length,
          success: !!docContent && !docData?.error,
          hasContent: docContent.length > 100,
          preview: docContent.substring(0, 300),
          // Extract some metadata from the content
          sections: docContent.split('\n\n').filter((s: string) => s.startsWith('#')).slice(0, 5)
        });
        
      } catch (e) {
        results.docs.push({ 
          library: lib.name, 
          id: lib.id, 
          content: '', 
          length: 0, 
          success: false, 
          error: String(e) 
        });
      }
    }
    
    // Also try a specific library if you want to test
    if (results.libraries.length === 0) {
      // Try with a known library
      try {
        const testRes = await fetch(CONTEXT7_MCP, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0', 
            id: 9999, 
            method: 'tools/call',
            params: { 
              name: 'get-library-docs', 
              arguments: { 
                context7CompatibleLibraryID: '/upstash/docs',  // Known library from earlier
                tokens: 10000
              }
            }
          })
        });
        
        const testText = await testRes.text();
        results.debug.directTest = {
          status: testRes.status,
          preview: testText.substring(0, 500)
        };
      } catch (e) {
        results.debug.directTestError = String(e);
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        librariesFound: results.libraries.length,
        docsSuccess: results.docs.filter((d: any) => d.success && d.hasContent).length,
        totalDocLength: results.docs.reduce((sum: number, d: any) => sum + d.length, 0),
        averageDocLength: results.docs.length > 0 
          ? Math.round(results.docs.reduce((sum: number, d: any) => sum + d.length, 0) / results.docs.length)
          : 0
      },
      ...results
    });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error), 
      stack: (error as Error).stack,
      ...results 
    });
  }
}
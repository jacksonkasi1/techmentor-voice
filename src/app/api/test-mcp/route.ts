import { NextResponse } from 'next/server';

const CONTEXT7_MCP = 'https://mcp.context7.com/mcp';

export async function GET() {
  const results: any = { timestamp: new Date().toISOString(), libraries: [], docs: [], debug: {} };
  
  try {
    // 1. Search for libraries with proper headers
    const searchRes = await fetch(CONTEXT7_MCP, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream' // This is what was missing!
      },
      body: JSON.stringify({
        jsonrpc: '2.0', 
        id: 1, 
        method: 'tools/call',
        params: { 
          name: 'resolve-library-id', 
          arguments: { 
            libraryName: 'upstash' // Let's try upstash first
          }
        }
      })
    });
    
    const searchText = await searchRes.text();
    results.debug.rawResponse = searchText.substring(0, 1000); // Store more for debugging
    results.debug.statusCode = searchRes.status;
    results.debug.headers = Object.fromEntries(searchRes.headers.entries());
    
    // Parse the response
    let searchData;
    try {
      if (searchText.includes('data: ')) {
        // Handle SSE format - extract all data lines
        const dataLines = searchText.split('\n')
          .filter(line => line.startsWith('data: '))
          .map(line => line.substring(6).trim())
          .filter(line => line && line !== '[DONE]');
        
        // Parse the last complete data line
        if (dataLines.length > 0) {
          searchData = JSON.parse(dataLines[dataLines.length - 1]);
        }
      } else {
        searchData = JSON.parse(searchText);
      }
    } catch (parseError) {
      results.debug.parseError = String(parseError);
      // Try to extract any JSON from the response
      const jsonMatch = searchText.match(/\{.*\}/s);
      if (jsonMatch) {
        try {
          searchData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          results.debug.secondParseError = String(e);
        }
      }
    }
    
    results.debug.parsedData = searchData;
    
    // Extract the actual content
    const content = searchData?.result?.content?.[0]?.text || 
                   searchData?.content?.[0]?.text || 
                   '';
    
    results.debug.contentLength = content.length;
    results.debug.contentPreview = content.substring(0, 500);
    
    // If we got content, parse the libraries
    if (content) {
      // Split by separator and filter out empty sections
      const sections = content.split(/[-]{5,}/).filter((s: string) => s.trim());
      
      results.libraries = sections.map((section: string) => {
        const lines = section.split('\n').map(l => l.trim()).filter(l => l);
        
        // Helper to extract field values
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
          trust: parseFloat(getField(['Trust Score', 'Score']) || '0'),
          raw: section.substring(0, 200) // Store raw for debugging
        };
        
        return lib;
      }).filter((lib: any) => lib.id && lib.id.length > 0);
      
      // Sort by trust score
      results.libraries.sort((a: any, b: any) => b.trust - a.trust);
    }
    
    // If we found libraries, try to get docs for the first one
    if (results.libraries.length > 0) {
      const firstLib = results.libraries[0];
      
      try {
        const docRes = await fetch(CONTEXT7_MCP, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0', 
            id: 2, 
            method: 'tools/call',
            params: { 
              name: 'get-library-docs', 
              arguments: { 
                libraryId: firstLib.id 
              }
            }
          })
        });
        
        const docText = await docRes.text();
        let docData;
        
        try {
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
        } catch (e) {
          results.debug.docParseError = String(e);
        }
        
        const docContent = docData?.result?.content?.[0]?.text || 
                          docData?.content?.[0]?.text || 
                          '';
        
        results.docs.push({
          library: firstLib.name,
          id: firstLib.id,
          content: docContent.substring(0, 2000),
          length: docContent.length,
          success: !!docContent
        });
      } catch (e) {
        results.debug.docFetchError = String(e);
      }
    }
    
    // Also try searching for "better-auth" as originally intended
    if (results.libraries.length === 0 || true) { // Always try this for comparison
      try {
        const betterAuthRes = await fetch(CONTEXT7_MCP, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0', 
            id: 3, 
            method: 'tools/call',
            params: { 
              name: 'resolve-library-id', 
              arguments: { 
                libraryName: 'better-auth'
              }
            }
          })
        });
        
        const betterAuthText = await betterAuthRes.text();
        results.debug.betterAuthSearch = {
          status: betterAuthRes.status,
          preview: betterAuthText.substring(0, 500)
        };
      } catch (e) {
        results.debug.betterAuthError = String(e);
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        librariesFound: results.libraries.length,
        docsSuccess: results.docs.filter((d: any) => d.success).length,
        totalDocLength: results.docs.reduce((sum: number, d: any) => sum + d.length, 0)
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
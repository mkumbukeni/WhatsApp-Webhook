// check-tables.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = process.env.AIRTABLE_API_KEY || '';
  const baseId = process.env.AIRTABLE_PRODUCTS_BASE_ID || '';
  
  console.log('🔍 Checking Airtable tables...');
  console.log('API Key exists:', !!apiKey);
  console.log('Base ID exists:', !!baseId);
  console.log('Base ID:', baseId);
  
  // Test 1: Check if we can access the base metadata
  let baseInfo = { success: false, error: '', tables: [] as string[] };
  try {
    console.log('Testing base access...');
    const baseResponse = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (baseResponse.ok) {
      const data = await baseResponse.json();
      baseInfo = {
        success: true,
        tables: data.tables?.map((t: any) => t.name) || [],
        error: ''
      };
      console.log('✅ Base accessible. Tables found:', baseInfo.tables);
    } else {
      const errorText = await baseResponse.text();
      baseInfo = {
        success: false,
        tables: [],
        error: `Status ${baseResponse.status}: ${errorText}`
      };
      console.log('❌ Base access failed:', baseInfo.error);
    }
  } catch (error) {
    baseInfo = {
      success: false,
      tables: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    console.log('❌ Base access error:', baseInfo.error);
  }
  
  // Test 2: Check specific table names
  const tablesToTest = [
    // Exact names we expect
    'Categories',
    'ShopOwners', 
    'Products',
    // Common variations
    'Category',
    'categories',
    'category',
    'Shops',
    'Shop Owners',
    'Shop',
    'Product',
    'products',
    'product',
    'Items',
    // With spaces
    'Product Categories',
    'Shop Owners',
    'Product Listings'
  ];
  
  const results: Record<string, any> = {};
  
  for (const tableName of tablesToTest) {
    try {
      console.log(`Testing table: "${tableName}"`);
      const encodedName = encodeURIComponent(tableName);
      const response = await fetch(
        `https://api.airtable.com/v0/${baseId}/${encodedName}?maxRecords=1`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      results[tableName] = {
        status: response.status,
        statusText: response.statusText,
        accessible: response.status === 200 || response.status === 422,
        tested: true
      };
      
      if (response.status === 200) {
        const data = await response.json();
        results[tableName].recordCount = data.records?.length || 0;
        if (data.records?.[0]?.fields) {
          results[tableName].sampleFields = Object.keys(data.records[0].fields);
        }
      } else if (response.status !== 404) {
        results[tableName].error = await response.text().catch(() => '');
      }
      
      console.log(`  "${tableName}": ${response.status} ${response.statusText}`);
      
    } catch (error) {
      results[tableName] = {
        error: error instanceof Error ? error.message : 'Unknown error',
        tested: true,
        accessible: false
      };
      console.log(`  "${tableName}": ERROR - ${results[tableName].error}`);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Find accessible tables
  const accessibleTables = Object.entries(results)
    .filter(([_, result]) => result.accessible)
    .map(([name, result]) => ({ 
      name, 
      status: result.status,
      recordCount: result.recordCount || 0
    }));
  
  const responseData = {
    environment: {
      apiKeyConfigured: !!apiKey,
      baseIdConfigured: !!baseId,
      baseId: baseId,
      baseIdFormat: baseId.startsWith('app') ? '✅ Correct' : '❌ Should start with "app"',
      apiKeyFormat: apiKey.startsWith('pat') ? '✅ Correct' : '❌ Should start with "pat"'
    },
    baseAccess: baseInfo,
    tableTests: results,
    accessibleTables,
    summary: {
      totalTablesTested: tablesToTest.length,
      accessibleTablesFound: accessibleTables.length,
      tablesFromMetadata: baseInfo.tables.length
    },
    nextSteps: accessibleTables.length > 0 
      ? `✅ Found ${accessibleTables.length} tables. Use these names in airtable.ts: ${accessibleTables.map(t => `"${t.name}"`).join(', ')}`
      : '❌ No accessible tables found. Create tables in Airtable named exactly: "Categories", "ShopOwners", "Products"'
  };
  
  console.log('✅ Check complete. Accessible tables:', accessibleTables);
  
  return NextResponse.json(responseData);
}
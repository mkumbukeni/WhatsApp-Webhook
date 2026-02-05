// airtable.ts - UPDATED WITH PROPER LINKED RECORD HANDLING AND SHOP/DISTRICT/AREA INFO
import { ProductCategory, ShopOwner, Product, AirtableResponse, Order } from './types';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_PRODUCTS_BASE_ID || '';

console.log('🔧 Airtable Config:', {
  hasApiKey: !!AIRTABLE_API_KEY,
  hasBaseId: !!AIRTABLE_BASE_ID,
  baseIdLength: AIRTABLE_BASE_ID.length,
  baseIdStartsWithApp: AIRTABLE_BASE_ID.startsWith('app'),
  apiKeyStartsWithPat: AIRTABLE_API_KEY.startsWith('pat')
});

// Helper function to fetch Airtable data with proper typing
async function fetchAirtableData<T>(tableName: string, params?: Record<string, string>): Promise<T[]> {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.error('❌ Airtable configuration missing');
      return [];
    }

    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableName}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    console.log(`📥 Fetching from Airtable: ${tableName}`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Airtable error (${response.status}) for ${tableName}:`, errorText);
      return [];
    }

    const data = await response.json() as AirtableResponse<T>;
    
    console.log(`✅ Fetched ${data.records.length} records from ${tableName}`);
    
    // Map records to include Airtable's internal ID as a separate property
    return data.records.map(record => ({
      ...record.fields,
      _airtableId: record.id,
    })) as T[];
  } catch (error) {
    console.error(`❌ Error fetching ${tableName}:`, error);
    return [];
  }
}

// Helper function to fetch shop owner by Airtable ID
async function fetchShopOwnerByAirtableId(airtableId: string): Promise<ShopOwner | null> {
  try {
    console.log(`🔍 Fetching shop owner by Airtable ID: ${airtableId}`);
    
    const shopOwners = await fetchAirtableData<ShopOwner & { _airtableId?: string }>('ShopOwners', {
      filterByFormula: `RECORD_ID() = '${airtableId}'`
    });
    
    if (shopOwners.length > 0) {
      const shopOwner = shopOwners[0];
      console.log(`✅ Found shop owner: ${shopOwner.name} (ID: ${shopOwner.id})`);
      return shopOwner;
    }
    
    console.log(`❌ No shop owner found with Airtable ID: ${airtableId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching shop owner by Airtable ID ${airtableId}:`, error);
    return null;
  }
}

// Helper function to fetch category by ID
async function fetchCategoryById(categoryId: string): Promise<ProductCategory | null> {
  try {
    const categories = await fetchAirtableData<ProductCategory>('Categories', {
      filterByFormula: `{id} = '${categoryId}'`
    });
    
    if (categories.length > 0) {
      return categories[0];
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
    return null;
  }
}

// PRODUCT FUNCTIONS
export async function testAirtableConnection(): Promise<boolean> {
  try {
    const categories = await fetchCategories();
    console.log(`🔌 Airtable connection test: ${categories.length} categories found`);
    return categories.length > 0;
  } catch (error) {
    console.error('❌ Airtable connection test failed:', error);
    return false;
  }
}

export async function fetchCategories(): Promise<ProductCategory[]> {
  return fetchAirtableData<ProductCategory>('Categories');
}

// NEW: Get districts for a specific category
export async function fetchDistrictsByCategory(categoryId: string): Promise<string[]> {
  try {
    const categories = await fetchCategories();
    
    // Get the specific category first
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      console.error(`❌ Category not found: ${categoryId}`);
      return [];
    }
    
    // If category has its own district, return it
    if (category.district) {
      return [category.district];
    }
    
    // Otherwise get all districts that have this category
    const districts = categories
      .filter(cat => cat.id === categoryId && cat.district)
      .map(cat => cat.district)
      .filter((district): district is string => !!district && district.trim() !== '')
      .filter((district, index, self) => self.indexOf(district) === index); // Unique districts
    
    console.log(`✅ Found ${districts.length} districts for category ${categoryId}`);
    return districts;
  } catch (error) {
    console.error(`❌ Error fetching districts for category ${categoryId}:`, error);
    return [];
  }
}

// NEW: Get shops by category and district
export async function fetchShopsByCategoryAndDistrict(categoryId: string, district: string): Promise<ShopOwner[]> {
  try {
    console.log(`🔍 Fetching shops for category ${categoryId} in district ${district}`);
    
    // First, get all categories in this district
    const categoriesInDistrict = await fetchAirtableData<ProductCategory>('Categories', {
      filterByFormula: `AND({district} = '${district}', {id} = '${categoryId}')`
    });
    
    if (categoriesInDistrict.length === 0) {
      console.log(`⚠️ No categories found in ${district} with ID ${categoryId}`);
      return [];
    }
    
    // Get shop owners for this category (using categoryId field in ShopOwners)
    const shopOwners = await fetchAirtableData<ShopOwner>('ShopOwners', {
      filterByFormula: `{categoryId} = '${categoryId}'`
    });
    
    // Filter shops by district (check if their category has the right district)
    const filteredShops = shopOwners.filter(shop => {
      // The shop's category should be in the right district
      return categoriesInDistrict.some(cat => cat.id === shop.categoryId);
    });
    
    console.log(`✅ Found ${filteredShops.length} shops for category ${categoryId} in ${district}`);
    return filteredShops;
  } catch (error) {
    console.error(`❌ Error fetching shops for category ${categoryId} in district ${district}:`, error);
    return [];
  }
}

// NEW: Search shops by name (within a category)
export async function searchShopsByName(categoryId: string, shopName: string): Promise<ShopOwner[]> {
  try {
    console.log(`🔍 Searching shops with name "${shopName}" in category ${categoryId}`);
    
    const shops = await fetchAirtableData<ShopOwner>('ShopOwners', {
      filterByFormula: `AND({categoryId} = '${categoryId}', SEARCH(LOWER("${shopName.toLowerCase()}"), LOWER({name})))`
    });
    
    console.log(`✅ Found ${shops.length} shops matching "${shopName}"`);
    return shops;
  } catch (error) {
    console.error(`❌ Error searching shops by name:`, error);
    return [];
  }
}

// UPDATED: Get products by shop with pagination and shop info
export async function fetchProductsByShop(shopId: string, page: number = 1, pageSize: number = 5): Promise<{products: Product[], totalPages: number, totalProducts: number}> {
  try {
    console.log(`🔍 Fetching products for shop ${shopId}, page ${page}, pageSize ${pageSize}`);
    
    // Get all products for this shop
    const products = await fetchProductsByShopOwner(shopId);
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = products.slice(startIndex, endIndex);
    const totalPages = Math.ceil(products.length / pageSize);
    
    console.log(`✅ Found ${products.length} total products, showing ${paginatedProducts.length} on page ${page}/${totalPages}`);
    
    return {
      products: paginatedProducts,
      totalPages,
      totalProducts: products.length
    };
  } catch (error) {
    console.error(`❌ Error fetching products by shop with pagination:`, error);
    return {
      products: [],
      totalPages: 0,
      totalProducts: 0
    };
  }
}

// NEW: Search products by name within a shop
export async function searchProductsInShop(shopId: string, productName: string): Promise<Product[]> {
  try {
    console.log(`🔍 Searching products with name "${productName}" in shop ${shopId}`);
    
    const allProducts = await fetchProductsByShopOwner(shopId);
    
    const filteredProducts = allProducts.filter(product => 
      product.name.toLowerCase().includes(productName.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(productName.toLowerCase()))
    );
    
    console.log(`✅ Found ${filteredProducts.length} products matching "${productName}" in shop ${shopId}`);
    return filteredProducts;
  } catch (error) {
    console.error(`❌ Error searching products in shop:`, error);
    return [];
  }
}

// Existing functions (keep them as they are)
export async function fetchDistricts(): Promise<string[]> {
  try {
    const categories = await fetchCategories();
    const districts = categories
      .map(cat => cat.district)
      .filter((district): district is string => !!district && district.trim() !== '')
      .filter((district, index, self) => self.indexOf(district) === index);
    
    console.log(`✅ Found ${districts.length} unique districts`);
    return districts;
  } catch (error) {
    console.error('❌ Error fetching districts:', error);
    return [];
  }
}

export async function fetchAreasByDistrict(district: string): Promise<string[]> {
  try {
    const categories = await fetchCategories();
    const areas = categories
      .filter(cat => cat.district === district && cat.location)
      .map(cat => cat.location)
      .filter((location): location is string => !!location && location.trim() !== '')
      .filter((location, index, self) => self.indexOf(location) === index);
    
    console.log(`✅ Found ${areas.length} areas in ${district}`);
    return areas;
  } catch (error) {
    console.error(`❌ Error fetching areas for ${district}:`, error);
    return [];
  }
}

export async function fetchCategoriesByDistrict(district: string): Promise<ProductCategory[]> {
  return fetchAirtableData<ProductCategory>('Categories', {
    filterByFormula: `{district} = '${district}'`
  });
}

export async function fetchCategoriesByDistrictAndArea(district: string, area: string): Promise<ProductCategory[]> {
  return fetchAirtableData<ProductCategory>('Categories', {
    filterByFormula: `AND({district} = '${district}', {location} = '${area}')`
  });
}

export async function fetchShopOwnersByCategory(categoryId: string): Promise<ShopOwner[]> {
  return fetchAirtableData<ShopOwner>('ShopOwners', {
    filterByFormula: `{categoryId} = '${categoryId}'`
  });
}

// UPDATED: Better product fetching by shop owner with linked records
export async function fetchProductsByShopOwner(shopOwnerId: string): Promise<Product[]> {
  console.log(`🔍 Fetching products for shop owner ID: ${shopOwnerId}`);
  
  try {
    // First, try to find shop owner by custom ID (the "id" field)
    const shopOwners = await fetchAirtableData<ShopOwner & { _airtableId?: string }>('ShopOwners', {
      filterByFormula: `{id} = '${shopOwnerId}'`
    });
    
    let shopAirtableId: string | null = null;
    let shopName = 'Unknown Shop';
    let shopPhone = 'Not available';
    let categoryId = '';
    
    if (shopOwners.length === 0) {
      console.error(`❌ No shop owner found with custom ID: ${shopOwnerId}`);
      
      // Try alternative: search by phone number
      const shopOwnersByPhone = await fetchAirtableData<ShopOwner & { _airtableId?: string }>('ShopOwners', {
        filterByFormula: `{phone} = '${shopOwnerId}'`
      });
      
      if (shopOwnersByPhone.length === 0) {
        console.error(`❌ No shop owner found with phone either: ${shopOwnerId}`);
        return [];
      }
      
      const shopOwner = shopOwnersByPhone[0];
      shopAirtableId = shopOwner._airtableId || '';
      shopName = shopOwner.name;
      shopPhone = shopOwner.phone;
      categoryId = shopOwner.categoryId;
    } else {
      const shopOwner = shopOwners[0];
      shopAirtableId = shopOwner._airtableId || '';
      shopName = shopOwner.name;
      shopPhone = shopOwner.phone;
      categoryId = shopOwner.categoryId;
    }
    
    if (!shopAirtableId) {
      console.error(`❌ No Airtable ID found for shop owner: ${shopOwnerId}`);
      return [];
    }
    
    console.log(`✅ Found shop owner: ${shopName}, Airtable ID: ${shopAirtableId}`);
    
    // Fetch products linked to this shop owner using the linked record field
    const productsData = await fetchAirtableData<{
      id: string;
      name: string;
      shopOwnerId: string[];
      description: string;
      price: number;
      currency: string;
      images: string[];
      inStock: boolean;
      specifications?: string;
      rating?: number;
      reviewCount?: number;
      tags?: string[];
      createdDate?: string;
      featured?: boolean;
      _airtableId?: string;
    }>('Products', {
      filterByFormula: `FIND('${shopAirtableId}', ARRAYJOIN({shopOwnerId})) > 0`
    });
    
    // Get district and area from category
    let districtInfo = '';
    let areaInfo = '';
    
    if (categoryId) {
      try {
        const categories = await fetchAirtableData<ProductCategory>('Categories', {
          filterByFormula: `{id} = '${categoryId}'`
        });
        
        if (categories.length > 0) {
          districtInfo = categories[0].district || '';
          areaInfo = categories[0].location || '';
        }
      } catch (categoryError) {
        console.error(`Error fetching category ${categoryId}:`, categoryError);
      }
    }
    
    // Convert to Product format with shop info
    const products: Product[] = productsData.map(productData => ({
      id: productData.id,
      name: productData.name,
      shopOwnerId: shopOwnerId,
      description: productData.description || '',
      price: productData.price || 0,
      currency: productData.currency || 'MWK',
      images: Array.isArray(productData.images) ? productData.images : [],
      inStock: productData.inStock !== false,
      specifications: productData.specifications || '',
      rating: productData.rating,
      reviewCount: productData.reviewCount,
      tags: productData.tags,
      createdDate: productData.createdDate,
      featured: productData.featured,
      shopName: shopName,
      shopPhone: shopPhone,
      district: districtInfo,
      location: areaInfo
    }));
    
    console.log(`✅ Found ${products.length} products for shop owner ${shopName}`);
    return products;
  } catch (error) {
    console.error(`❌ Error fetching products for shop owner ${shopOwnerId}:`, error);
    return [];
  }
}

// UPDATED: Enhanced search with proper linked record handling
export async function searchProducts(query: string, district?: string, area?: string): Promise<Product[]> {
  console.log(`🔍 Searching for: "${query}"${district ? ` in ${district}` : ''}${area ? `, ${area}` : ''}`);
  
  try {
    let formula = '';
    
    if (district && area) {
      // Search with district and area
      formula = `AND(
        OR(
          SEARCH(LOWER("${query.toLowerCase()}"), LOWER({name})),
          SEARCH(LOWER("${query.toLowerCase()}"), LOWER({description})),
          SEARCH(LOWER("${query.toLowerCase()}"), LOWER({specifications}))
        ),
        {district} = '${district}',
        {location} = '${area}'
      )`;
    } else if (district) {
      // Search with district only
      formula = `AND(
        OR(
          SEARCH(LOWER("${query.toLowerCase()}"), LOWER({name})),
          SEARCH(LOWER("${query.toLowerCase()}"), LOWER({description})),
          SEARCH(LOWER("${query.toLowerCase()}"), LOWER({specifications}))
        ),
        {district} = '${district}'
      )`;
    } else {
      // General search
      formula = `OR(
        SEARCH(LOWER("${query.toLowerCase()}"), LOWER({name})),
        SEARCH(LOWER("${query.toLowerCase()}"), LOWER({description})),
        SEARCH(LOWER("${query.toLowerCase()}"), LOWER({specifications}))
      )`;
    }
    
    console.log(`🔍 Search formula: ${formula}`);
    
    // Fetch products with shopOwnerId as linked records
    const productsData = await fetchAirtableData<{
      id: string;
      name: string;
      shopOwnerId: string[]; // This is now an array of linked record IDs
      description: string;
      price: number;
      currency: string;
      images: string[];
      inStock: boolean;
      specifications?: string;
      rating?: number;
      reviewCount?: number;
      tags?: string[];
      createdDate?: string;
      featured?: boolean;
      _airtableId?: string;
    }>('Products', {
      filterByFormula: formula
    });
    
    console.log(`✅ Search found ${productsData.length} products`);
    
    // Enrich products with shop, district, and area information
    const enrichedProducts = await Promise.all(
      productsData.map(async (productData) => {
        try {
          let shopName = 'Unknown Shop';
          let shopPhone = 'Not available';
          let districtInfo = '';
          let areaInfo = '';
          
          // Get shop owner information from linked records
          if (productData.shopOwnerId && productData.shopOwnerId.length > 0) {
            // The shopOwnerId field contains Airtable record IDs
            const shopAirtableIds = productData.shopOwnerId;
            
            // Fetch shop owners using their Airtable IDs
            const shopOwnerPromises = shopAirtableIds.map(async (shopId: string) => {
              try {
                // Fetch shop owner by Airtable ID
                const shopOwners = await fetchAirtableData<ShopOwner & { _airtableId?: string }>('ShopOwners', {
                  filterByFormula: `RECORD_ID() = '${shopId}'`
                });
                
                return shopOwners.length > 0 ? shopOwners[0] : null;
              } catch (error) {
                console.error(`Error fetching shop ${shopId}:`, error);
                return null;
              }
            });
            
            const shopOwners = await Promise.all(shopOwnerPromises);
            const validShopOwners = shopOwners.filter((shop): shop is ShopOwner => shop !== null);
            
            if (validShopOwners.length > 0) {
              const shopOwner = validShopOwners[0];
              shopName = shopOwner.name;
              shopPhone = shopOwner.phone;
              
              // Get category information for district and area
              if (shopOwner.categoryId) {
                try {
                  const categories = await fetchAirtableData<ProductCategory>('Categories', {
                    filterByFormula: `{id} = '${shopOwner.categoryId}'`
                  });
                  
                  if (categories.length > 0) {
                    districtInfo = categories[0].district || '';
                    areaInfo = categories[0].location || '';
                  }
                } catch (categoryError) {
                  console.error(`Error fetching category ${shopOwner.categoryId}:`, categoryError);
                }
              }
            }
          }
          
          return {
            id: productData.id,
            name: productData.name,
            shopOwnerId: productData.shopOwnerId?.[0] || '',
            description: productData.description || '',
            price: productData.price || 0,
            currency: productData.currency || 'MWK',
            images: Array.isArray(productData.images) ? productData.images : [],
            inStock: productData.inStock !== false,
            specifications: productData.specifications || '',
            rating: productData.rating,
            reviewCount: productData.reviewCount,
            tags: productData.tags,
            createdDate: productData.createdDate,
            featured: productData.featured,
            shopName: shopName,
            shopPhone: shopPhone,
            district: districtInfo,
            location: areaInfo
          } as Product;
          
        } catch (error) {
          console.error(`Error enriching product ${productData.id}:`, error);
          return {
            id: productData.id,
            name: productData.name,
            shopOwnerId: productData.shopOwnerId?.[0] || '',
            description: productData.description || '',
            price: productData.price || 0,
            currency: productData.currency || 'MWK',
            images: Array.isArray(productData.images) ? productData.images : [],
            inStock: productData.inStock !== false,
            specifications: productData.specifications || '',
            rating: productData.rating,
            reviewCount: productData.reviewCount,
            tags: productData.tags,
            createdDate: productData.createdDate,
            featured: productData.featured,
            shopName: 'Shop info not available',
            shopPhone: 'Not available',
            district: '',
            location: ''
          } as Product;
        }
      })
    );
    
    return enrichedProducts;
  } catch (error) {
    console.error(`❌ Error searching for "${query}":`, error);
    return [];
  }
}

// NEW: Search products by location
export async function searchProductsByLocation(district: string, area?: string): Promise<Product[]> {
  console.log(`📍 Searching products in ${district}${area ? `, ${area}` : ''}`);
  
  try {
    let formula = '';
    
    if (area) {
      // Get categories in specific district and area
      const categories = await fetchCategoriesByDistrictAndArea(district, area);
      const categoryIds = categories.map(cat => cat.id);
      
      if (categoryIds.length === 0) {
        console.log(`⚠️ No categories found in ${district}, ${area}`);
        return [];
      }
      
      // Get shop owners in these categories
      const shopOwnerPromises = categoryIds.map(catId => fetchShopOwnersByCategory(catId));
      const shopOwnerArrays = await Promise.all(shopOwnerPromises);
      const shopOwners = shopOwnerArrays.flat();
      const shopOwnerIds = shopOwners.map(shop => shop.id);
      
      if (shopOwnerIds.length === 0) {
        console.log(`⚠️ No shop owners found in ${district}, ${area}`);
        return [];
      }
      
      // Get products from these shop owners
      const productPromises = shopOwnerIds.map(shopId => fetchProductsByShopOwner(shopId));
      const productArrays = await Promise.all(productPromises);
      const allProducts = productArrays.flat();
      
      // Remove duplicates
      const uniqueProducts = allProducts.filter((product, index, self) =>
        index === self.findIndex(p => p.id === product.id)
      );
      
      console.log(`✅ Found ${uniqueProducts.length} products in ${district}, ${area}`);
      return uniqueProducts;
    } else {
      // Get all categories in district
      const categories = await fetchCategoriesByDistrict(district);
      const categoryIds = categories.map(cat => cat.id);
      
      if (categoryIds.length === 0) {
        console.log(`⚠️ No categories found in ${district}`);
        return [];
      }
      
      // Get shop owners in these categories
      const shopOwnerPromises = categoryIds.map(catId => fetchShopOwnersByCategory(catId));
      const shopOwnerArrays = await Promise.all(shopOwnerPromises);
      const shopOwners = shopOwnerArrays.flat();
      const shopOwnerIds = shopOwners.map(shop => shop.id);
      
      if (shopOwnerIds.length === 0) {
        console.log(`⚠️ No shop owners found in ${district}`);
        return [];
      }
      
      // Get products from these shop owners
      const productPromises = shopOwnerIds.map(shopId => fetchProductsByShopOwner(shopId));
      const productArrays = await Promise.all(productPromises);
      const allProducts = productArrays.flat();
      
      // Remove duplicates
      const uniqueProducts = allProducts.filter((product, index, self) =>
        index === self.findIndex(p => p.id === product.id)
      );
      
      console.log(`✅ Found ${uniqueProducts.length} products in ${district}`);
      return uniqueProducts;
    }
  } catch (error) {
    console.error(`❌ Error searching products by location:`, error);
    return [];
  }
}

// Validate URL
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// FIX: Proper Airtable attachment format
function createAirtableAttachment(url: string): { url: string } {
  return { url: url.trim() };
}

// CREATE PRODUCT FUNCTION - FIXED
export async function createProduct(product: Product): Promise<boolean> {
  try {
    console.log("🎯 Creating product with data:", {
      name: product.name,
      price: product.price,
      shopOwnerPhone: product.shopOwnerId,
      imageCount: product.images?.length || 0
    });

    // Find shop owner by phone number
    const shopOwners = await fetchAirtableData<ShopOwner & { _airtableId?: string }>('ShopOwners', {
      filterByFormula: `{phone} = '${product.shopOwnerId}'`
    });
    
    console.log(`🔍 Found ${shopOwners.length} shop owners with phone: ${product.shopOwnerId}`);
    
    let shopOwnerAirtableId: string;
    let shopOwnerCustomId: string;
    
    if (shopOwners.length === 0) {
      console.log("🆕 Creating new shop owner...");
      const result = await createShopOwnerFromPhone(product.shopOwnerId, product.categoryId);
      if (!result) {
        console.error("❌ Failed to create shop owner");
        return false;
      }
      shopOwnerAirtableId = result.airtableId;
      shopOwnerCustomId = result.customId;
    } else {
      shopOwnerAirtableId = shopOwners[0]._airtableId || '';
      shopOwnerCustomId = shopOwners[0].id;
      console.log(`✅ Using existing shop owner:`, {
        customId: shopOwnerCustomId,
        airtableId: shopOwnerAirtableId,
        name: shopOwners[0].name,
        phone: shopOwners[0].phone
      });
    }

    if (!shopOwnerAirtableId) {
      console.error("❌ No Airtable ID found for shop owner");
      return false;
    }

    // PROCESS IMAGES
    let imageAttachments: Array<{ url: string }> = [];
    
    if (product.images && product.images.length > 0) {
      console.log(`📸 Processing ${product.images.length} images...`);
      
      const validImages = product.images.filter(img => 
        img && typeof img === 'string' && isValidUrl(img)
      );
      
      if (validImages.length > 0) {
        imageAttachments = validImages.map(img => createAirtableAttachment(img));
        console.log(`✅ Prepared ${validImages.length} images`);
      }
    }

    // IMPORTANT: Store both the Airtable ID AND the custom ID
    const productData = {
      records: [{
        fields: {
          id: product.id,
          name: product.name,
          shopOwnerId: [shopOwnerAirtableId], // Airtable expects array of record IDs
          shopOwnerRecordId: shopOwnerAirtableId, // Also store as separate field for easier querying
          shopOwnerCustomId: shopOwnerCustomId, // Store the custom ID too
          description: product.description || '',
          price: product.price,
          currency: product.currency || 'MWK',
          images: imageAttachments,
          inStock: product.inStock !== false,
          specifications: product.specifications || `Added via WhatsApp`,
          createdDate: product.createdDate || new Date().toISOString().split('T')[0]
        }
      }]
    };

    console.log("📤 Sending product data to Airtable...");
    
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Products`,
      {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error creating product: ${response.status}`, errorText);
      return false;
    }

    const data = await response.json();
    console.log("✅ Product created successfully! Product ID:", data.records[0].id);
    
    return true;
  } catch (error) {
    console.error("❌ Error creating product:", error);
    return false;
  }
}

// Helper function to create shop owner
async function createShopOwnerFromPhone(phoneNumber: string, categoryId?: string): Promise<{ airtableId: string; customId: string } | null> {
  try {
    const customShopOwnerId = `SHOP-${Date.now().toString().slice(-8)}`;
    
    let categoryName = 'general';
    if (categoryId) {
      const categories = await fetchCategories();
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        categoryName = category.name;
      }
    }
    
    const shopOwnerData = {
      records: [{
        fields: {
          id: customShopOwnerId,
          name: `Shop ${phoneNumber}`,
          phone: phoneNumber,
          email: '',
          address: 'To be updated',
          categoryId: categoryId || 'general',
          description: `Auto-created shop owner via WhatsApp for ${categoryName}`
        }
      }]
    };

    console.log("🆕 Creating new shop owner:", shopOwnerData);
    
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ShopOwners`,
      {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopOwnerData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error creating shop owner: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    const airtableId = data.records[0].id;
    
    console.log("✅ Shop owner created:", {
      customId: customShopOwnerId,
      airtableId: airtableId
    });
    
    return {
      airtableId,
      customId: customShopOwnerId
    };
    
  } catch (error) {
    console.error("❌ Error creating shop owner:", error);
    return null;
  }
}

// ORDER FUNCTIONS (unchanged)
export async function createOrder(order: Order): Promise<Order | null> {
  try {
    console.log("📦 Creating order:", order);

    const products = await fetchAirtableData<Product & { _airtableId?: string }>('Products', {
      filterByFormula: `{id} = '${order.productId}'`
    });
    
    if (products.length === 0) {
      console.error(`❌ No product found with ID: ${order.productId}`);
      return null;
    }

    const product = products[0];
    const productAirtableId = product._airtableId;
    const shopOwnerAirtableId = (product as any).shopOwnerId?.[0];
    
    if (!productAirtableId || !shopOwnerAirtableId) {
      console.error("❌ Product has no valid IDs:", { productAirtableId, shopOwnerAirtableId });
      return null;
    }

    const orderData = {
      records: [{ 
        fields: {
          id: order.id,
          customerPhone: order.customerPhone,
          productId: [productAirtableId],
          shopOwnerId: [shopOwnerAirtableId],
          quantity: order.quantity,
          totalPrice: order.totalPrice,
          status: order.status.charAt(0).toUpperCase() + order.status.slice(1),
          orderDate: order.orderDate,
          notes: order.notes || '',
          deliveryAddress: order.deliveryAddress || '',
        }
      }]
    };

    console.log("📤 Sending order data to Airtable");
    
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Orders`,
      {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error creating order: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    console.log("✅ Order created successfully");
    
    return {
      ...order,
      id: data.records[0].id
    };
  } catch (error) {
    console.error("❌ Error creating order:", error);
    return null;
  }
}

export async function getCustomerOrders(customerPhone: string): Promise<Order[]> {
  try {
    const ordersData = await fetchAirtableData<{
      id: string;
      customerPhone?: string;
      productId?: string[];
      shopOwnerId?: string[];
      quantity?: number;
      totalPrice?: number;
      status?: string;
      orderDate?: string;
      notes?: string;
      deliveryAddress?: string;
    }>('Orders', {
      filterByFormula: `{customerPhone} = '${customerPhone}'`,
      sort: '[{field: "orderDate", direction: "desc"}]'
    });
    
    return ordersData.map((orderData) => ({
      id: orderData.id,
      customerPhone: orderData.customerPhone || '',
      productId: Array.isArray(orderData.productId) ? orderData.productId[0] || '' : '',
      productName: 'Product Name Not Available',
      shopOwnerId: Array.isArray(orderData.shopOwnerId) ? orderData.shopOwnerId[0] || '' : '',
      quantity: orderData.quantity || 0,
      totalPrice: orderData.totalPrice || 0,
      currency: 'MWK',
      status: ((orderData.status || 'Pending').toLowerCase() as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'),
      orderDate: orderData.orderDate || '',
      notes: orderData.notes || '',
      deliveryAddress: orderData.deliveryAddress || '',
    })) as Order[];
  } catch (error) {
    console.error("❌ Error getting customer orders:", error);
    return [];
  }
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const ordersData = await fetchAirtableData<{
    id: string;
    customerPhone?: string;
    productId?: string[];
    shopOwnerId?: string[];
    quantity?: number;
    totalPrice?: number;
    status?: string;
    orderDate?: string;
    notes?: string;
    deliveryAddress?: string;
  }>('Orders', {
    filterByFormula: `{id} = '${orderId}'`
  });
  
  if (ordersData.length === 0) return null;
  
  const orderData = ordersData[0];
  
  return {
    id: orderData.id,
    customerPhone: orderData.customerPhone || '',
    productId: Array.isArray(orderData.productId) ? orderData.productId[0] || '' : '',
    productName: 'Product Name Not Available',
    shopOwnerId: Array.isArray(orderData.shopOwnerId) ? orderData.shopOwnerId[0] || '' : '',
    quantity: orderData.quantity || 0,
    totalPrice: orderData.totalPrice || 0,
    currency: 'MWK',
    status: ((orderData.status || 'Pending').toLowerCase() as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'),
    orderDate: orderData.orderDate || '',
    notes: orderData.notes || '',
    deliveryAddress: orderData.deliveryAddress || '',
  } as Order;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<boolean> {
  try {
    const orders = await fetchAirtableData<{id: string, _airtableId?: string}>('Orders', {
      filterByFormula: `{id} = '${orderId}'`
    });
    
    if (orders.length === 0) {
      console.error(`❌ Order ${orderId} not found`);
      return false;
    }
    
    const orderAirtableId = orders[0]._airtableId;
    
    if (!orderAirtableId) {
      console.error(`❌ No Airtable ID found for order: ${orderId}`);
      return false;
    }
    
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Orders/${orderAirtableId}`,
      {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            status: status.charAt(0).toUpperCase() + status.slice(1)
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error updating order: ${response.status}`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    return false;
  }
}

// NEW: Diagnostic function for location-based search
export async function diagnoseLocationSearch(district?: string, area?: string): Promise<{
  districtsFound: string[];
  areasFound: string[];
  categoriesFound: number;
  shopOwnersFound: number;
  productsFound: number;
}> {
  try {
    const districts = await fetchDistricts();
    
    let areas: string[] = [];
    if (district) {
      areas = await fetchAreasByDistrict(district);
    }
    
    let categories: ProductCategory[] = [];
    let shopOwners: ShopOwner[] = [];
    let products: Product[] = [];
    
    if (district && area) {
      categories = await fetchCategoriesByDistrictAndArea(district, area);
      const shopOwnerPromises = categories.map(cat => fetchShopOwnersByCategory(cat.id));
      const shopOwnerArrays = await Promise.all(shopOwnerPromises);
      shopOwners = shopOwnerArrays.flat();
      
      const productPromises = shopOwners.map(shop => fetchProductsByShopOwner(shop.id));
      const productArrays = await Promise.all(productPromises);
      products = productArrays.flat();
    } else if (district) {
      categories = await fetchCategoriesByDistrict(district);
      const shopOwnerPromises = categories.map(cat => fetchShopOwnersByCategory(cat.id));
      const shopOwnerArrays = await Promise.all(shopOwnerPromises);
      shopOwners = shopOwnerArrays.flat();
      
      const productPromises = shopOwners.map(shop => fetchProductsByShopOwner(shop.id));
      const productArrays = await Promise.all(productPromises);
      products = productArrays.flat();
    }
    
    return {
      districtsFound: districts,
      areasFound: areas,
      categoriesFound: categories.length,
      shopOwnersFound: shopOwners.length,
      productsFound: products.length
    };
  } catch (error) {
    console.error('❌ Error diagnosing location search:', error);
    return {
      districtsFound: [],
      areasFound: [],
      categoriesFound: 0,
      shopOwnersFound: 0,
      productsFound: 0
    };
  }
}
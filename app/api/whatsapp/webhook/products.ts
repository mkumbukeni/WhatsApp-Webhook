// products.ts - COMPLETELY REWRITTEN FOR NEW CATEGORY → DISTRICT → SHOP → PRODUCT FLOW
import { sendText, sendImage } from './utils';
import { 
  ProductCategory, 
  ShopOwner, 
  Product, 
  ProductSessionData,
  WhatsAppSession 
} from './types';
import { 
  fetchCategories, 
  fetchShopOwnersByCategory, 
  fetchProductsByShopOwner, 
  searchProducts,
  fetchDistrictsByCategory,
  fetchShopsByCategoryAndDistrict,
  searchShopsByName,
  fetchProductsByShop,
  searchProductsInShop
} from './airtable';

// ADD THIS FUNCTION TO YOUR EXISTING products.ts FILE
// This is for the old location-based browsing flow (Option 1)

export async function startProductsFlow(from: string, session: WhatsAppSession): Promise<boolean> {
  try {
    await sendText(from, "🔄 Loading categories...");
    const categories = await fetchCategories();
    
    if (categories.length === 0) {
      await sendText(from, "❌ No product categories available.");
      return false;
    }

    const productSessionData: ProductSessionData = {
      step: 'show_location_selection',
      categories,
      shopOwners: [],
      products: [],
      currentCategoryId: null,
      currentShopOwnerId: null,
      currentProductId: null,
      currentPage: 1,
      selectedDistrict: undefined,
      selectedArea: undefined,
      currentStepData: null,
      shopPage: undefined,
      productPage: undefined,
      shopSearchMode: false,
      productSearchMode: false,
      currentCategoryName: undefined,
      currentShopName: undefined
    };

    session.products = productSessionData;
    session.step = "products";

    // Start with location selection
    productSessionData.step = 'show_location_selection';
    session.products = productSessionData;

    await showLocationSelection(from, session);
    return true;
  } catch (error) {
    console.error("Error starting products flow:", error);
    await sendText(from, "❌ Error loading categories.");
    return false;
  }
}

// Also need to add the showLocationSelection function if not present:
async function showLocationSelection(from: string, session: WhatsAppSession): Promise<void> {
  if (!session.products) return;

  await sendText(from, "📍 *SELECT LOCATION*\n\n" +
    "Would you like to browse by location?\n\n" +
    "*Select an option:*\n" +
    "1. Yes, select district & area\n" +
    "2. No, browse all products\n" +
    "3. Search products (any location)\n" +
    "4. Main menu\n\n" +
    "*Type the number only*");
}

// And add handleLocationSelection function:
async function handleLocationSelection(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.products) return false;

  if (text === '1') {
    // Select district - show a message that this is old flow
    await sendText(from, "📍 The location-based browsing is temporarily unavailable.\n\nPlease use the category browsing instead (Option 2 from main menu).\n\n*Type 0 to go back*");
    return true;
  } else if (text === '2') {
    // No location - show categories directly
    session.products.step = 'select_category';
    return await showCategories(from, session);
  } else if (text === '3') {
    // Search products
    session.products.step = 'search_products';
    await sendText(from, "🔍 *SEARCH PRODUCTS*\n\nType what you're looking for:\n\nExamples: dress, pizza, shoes, medicine\n\n*Type your search:*\n*Type 0 to go back*");
    return true;
  } else if (text === '4') {
    // Main menu
    session.step = "idle";
    session.products = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu());
    return true;
  } else {
    await sendText(from, "❌ Please type 1, 2, 3, or 4.");
    return true;
  }
}

// NEW: Start category selection flow
export async function startCategorySelection(from: string, session: WhatsAppSession): Promise<boolean> {
  try {
    await sendText(from, "🔄 Loading categories...");
    const categories = await fetchCategories();
    
    if (categories.length === 0) {
      await sendText(from, "❌ No product categories available.");
      return false;
    }

    const productSessionData: ProductSessionData = {
      step: 'select_category',
      categories,
      shopOwners: [],
      products: [],
      currentCategoryId: null,
      currentShopOwnerId: null,
      currentProductId: null,
      currentPage: 1,
      selectedDistrict: undefined,
      selectedArea: undefined,
      currentStepData: null,
      shopPage: 1,
      productPage: 1,
      shopSearchMode: false,
      productSearchMode: false
    };

    session.products = productSessionData;
    session.step = "products";

    return await showCategories(from, session);
  } catch (error) {
    console.error("Error starting category selection:", error);
    await sendText(from, "❌ Error loading categories.");
    return false;
  }
}

async function showCategories(from: string, session: WhatsAppSession): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const categories = productData.categories;

  let message = "🛍️ *SELECT CATEGORY*\n\n";
  message += "Choose a category by number:\n\n";
  
  categories.forEach((category: ProductCategory, index: number) => {
    message += `${index + 1}. ${category.icon || '📁'} ${category.name}\n`;
  });

  message += `\n${categories.length + 1}. 🔍 Search Products\n`;
  message += `${categories.length + 2}. 📍 Browse by Location\n`;
  message += `${categories.length + 3}. 🏠 Main Menu\n\n`;
  message += "*Type the number only*";

  await sendText(from, message);
  return true;
}

// NEW: Handle category selection
async function handleCategorySelection(from: string, session: WhatsAppSession, input: string): Promise<boolean> {
  if (!session.products) return false;
  
  const productData = session.products;
  const num = parseInt(input);

  // Handle special options
  if (num === productData.categories.length + 1) {
    // Search products
    productData.step = 'search_products';
    await sendText(from, "🔍 *SEARCH PRODUCTS*\n\nType what you're looking for:\n\nExamples: dress, pizza, shoes, medicine\n\n*Type your search:*\n*Type 0 to go back*");
    return true;
  }
  
  if (num === productData.categories.length + 2) {
    // Browse by location (use old flow)
    productData.step = 'show_location_selection';
    await sendText(from, "📍 *BROWSE BY LOCATION*\n\nThis will show you the old location-based browsing flow.\n\n*Type 0 to go back to categories*");
    return true;
  }
  
  if (num === productData.categories.length + 3) {
    // Main menu
    session.step = "idle";
    session.products = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu());
    return true;
  }

  if (isNaN(num) || num < 1 || num > productData.categories.length) {
    await sendText(from, `❌ Please type a number between 1 and ${productData.categories.length + 3}.`);
    return true;
  }

  const selectedCategory = productData.categories[num - 1];
  productData.currentCategoryId = selectedCategory.id;
  productData.currentCategoryName = selectedCategory.name;
  productData.step = 'select_district_or_search';
  
  await showDistrictOrSearchOptions(from, session, selectedCategory);
  return true;
}

// FIX THIS FUNCTION IN YOUR products.ts:
async function showDistrictOrSearchOptions(from: string, session: WhatsAppSession, category: ProductCategory): Promise<void> {
  if (!session.products) return;

  await sendText(from, `📂 *${category.name.toUpperCase()}*\n\n🔄 Loading districts where this category is available...`);
  
  const districts = await fetchDistrictsByCategory(category.id);
  
  if (districts.length === 0) {
    await sendText(from, `❌ No districts found for ${category.name}.\n\n*Select:*\n1. Back to categories\n2. Main menu`);
    session.products.step = 'select_category';
    return;
  }

  // FIX: Get productData from session
  const productData = session.products;
  productData.currentStepData = { districts };
  productData.step = 'select_district'; // CHANGE: Go directly to district selection
  
  let message = `📍 *${category.name.toUpperCase()} - SELECT DISTRICT*\n\n`;
  
  if (districts.length === 1) {
    // If only one district, auto-select it
    message += `Only one district available: *${districts[0]}*\n\n`;
    message += "*Select an option:*\n\n";
    message += `1. Select ${districts[0]}\n`;
    message += `2. Search shop by name\n`;
    message += `3. Back to categories\n`;
    message += `4. Main menu\n\n`;
    message += "*Type the number only*";
  } else {
    // Show districts with numbers
    message += "Choose a district by number:\n\n";
    
    districts.forEach((district: string, index: number) => {
      message += `${index + 1}. ${district}\n`;
    });

    message += `\n${districts.length + 1}. Search shop by name\n`;
    message += `${districts.length + 2}. Back to categories\n`;
    message += `${districts.length + 3}. Main menu\n\n`;
    message += "*Type the number only*";
  }

  await sendText(from, message);
}

// ALSO UPDATE handleDistrictOrSearchSelection function:
async function handleDistrictOrSearchSelection(from: string, session: WhatsAppSession, input: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const districts = productData.currentStepData?.districts || [];
  const categoryId = productData.currentCategoryId;
  
  if (!categoryId) {
    await sendText(from, "❌ Category not selected.");
    return true;
  }

  const category = productData.categories.find(c => c.id === categoryId)!;
  
  if (districts.length === 1) {
    // Handle single district case
    if (input === '1') {
      // Select the only district
      const selectedDistrict = districts[0];
      productData.selectedDistrict = selectedDistrict;
      productData.shopPage = 1;
      productData.step = 'show_shops';
      
      await showShopsInDistrict(from, session, categoryId, selectedDistrict, 1);
      return true;
    } else if (input === '2') {
      // Search shop by name
      productData.shopSearchMode = true;
      productData.step = 'search_shops';
      await sendText(from, "🔍 *SEARCH SHOP BY NAME*\n\nType the name of the shop you're looking for:\n\n*Type 0 to go back*");
      return true;
    } else if (input === '3') {
      // Back to categories
      productData.step = 'select_category';
      return await showCategories(from, session);
    } else if (input === '4') {
      // Main menu
      session.step = "idle";
      session.products = null;
      const { getWelcomeMenu } = await import('./utils');
      await sendText(from, getWelcomeMenu());
      return true;
    } else {
      await sendText(from, "❌ Please type 1, 2, 3, or 4.");
      return true;
    }
  } else {
    // Handle multiple districts case
    const num = parseInt(input);
    
    if (num >= 1 && num <= districts.length) {
      // District selected
      const selectedDistrict = districts[num - 1];
      productData.selectedDistrict = selectedDistrict;
      productData.shopPage = 1;
      productData.step = 'show_shops';
      
      await showShopsInDistrict(from, session, categoryId, selectedDistrict, 1);
      return true;
    } else if (num === districts.length + 1) {
      // Search shop by name
      productData.shopSearchMode = true;
      productData.step = 'search_shops';
      await sendText(from, "🔍 *SEARCH SHOP BY NAME*\n\nType the name of the shop you're looking for:\n\n*Type 0 to go back*");
      return true;
    } else if (num === districts.length + 2) {
      // Back to categories
      productData.step = 'select_category';
      return await showCategories(from, session);
    } else if (num === districts.length + 3) {
      // Main menu
      session.step = "idle";
      session.products = null;
      const { getWelcomeMenu } = await import('./utils');
      await sendText(from, getWelcomeMenu());
      return true;
    } else {
      await sendText(from, `❌ Please type a number between 1 and ${districts.length + 3}.`);
      return true;
    }
  }
}

// NEW: Show districts for selection
async function showDistrictsForSelection(from: string, session: WhatsAppSession): Promise<void> {
  if (!session.products) return;

  const productData = session.products;
  const districts = productData.currentStepData?.districts || [];
  const categoryName = productData.currentCategoryName || 'Selected Category';

  productData.step = 'select_district';

  let message = `📍 *${categoryName.toUpperCase()} - SELECT DISTRICT*\n\n`;
  message += "Choose a district by number:\n\n";
  
  districts.forEach((district: string, index: number) => {
    message += `${index + 1}. ${district}\n`;
  });

  message += `\n${districts.length + 1}. Back to options\n`;
  message += `${districts.length + 2}. Main menu\n\n`;
  message += "*Type the number only*";

  await sendText(from, message);
}

// NEW: Handle district selection
async function handleDistrictSelection(from: string, session: WhatsAppSession, input: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const num = parseInt(input);
  const districts = productData.currentStepData?.districts || [];
  const categoryId = productData.currentCategoryId;

  if (!categoryId) {
    await sendText(from, "❌ Category not selected.");
    return true;
  }

  // Handle special options
  if (num === districts.length + 1) {
    // Back to options
    productData.step = 'select_district_or_search';
    await showDistrictOrSearchOptions(from, session, productData.categories.find(c => c.id === categoryId)!);
    return true;
  }
  
  if (num === districts.length + 2) {
    // Main menu
    session.step = "idle";
    session.products = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu());
    return true;
  }

  if (isNaN(num) || num < 1 || num > districts.length) {
    await sendText(from, `❌ Please type a number between 1 and ${districts.length + 2}.`);
    return true;
  }

  const selectedDistrict = districts[num - 1];
  productData.selectedDistrict = selectedDistrict;
  productData.shopPage = 1;
  productData.step = 'show_shops';
  
  await showShopsInDistrict(from, session, categoryId, selectedDistrict, 1);
  return true;
}

// NEW: Show shops in district
async function showShopsInDistrict(from: string, session: WhatsAppSession, categoryId: string, district: string, page: number): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const pageSize = 10;
  
  await sendText(from, `🏪 *Loading shops in ${district}...*`);
  
  const shops = await fetchShopsByCategoryAndDistrict(categoryId, district);
  
  if (shops.length === 0) {
    await sendText(from, `❌ No shops found in ${district} for this category.\n\n*Select:*\n1. Try different district\n2. Back to categories\n3. Main menu`);
    productData.step = 'select_district';
    return true;
  }

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageShops = shops.slice(startIndex, endIndex);
  const totalPages = Math.ceil(shops.length / pageSize);

  productData.shopOwners = shops;
  productData.currentStepData = { 
    ...productData.currentStepData, 
    pageShops, 
    currentShopPage: page,
    totalShopPages: totalPages 
  };

  let message = `🏪 *SHOPS IN ${district.toUpperCase()}* (Page ${page}/${totalPages})\n\n`;
  
  pageShops.forEach((shop: ShopOwner, index: number) => {
    const displayNumber = startIndex + index + 1;
    message += `${displayNumber}. *${shop.name}*\n`;
    message += `   📞 ${shop.phone}\n`;
    message += `   📍 ${shop.address || 'Address not specified'}\n`;
    if (shop.rating) {
      message += `   ⭐ ${shop.rating}/5\n`;
    }
    message += "\n";
  });

  // Navigation options
  const options: string[] = [];
  
  if (page < totalPages) {
    options.push(`${pageShops.length + 1}. Next page of shops`);
  }
  
  options.push(`${pageShops.length + (page < totalPages ? 2 : 1)}. Search shop by name`);
  options.push(`${pageShops.length + (page < totalPages ? 3 : 2)}. Change district`);
  options.push(`${pageShops.length + (page < totalPages ? 4 : 3)}. Back to categories`);
  options.push(`${pageShops.length + (page < totalPages ? 5 : 4)}. Main menu`);
  
  message += "*Select an option:*\n";
  options.forEach(option => {
    message += `${option}\n`;
  });
  
  message += "\n*Type the number only*";

  await sendText(from, message);
  return true;
}

// NEW: Handle shop selection or navigation
async function handleShopSelection(from: string, session: WhatsAppSession, input: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const num = parseInt(input);
  const pageShops = productData.currentStepData?.pageShops || [];
  const currentShopPage = productData.currentStepData?.currentShopPage || 1;
  const totalShopPages = productData.currentStepData?.totalShopPages || 1;
  const shops = productData.shopOwners;
  const pageSize = 10;
  const startIndex = (currentShopPage - 1) * pageSize;

  // Handle navigation options
  const pageShopsCount = pageShops.length;
  
  if (num === pageShopsCount + 1 && currentShopPage < totalShopPages) {
    // Next page of shops
    const nextPage = currentShopPage + 1;
    productData.shopPage = nextPage;
    return await showShopsInDistrict(
      from, 
      session, 
      productData.currentCategoryId!, 
      productData.selectedDistrict!, 
      nextPage
    );
  }
  
  const optionOffset = pageShopsCount + (currentShopPage < totalShopPages ? 1 : 0);
  
  if (num === optionOffset + 1) {
    // Search shop by name
    productData.shopSearchMode = true;
    productData.step = 'search_shops';
    await sendText(from, "🔍 *SEARCH SHOP BY NAME*\n\nType the name of the shop you're looking for:\n\n*Type 0 to go back*");
    return true;
  }
  
  if (num === optionOffset + 2) {
    // Change district
    productData.step = 'select_district';
    await showDistrictsForSelection(from, session);
    return true;
  }
  
  if (num === optionOffset + 3) {
    // Back to categories
    productData.step = 'select_category';
    return await showCategories(from, session);
  }
  
  if (num === optionOffset + 4) {
    // Main menu
    session.step = "idle";
    session.products = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu());
    return true;
  }

  // Handle shop selection
  if (num >= 1 && num <= pageShopsCount) {
    const shopIndex = startIndex + (num - 1);
    const selectedShop = shops[shopIndex];
    
    if (!selectedShop) {
      await sendText(from, "❌ Shop not found.");
      return true;
    }

    productData.currentShopOwnerId = selectedShop.id;
    productData.currentShopName = selectedShop.name;
    productData.productPage = 1;
    productData.step = 'show_products';
    
    await showProductsInShop(from, session, selectedShop.id, 1);
    return true;
  }

  await sendText(from, `❌ Please type a number between 1 and ${optionOffset + 4}.`);
  return true;
}

// UPDATED: Show products in shop - Send images one at a time with info
async function showProductsInShop(from: string, session: WhatsAppSession, shopId: string, page: number): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const shopName = productData.currentShopName || 'Selected Shop';
  const pageSize = 5;
  
  await sendText(from, `🛒 *Loading products from ${shopName}...*`);
  
  const result = await fetchProductsByShop(shopId, page, pageSize);
  const products = result.products;
  const totalPages = result.totalPages;
  const totalProducts = result.totalProducts;
  
  if (products.length === 0) {
    await sendText(from, `❌ No products found in ${shopName}.\n\n*Select:*\n1. Back to shops\n2. Main menu`);
    productData.step = 'show_shops';
    return true;
  }

  productData.products = products;
  productData.currentStepData = { 
    ...productData.currentStepData, 
    currentProductPage: page,
    totalProductPages: totalPages,
    totalProducts 
  };

  // Send instructional message first
  await sendText(from, `📸 *${shopName.toUpperCase()} - BROWSE PRODUCTS*\n\nI'll show you ${products.length} products one by one. *Type the product number (1, 2, etc.) to view full details and buy!*`);
  
  // Send product images ONE AT A TIME with information
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const productNumber = (page - 1) * pageSize + i + 1;
    
    if (product.images && product.images.length > 0) {
      try {
        // Send image with caption
        await sendImage(
          from, 
          product.images[0], 
          `*[PRODUCT ${productNumber}]* ${product.name}`
        );
        
        // Send product details after image
        await new Promise(resolve => setTimeout(resolve, 800));
        
        let detailsMessage = `*${productNumber}. ${product.name}*\n`;
        detailsMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
        detailsMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
        
        if (product.description && product.description.length < 100) {
          detailsMessage += `📄 *Description:* ${product.description}\n`;
        }
        
        detailsMessage += `\n*To view full details:* Type *${productNumber}*`;
        
        await sendText(from, detailsMessage);
        
        // Wait before showing next product
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
          await sendText(from, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*Next product loading...*`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Failed to send image for product ${productNumber}:`, error);
        
        // If image fails, send text only
        let fallbackMessage = `*${productNumber}. ${product.name}*\n`;
        fallbackMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
        fallbackMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
        fallbackMessage += `\n*To view full details:* Type *${productNumber}*`;
        
        await sendText(from, fallbackMessage);
        
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      // No image available, send text only
      let textMessage = `*${productNumber}. ${product.name}*\n`;
      textMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
      textMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
      textMessage += `📷 *Image:* No image available\n`;
      textMessage += `\n*To view full details:* Type *${productNumber}*`;
      
      await sendText(from, textMessage);
      
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // After showing all products, display navigation options
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let message = `✅ *${products.length} PRODUCTS SHOWN*\n\n`;
  message += `📦 *Total products:* ${totalProducts}\n`;
  message += `📄 *Page:* ${page}/${totalPages}\n\n`;
  
  message += `*🎯 WHAT WOULD YOU LIKE TO DO?*\n\n`;
  
  const options: string[] = [];
  
  if (page < totalPages) {
    options.push(`📄 *Next page of products* (type ${products.length + 1})`);
  }
  
  // Update option numbers based on whether next page is available
  const optionOffset = products.length + (page < totalPages ? 1 : 0);
  
  options.push(`🔍 *Search product by name* (type ${optionOffset + 1})`);
  options.push(`🏪 *Back to shops* (type ${optionOffset + 2})`);
  options.push(`📂 *Back to categories* (type ${optionOffset + 3})`);
  options.push(`🏠 *Main menu* (type ${optionOffset + 4})`);
  
  message += "*SELECT AN OPTION:*\n";
  options.forEach(option => {
    message += `${option}\n`;
  });
  
  message += `\n*📝 TO VIEW FULL PRODUCT DETAILS:*\n`;
  message += `*Type the product number (1, 2, etc.)*\n`;
  message += `*Example:* To see details of "${products[0].name}", type *1*`;

  await sendText(from, message);
  return true;
}

// UPDATED: Handle product selection or navigation with correct option numbers
async function handleProductSelection(from: string, session: WhatsAppSession, input: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const num = parseInt(input);
  const products = productData.products;
  const currentProductPage = productData.currentStepData?.currentProductPage || 1;
  const totalProductPages = productData.currentStepData?.totalProductPages || 1;
  const pageSize = 5;
  const startIndex = (currentProductPage - 1) * pageSize;

  // Handle navigation options
  const productsCount = products.length;
  
  // Check if next page is available
  const hasNextPage = currentProductPage < totalProductPages;
  
  // Calculate option numbers
  const nextPageOption = hasNextPage ? productsCount + 1 : -1;
  const searchOption = productsCount + (hasNextPage ? 2 : 1);
  const backToShopsOption = productsCount + (hasNextPage ? 3 : 2);
  const backToCategoriesOption = productsCount + (hasNextPage ? 4 : 3);
  const mainMenuOption = productsCount + (hasNextPage ? 5 : 4);
  
  // Handle next page option
  if (num === nextPageOption && hasNextPage) {
    // Next page of products
    const nextPage = currentProductPage + 1;
    productData.productPage = nextPage;
    return await showProductsInShop(
      from, 
      session, 
      productData.currentShopOwnerId!, 
      nextPage
    );
  }
  
  // Handle search option
  if (num === searchOption) {
    // Search product by name
    productData.productSearchMode = true;
    productData.step = 'search_products_in_shop';
    await sendText(from, "🔍 *SEARCH PRODUCT BY NAME*\n\nType the name of the product you're looking for:\n\n*Type 0 to go back*");
    return true;
  }
  
  // Handle back to shops option
  if (num === backToShopsOption) {
    // Back to shops
    productData.step = 'show_shops';
    const categoryId = productData.currentCategoryId!;
    const district = productData.selectedDistrict!;
    const shopPage = productData.shopPage || 1;
    return await showShopsInDistrict(from, session, categoryId, district, shopPage);
  }
  
  // Handle back to categories option
  if (num === backToCategoriesOption) {
    // Back to categories
    productData.step = 'select_category';
    return await showCategories(from, session);
  }
  
  // Handle main menu option
  if (num === mainMenuOption) {
    // Main menu
    session.step = "idle";
    session.products = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu());
    return true;
  }

  // Handle product selection
  if (num >= 1 && num <= productsCount) {
    const productIndex = startIndex + (num - 1);
    const selectedProduct = productData.products[productIndex];
    
    if (!selectedProduct) {
      await sendText(from, "❌ Product not found.");
      return true;
    }

    productData.selectedProductIndex = productIndex;
    productData.currentProductId = selectedProduct.id;
    productData.step = 'show_product_details';
    
    return await displayProductDetails(from, session, productData, productIndex);
  }

  // If we get here, the input was invalid
  const maxOption = hasNextPage ? mainMenuOption : mainMenuOption;
  await sendText(from, `❌ Please type a number between 1 and ${maxOption}.`);
  return true;
}

// UPDATED: Display product details with better UX
async function displayProductDetails(from: string, session: WhatsAppSession, productData: ProductSessionData, productIndex: number): Promise<boolean> {
  try {
    const product = productData.products[productIndex];
    if (!product) {
      await sendText(from, "❌ Product not found.");
      return false;
    }

    // Send images first with clear indication
    if (product.images && product.images.length > 0) {
      await sendText(from, `📸 *LOADING ${product.images.length} IMAGE${product.images.length > 1 ? 'S' : ''} OF "${product.name}"*`);
      
      for (let i = 0; i < product.images.length; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const caption = i === 0 
            ? `*${product.name}* - Image ${i + 1}/${product.images.length}`
            : `Image ${i + 1}/${product.images.length}`;
          
          await sendImage(from, product.images[i], caption);
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error(`Failed to send image:`, error);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clearer product details layout
    let message = `🛍️ *${product.name.toUpperCase()}*\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💰 *PRICE:* ${product.currency} ${product.price.toLocaleString()}\n`;
    message += `📦 *AVAILABILITY:* ${product.inStock ? '✅ IN STOCK' : '❌ OUT OF STOCK'}\n\n`;
    
    if (product.description) {
      message += `📄 *DESCRIPTION:*\n${product.description}\n\n`;
    }
    
    // Show shop info
    const shop = productData.shopOwners.find((s: ShopOwner) => 
      s.id === product.shopOwnerId || s.id === product.shopOwnerRecordId
    );
    if (shop) {
      message += `🏪 *SOLD BY:*\n`;
      message += `   • ${shop.name}\n`;
      message += `   • 📞 ${shop.phone}\n`;
      if (shop.address) {
        message += `   • 📍 ${shop.address}\n`;
      }
      message += "\n";
    }

    if (product.images && product.images.length > 0) {
      message += `📸 *${product.images.length} IMAGE${product.images.length > 1 ? 'S' : ''} SHOWN ABOVE*\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `*🎯 WHAT WOULD YOU LIKE TO DO?*\n\n`;
    message += `1. 🛒 *BUY THIS PRODUCT*\n`;
    message += `2. 🔙 *Back to products list*\n`;
    message += `3. 🏠 *Main menu*\n\n`;
    message += `*Type the number (1, 2, or 3) to continue:*`;

    await sendText(from, message);
    return true;
  } catch (error) {
    console.error("Error displaying product:", error);
    await sendText(from, "❌ Error loading product.");
    return true;
  }
}

// NEW: Handle shop search
async function handleShopSearch(from: string, session: WhatsAppSession, query: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;

  if (query.trim() === '0') {
    // Go back to district selection
    productData.shopSearchMode = false;
    productData.step = 'select_district_or_search';
    const category = productData.categories.find(c => c.id === productData.currentCategoryId)!;
    await showDistrictOrSearchOptions(from, session, category);
    return true;
  }

  if (query.length < 2) {
    await sendText(from, "❌ Please enter at least 2 characters.\n\nType 0 to go back.");
    return true;
  }

  await sendText(from, `🔍 Searching for shops with name "${query}"...`);

  try {
    const shops = await searchShopsByName(productData.currentCategoryId!, query);
    
    if (shops.length === 0) {
      await sendText(from, `❌ No shops found matching "${query}".\n\n*Select:*\n1. Try different search\n2. Browse by district\n3. Back to categories\n4. Main menu`);
      
      productData.currentStepData = { searchOptions: true };
      return true;
    }

    productData.shopOwners = shops;
    productData.shopPage = 1;
    productData.step = 'show_shop_search_results';
    
    return await showShopSearchResults(from, session, shops, query);
  } catch (error) {
    console.error("Shop search error:", error);
    await sendText(from, "❌ Error searching for shops.\n\n*Select:*\n1. Try again\n2. Browse by district\n3. Back to categories\n4. Main menu");
    return true;
  }
}

// NEW: Show shop search results
async function showShopSearchResults(from: string, session: WhatsAppSession, shops: ShopOwner[], query: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const pageSize = 10;
  const page = productData.shopPage || 1;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageShops = shops.slice(startIndex, endIndex);
  const totalPages = Math.ceil(shops.length / pageSize);

  productData.currentStepData = { 
    ...productData.currentStepData, 
    pageShops, 
    currentShopPage: page,
    totalShopPages: totalPages 
  };

  let message = `🔍 *SHOP SEARCH RESULTS FOR "${query}"* (Page ${page}/${totalPages})\n\n`;
  message += `🏪 Found ${shops.length} shop${shops.length > 1 ? 's' : ''}\n\n`;
  
  pageShops.forEach((shop: ShopOwner, index: number) => {
    const displayNumber = startIndex + index + 1;
    message += `${displayNumber}. *${shop.name}*\n`;
    message += `   📞 ${shop.phone}\n`;
    message += `   📍 ${shop.address || 'Address not specified'}\n`;
    if (shop.rating) {
      message += `   ⭐ ${shop.rating}/5\n`;
    }
    message += "\n";
  });

  // Navigation options
  const options: string[] = [];
  
  if (page < totalPages) {
    options.push(`${pageShops.length + 1}. Next page of results`);
  }
  
  options.push(`${pageShops.length + (page < totalPages ? 2 : 1)}. New shop search`);
  options.push(`${pageShops.length + (page < totalPages ? 3 : 2)}. Browse by district`);
  options.push(`${pageShops.length + (page < totalPages ? 4 : 3)}. Back to categories`);
  options.push(`${pageShops.length + (page < totalPages ? 5 : 4)}. Main menu`);
  
  message += "*Select an option:*\n";
  options.forEach(option => {
    message += `${option}\n`;
  });
  
  message += "\n*Type the number only*";

  await sendText(from, message);
  return true;
}

// NEW: Handle product search in shop
async function handleProductSearchInShop(from: string, session: WhatsAppSession, query: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;

  if (query.trim() === '0') {
    // Go back to products list
    productData.productSearchMode = false;
    productData.step = 'show_products';
    return await showProductsInShop(
      from, 
      session, 
      productData.currentShopOwnerId!, 
      productData.productPage || 1
    );
  }

  if (query.length < 2) {
    await sendText(from, "❌ Please enter at least 2 characters.\n\nType 0 to go back.");
    return true;
  }

  await sendText(from, `🔍 Searching for products with name "${query}"...`);

  try {
    const products = await searchProductsInShop(productData.currentShopOwnerId!, query);
    
    if (products.length === 0) {
      await sendText(from, `❌ No products found matching "${query}".\n\n*Select:*\n1. Try different search\n2. Browse all products\n3. Back to shops\n4. Main menu`);
      return true;
    }

    productData.products = products;
    productData.productSearchMode = true;
    productData.step = 'show_product_search_results';
    
    return await showProductSearchResults(from, session, products, query);
  } catch (error) {
    console.error("Product search error:", error);
    await sendText(from, "❌ Error searching for products.\n\n*Select:*\n1. Try again\n2. Browse all products\n3. Back to shops\n4. Main menu");
    return true;
  }
}

// UPDATED: Show product search results with one-at-a-time display
async function showProductSearchResults(from: string, session: WhatsAppSession, products: Product[], query: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;
  const shopName = productData.currentShopName || 'Selected Shop';

  // Send instructional message first
  await sendText(from, `📸 *${shopName.toUpperCase()} - SEARCH RESULTS*\n\nFound ${products.length} product${products.length > 1 ? 's' : ''} matching "${query}". Showing products one by one. *Type the product number (1, 2, etc.) to view full details!*`);
  
  // Send product images ONE AT A TIME
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    if (product.images && product.images.length > 0) {
      try {
        // Send image with caption
        await sendImage(
          from, 
          product.images[0], 
          `*[PRODUCT ${i + 1}]* ${product.name}`
        );
        
        // Send product details after image
        await new Promise(resolve => setTimeout(resolve, 800));
        
        let detailsMessage = `*${i + 1}. ${product.name}*\n`;
        detailsMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
        detailsMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
        
        if (product.description && product.description.length < 100) {
          detailsMessage += `📄 *Description:* ${product.description}\n`;
        }
        
        detailsMessage += `\n*To view full details:* Type *${i + 1}*`;
        
        await sendText(from, detailsMessage);
        
        // Wait before showing next product
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
          await sendText(from, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*Next product loading...*`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Failed to send image for product ${i + 1}:`, error);
        
        // If image fails, send text only
        let fallbackMessage = `*${i + 1}. ${product.name}*\n`;
        fallbackMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
        fallbackMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
        fallbackMessage += `\n*To view full details:* Type *${i + 1}*`;
        
        await sendText(from, fallbackMessage);
        
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      // No image available, send text only
      let textMessage = `*${i + 1}. ${product.name}*\n`;
      textMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
      textMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
      textMessage += `📷 *Image:* No image available\n`;
      textMessage += `\n*To view full details:* Type *${i + 1}*`;
      
      await sendText(from, textMessage);
      
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // After showing all products, display options
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  let message = `✅ *SEARCH COMPLETE*\n\n`;
  message += `🔍 *Search:* "${query}"\n`;
  message += `📦 *Found:* ${products.length} product${products.length > 1 ? 's' : ''}\n\n`;
  
  message += `*🎯 WHAT WOULD YOU LIKE TO DO?*\n\n`;
  message += `1. Select product by number\n`;
  message += `2. New product search\n`;
  message += `3. Browse all products\n`;
  message += `4. Back to shops\n`;
  message += `5. Main menu\n\n`;
  message += `*📝 TO VIEW FULL PRODUCT DETAILS:*\n`;
  message += `*Type the product number (1, 2, etc.)*\n`;
  message += `*Example:* To see details of "${products[0].name}", type *1*`;

  await sendText(from, message);
  return true;
}

// EXISTING: Handle product details selection
async function handleProductDetailsSelection(from: string, session: WhatsAppSession, input: string): Promise<boolean> {
  if (!session.products) return false;
  
  const productData = session.products;
  const num = parseInt(input);

  if (num === 1) {
    // Buy this product
    if (productData.selectedProductIndex === undefined) {
      await sendText(from, "❌ Product not selected.");
      return true;
    }
    
    const product = productData.products[productData.selectedProductIndex];
    const shop = productData.shopOwners.find((s: ShopOwner) => 
      s.id === product.shopOwnerId || s.id === product.shopOwnerRecordId
    );
    
    if (product && shop) {
      await sendText(from, `🛒 Starting order for *${product.name}*...`);
      
      try {
        const { startOrderFlow } = await import('./orders');
        const started = await startOrderFlow(from, session, product, shop.id);
        
        if (!started) {
          throw new Error('Failed to start order flow');
        }
        return true;
      } catch (error) {
        console.error("Error starting order flow:", error);
        
        // Fallback message
        let message = `🛒 *PURCHASE ${product.name}*\n\n`;
        message += `*Price:* ${product.currency} ${product.price.toLocaleString()}\n\n`;
        message += `*Contact Seller:*\n`;
        message += `👤 ${shop.name}\n`;
        message += `📞 ${shop.phone}\n`;
        
        message += "\n💡 *How to buy:*\n";
        message += "1. Contact the seller\n";
        message += "2. Confirm availability\n";
        message += "3. Arrange payment\n";
        message += "4. Pick up or delivery\n";
        
        await sendText(from, message);
        return true;
      }
    } else {
      await sendText(from, "❌ Seller information not available.");
      return true;
    }
  } else if (num === 2) {
    // Back to products list
    productData.step = 'show_products';
    productData.currentProductId = null;
    productData.selectedProductIndex = undefined;
    return await showProductsInShop(
      from, 
      session, 
      productData.currentShopOwnerId!, 
      productData.productPage || 1
    );
  } else if (num === 3) {
    // Main menu
    session.step = "idle";
    session.products = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu());
    return true;
  } else {
    await sendText(from, "❌ Please type 1, 2, or 3.");
    return true;
  }
}





// UPDATED: Global product search with shop, district, and area information
async function handleGlobalProductSearch(from: string, session: WhatsAppSession, query: string): Promise<boolean> {
  if (!session.products) return false;

  const productData = session.products;

  if (query.trim() === '0') {
    // Back to categories
    productData.step = 'select_category';
    return await showCategories(from, session);
  }

  if (query.length < 2) {
    await sendText(from, "❌ Please enter at least 2 characters.\n\nType 0 to go back.");
    return true;
  }

  await sendText(from, `🔍 Searching for "${query}"...`);

  try {
    const products = await searchProducts(query);
    
    productData.products = products;
    productData.currentPage = 1;
    productData.step = 'show_global_search_results';
    
    if (products.length === 0) {
      await sendText(from, `❌ No products found for "${query}".\n\n*Select:*\n1. Search again\n2. Browse categories\n3. Main menu`);
      return true;
    }

    await sendText(from, `✅ Found ${products.length} product${products.length > 1 ? 's' : ''}`);
    
    // Send instructional message first
    if (products.length > 0) {
      await sendText(from, `📸 *SEARCH RESULTS PREVIEW*\n\nShowing ${Math.min(products.length, 3)} product images from search. *Type the product number (1, 2, etc.) to view full details!*`);
      
      // Send product images (max 3) with shop info
      for (let i = 0; i < Math.min(products.length, 3); i++) {
        const product = products[i];
        if (product.images && product.images.length > 0) {
          try {
            await sendImage(
              from, 
              product.images[0], 
              `*[PRODUCT ${i + 1}]* ${product.name}`
            );
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Send product details after image WITH SHOP, DISTRICT, AND AREA INFO
            let detailsMessage = `*${i + 1}. ${product.name}*\n`;
            detailsMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
            detailsMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
            
            // Add shop info if available
            if (product.shopName && product.shopName !== 'Unknown Shop') {
              detailsMessage += `🏪 *Shop:* ${product.shopName}\n`;
            }
            
            // Add district and area if available
            if (product.district) {
              detailsMessage += `📍 *Location:* ${product.district}`;
              if (product.location) {
                detailsMessage += `, ${product.location}`;
              }
              detailsMessage += `\n`;
            }
            
            detailsMessage += `\n*To view full details:* Type *${i + 1}*`;
            
            await sendText(from, detailsMessage);
            
            // Wait before showing next product
            if (i < Math.min(products.length, 3) - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
              await sendText(from, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*Next product loading...*`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
          } catch (error) {
            console.error(`Failed to send image for product ${i + 1}:`, error);
            
            // If image fails, send text only with shop info
            let fallbackMessage = `*${i + 1}. ${product.name}*\n`;
            fallbackMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
            fallbackMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
            
            // Add shop info if available
            if (product.shopName && product.shopName !== 'Unknown Shop') {
              fallbackMessage += `🏪 *Shop:* ${product.shopName}\n`;
            }
            
            // Add district and area if available
            if (product.district) {
              fallbackMessage += `📍 *Location:* ${product.district}`;
              if (product.location) {
                fallbackMessage += `, ${product.location}`;
              }
              fallbackMessage += `\n`;
            }
            
            fallbackMessage += `\n*To view full details:* Type *${i + 1}*`;
            
            await sendText(from, fallbackMessage);
            
            if (i < Math.min(products.length, 3) - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } else {
          // No image available, send text only with shop info
          let textMessage = `*${i + 1}. ${product.name}*\n`;
          textMessage += `💰 *Price:* ${product.currency} ${product.price.toLocaleString()}\n`;
          textMessage += `📦 *Stock:* ${product.inStock ? '✅ Available' : '❌ Out of Stock'}\n`;
          textMessage += `📷 *Image:* No image available\n`;
          
          // Add shop info if available
          if (product.shopName && product.shopName !== 'Unknown Shop') {
            textMessage += `🏪 *Shop:* ${product.shopName}\n`;
          }
          
          // Add district and area if available
          if (product.district) {
            textMessage += `📍 *Location:* ${product.district}`;
            if (product.location) {
              textMessage += `, ${product.location}`;
            }
            textMessage += `\n`;
          }
          
          textMessage += `\n*To view full details:* Type *${i + 1}*`;
          
          await sendText(from, textMessage);
          
          if (i < Math.min(products.length, 3) - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    }
    
    // If there are more than 3 products, mention it
    if (products.length > 3) {
      await sendText(from, `\n📊 *Note:* Showing first 3 of ${products.length} products found.`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Show all products in list format WITH SHOP AND LOCATION INFO
    let message = `🔍 *SEARCH RESULTS FOR "${query}"*\n\n`;
    message += `📦 *Total found:* ${products.length} product${products.length > 1 ? 's' : ''}\n\n`;
    
    if (products.length > 3) {
      message += `*📋 ALL PRODUCTS FOUND:*\n\n`;
    } else {
      message += `*📋 PRODUCTS FOUND:*\n\n`;
    }
    
    products.forEach((product: Product, index: number) => {
      message += `${index + 1}. *${product.name}*\n`;
      message += `   💰 ${product.currency} ${product.price.toLocaleString()}\n`;
      message += `   ${product.inStock ? '✅ In Stock' : '❌ Out of Stock'}\n`;
      
      // Add shop and location info
      if (product.shopName && product.shopName !== 'Unknown Shop') {
        message += `   🏪 ${product.shopName}\n`;
      }
      
      if (product.district) {
        message += `   📍 ${product.district}`;
        if (product.location) {
          message += `, ${product.location}`;
        }
        message += `\n`;
      }
      
      message += `\n`;
    });
    
    message += `*🎯 WHAT WOULD YOU LIKE TO DO?*\n\n`;
    message += `1. Select product by number\n`;
    message += `2. New search\n`;
    message += `3. Browse categories\n`;
    message += `4. Main menu\n\n`;
    message += `*📝 TO VIEW FULL PRODUCT DETAILS:*\n`;
    message += `*Type the product number (1, 2, etc.)*\n`;
    message += `*Example:* To see details of "${products[0].name}", type *1*`;
    
    await sendText(from, message);
    return true;
  } catch (error) {
    console.error("Search error:", error);
    await sendText(from, "❌ Error searching.\n\n*Select:*\n1. Try again\n2. Browse categories\n3. Main menu");
    return true;
  }
}



export async function handleProductsInput(from: string, session: WhatsAppSession, userInput: string): Promise<boolean> {
  if (!session.products) return false;

  const text = userInput.trim();
  const productData = session.products;

  switch (productData.step) {
    case 'select_category':
      return await handleCategorySelection(from, session, text);
    case 'select_district': // CHANGED: Now handles both single and multiple districts
      return await handleDistrictOrSearchSelection(from, session, text);
    case 'show_shops':
      return await handleShopSelection(from, session, text);
    case 'show_products':
      return await handleProductSelection(from, session, text);
    case 'show_product_details':
      return await handleProductDetailsSelection(from, session, text);
    case 'search_shops':
      return await handleShopSearch(from, session, userInput);
    case 'show_shop_search_results':
      return await handleShopSelection(from, session, text);
    case 'search_products_in_shop':
      return await handleProductSearchInShop(from, session, userInput);
    case 'show_product_search_results':
      // Handle product selection from search results
      const num = parseInt(text);
      if (num >= 1 && num <= productData.products.length) {
        productData.selectedProductIndex = num - 1;
        productData.currentProductId = productData.products[num - 1].id;
        productData.step = 'show_product_details';
        return await displayProductDetails(from, session, productData, num - 1);
      } else if (num === productData.products.length + 1) {
        // New product search
        productData.step = 'search_products_in_shop';
        await sendText(from, "🔍 *SEARCH PRODUCT BY NAME*\n\nType the name of the product you're looking for:\n\n*Type 0 to go back*");
        return true;
      } else if (num === productData.products.length + 2) {
        // Browse all products
        productData.step = 'show_products';
        return await showProductsInShop(
          from, 
          session, 
          productData.currentShopOwnerId!, 
          productData.productPage || 1
        );
      } else if (num === productData.products.length + 3) {
        // Back to shops
        productData.step = 'show_shops';
        const categoryId = productData.currentCategoryId!;
        const district = productData.selectedDistrict!;
        const shopPage = productData.shopPage || 1;
        return await showShopsInDistrict(from, session, categoryId, district, shopPage);
      } else if (num === productData.products.length + 4) {
        // Main menu
        session.step = "idle";
        session.products = null;
        const { getWelcomeMenu } = await import('./utils');
        await sendText(from, getWelcomeMenu());
        return true;
      } else {
        await sendText(from, `❌ Please type a number between 1 and ${productData.products.length + 4}.`);
        return true;
      }
    case 'search_products':
      return await handleGlobalProductSearch(from, session, userInput);
    case 'show_global_search_results':
      // Handle product selection from global search results
      const searchNum = parseInt(text);
      const searchProducts = productData.products;
      
      if (searchNum >= 1 && searchNum <= searchProducts.length) {
        // Product selected - show full details
        productData.selectedProductIndex = searchNum - 1;
        productData.currentProductId = searchProducts[searchNum - 1].id;
        productData.step = 'show_product_details';
        
        // Find the shop owner for this product
        const product = searchProducts[searchNum - 1];
        if (!productData.shopOwners || productData.shopOwners.length === 0) {
          // Create a minimal shop owner object if none exists
          productData.shopOwners = [{
            id: product.shopOwnerId || "unknown",
            name: "Shop (Details not available)",
            phone: "Contact information not available",
            email: "",
            address: "Address not specified",
            categoryId: product.categoryId || ""
          }];
        }
        
        return await displayProductDetails(from, session, productData, searchNum - 1);
      } else if (searchNum === searchProducts.length + 1) {
        // New search
        productData.step = 'search_products';
        await sendText(from, "🔍 *SEARCH PRODUCTS*\n\nType what you're looking for:\n\nExamples: dress, pizza, shoes, medicine\n\n*Type your search:*\n*Type 0 to go back*");
        return true;
      } else if (searchNum === searchProducts.length + 2) {
        // Browse categories
        productData.step = 'select_category';
        return await showCategories(from, session);
      } else if (searchNum === searchProducts.length + 3) {
        // Main menu
        session.step = "idle";
        session.products = null;
        const { getWelcomeMenu } = await import('./utils');
        await sendText(from, getWelcomeMenu());
        return true;
      } else {
        await sendText(from, `❌ Please type a number between 1 and ${searchProducts.length + 3}.`);
        return true;
      }
    case 'show_location_selection':
      await sendText(from, "📍 The location-based browsing is temporarily unavailable.\n\nPlease use the category browsing instead (Option 2 from main menu).\n\n*Type 0 to go back*");
      return true;
    default:
      return false;
  }
}
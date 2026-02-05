// shop-owner.ts - COMPLETE FIXED VERSION WITH USER FEEDBACK
import { sendText } from './utils';
import { 
  WhatsAppSession,
  ShopOwnerSessionData,
  Product,
  ProductCategory
} from './types';
import { fetchCategories, createProduct } from './airtable';

// Shop Owner verification list - ADD YOUR NUMBERS HERE
export const VERIFIED_SHOP_OWNERS = [
  '265881234567', // Example Malawi number (without +)
  // ADD YOUR ACTUAL WHATSAPP NUMBERS HERE:
  '265991460309', // Your number 1
  '265999999999'  // Your number 2
];

export function isVerifiedShopOwner(phoneNumber: string): boolean {
  const isVerified = VERIFIED_SHOP_OWNERS.includes(phoneNumber);
  console.log(`🔍 Checking shop owner ${phoneNumber}: ${isVerified}`);
  return isVerified;
}

export async function startShopOwnerFlow(from: string, session: WhatsAppSession): Promise<boolean> {
  try {
    console.log(`🏪 Starting shop owner flow for ${from}`);
    
    if (!isVerifiedShopOwner(from)) {
      await sendText(from, "❌ *Access Denied*\n\nYou are not registered as a shop owner.\n\nPlease contact admin to register your shop.");
      return false;
    }

    await sendText(from, "🔄 *Loading Shop Owner Dashboard...*");
    
    const shopOwnerSessionData: ShopOwnerSessionData = {
      step: 'verified',
      pendingProduct: null,
      currentImages: [],
      currentStepData: null
    };

    session.shopOwner = shopOwnerSessionData;
    session.step = "shop_owner";

    const message = `🏪 *SHOP OWNER DASHBOARD*\n\n` +
      `*Select an option:*\n\n` +
      `1. 📦 Add New Product\n` +
      `2. 👀 View My Products\n` +
      `3. 📊 My Orders\n` +
      `0. 🏠 Main Menu\n\n` +
      `*Type the number only*`;

    await sendText(from, message);
    return true;
  } catch (error) {
    console.error("❌ Error starting shop owner flow:", error);
    await sendText(from, "❌ *Error*\n\nFailed to access shop owner dashboard. Please try again.");
    return false;
  }
}

export async function handleAddProductFlow(from: string, session: WhatsAppSession): Promise<boolean> {
  if (!session.shopOwner) return false;

  const shopOwnerData = session.shopOwner;
  
  // Start new product
  shopOwnerData.pendingProduct = {
    shopOwnerId: from, // Phone number will be used to find/create shop owner
    currency: 'MWK',
    inStock: true,
    images: []
  };
  
  shopOwnerData.currentImages = [];
  
  // Start with category selection (Step 1/5)
  shopOwnerData.step = 'add_product_category';
  session.shopOwner = shopOwnerData;

  await sendText(from, "🔄 *Loading categories...*");
  
  // Fetch categories for selection
  const categories = await fetchCategories();
  shopOwnerData.currentStepData = { categories };
  
  if (categories.length === 0) {
    await sendText(from, "❌ *No Categories Found*\n\nNo categories found in the system.\n\nPlease contact admin to add categories first.\n\nType 0 to go back.");
    return false;
  }

  let message = `🆕 *ADD NEW PRODUCT*\n\n` +
    `📋 *Step 1/5: Select Category*\n\n` +
    `Choose the category for your product:\n\n`;
  
  categories.forEach((category, index) => {
    message += `${index + 1}. ${category.icon || '📁'} ${category.name}\n`;
  });
  
  message += `\n*Type category number:*\n` +
    `*Type 0 to cancel*`;

  await sendText(from, message);
  return true;
}

export async function handleShopOwnerInput(
  from: string, 
  session: WhatsAppSession, 
  userInput: string
): Promise<boolean> {
  if (!session.shopOwner) return false;

  const text = userInput.trim();
  const shopOwnerData = session.shopOwner;

  // Handle cancellation
  if (text === '0') {
    await cancelShopOwnerFlow(from, session);
    return true;
  }

  switch (shopOwnerData.step) {
    case 'verified':
      return await handleDashboardSelection(from, session, text);
    case 'add_product_category':
      return await handleProductCategory(from, session, text);
    case 'add_product_name':
      return await handleProductName(from, session, text);
    case 'add_product_description':
      return await handleProductDescription(from, session, text);
    case 'add_product_price':
      return await handleProductPrice(from, session, text);
    case 'add_product_images':
      return await handleProductImages(from, session, text);
    case 'confirm_product':
      return await handleProductConfirmation(from, session, text);
    default:
      return false;
  }
}

async function handleDashboardSelection(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner) return false;

  if (text === '1') {
    await sendText(from, "🔄 *Starting product creation...*");
    return await handleAddProductFlow(from, session);
  } else if (text === '2') {
    await sendText(from, "📦 *MY PRODUCTS*\n\n🔧 *Feature Coming Soon!*\n\nWe're working on this feature. Stay tuned!\n\nType 0 to go back");
    return true;
  } else if (text === '3') {
    await sendText(from, "📊 *MY ORDERS*\n\n🔧 *Feature Coming Soon!*\n\nWe're working on this feature. Stay tuned!\n\nType 0 to go back");
    return true;
  } else if (text === '0') {
    await sendText(from, "🔄 *Returning to main menu...*");
    session.step = "idle";
    session.shopOwner = null;
    const { getWelcomeMenu } = await import('./utils');
    await sendText(from, getWelcomeMenu(from));
    return true;
  } else {
    await sendText(from, "❌ *Invalid Option*\n\nPlease type 1, 2, 3, or 0.");
    return true;
  }
}

async function handleProductCategory(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner || !session.shopOwner.currentStepData?.categories) return false;

  const num = parseInt(text);
  const categories = session.shopOwner.currentStepData.categories;
  
  if (isNaN(num) || num < 1 || num > categories.length) {
    await sendText(from, `❌ *Invalid Selection*\n\nPlease type a number between 1 and ${categories.length}.\n\nType 0 to cancel`);
    return true;
  }

  const selectedCategory = categories[num - 1];
  session.shopOwner.pendingProduct!.categoryId = selectedCategory.id;
  session.shopOwner.step = 'add_product_name';
  
  await sendText(from, `✅ *Step 1 Complete: Category Selected*\n\n📂 *Category:* ${selectedCategory.name}\n\n` +
    `📋 *Step 2/5: Product Name*\n\n` +
    `What is the name of your product?\n\n` +
    `*Type the product name:*\n` +
    `*Type 0 to cancel*`);

  return true;
}

async function handleProductName(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner || !session.shopOwner.pendingProduct) return false;

  if (text.length < 2) {
    await sendText(from, "❌ *Name Too Short*\n\nProduct name must be at least 2 characters.\n\nPlease enter product name:\n\nType 0 to cancel");
    return true;
  }

  session.shopOwner.pendingProduct.name = text;
  session.shopOwner.step = 'add_product_description';
  
  await sendText(from, `✅ *Step 2 Complete: Name Added*\n\n📝 *Product Name:* ${text}\n\n` +
    `📋 *Step 3/5: Product Description*\n\n` +
    `Describe your product:\n\n` +
    `*Type product description:*\n` +
    `*Type 'skip' to skip description*\n` +
    `*Type 0 to cancel*`);

  return true;
}

async function handleProductDescription(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner || !session.shopOwner.pendingProduct) return false;

  if (text.toLowerCase() === 'skip') {
    session.shopOwner.pendingProduct.description = "No description provided";
    await sendText(from, "⏭️ *Skipping description...*");
  } else {
    session.shopOwner.pendingProduct.description = text;
    await sendText(from, "✅ *Description saved!*");
  }

  // Small delay for better UX
  await new Promise(resolve => setTimeout(resolve, 500));
  
  session.shopOwner.step = 'add_product_price';
  
  await sendText(from, `✅ *Step 3 Complete: Description Added*\n\n` +
    `📋 *Step 4/5: Product Price*\n\n` +
    `What is the price in MWK?\n\n` +
    `*Type price (numbers only):*\n` +
    `💡 *Example:* 15000\n\n` +
    `*Type 0 to cancel*`);

  return true;
}

async function handleProductPrice(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner || !session.shopOwner.pendingProduct) return false;

  const price = parseFloat(text);
  if (isNaN(price) || price <= 0) {
    await sendText(from, "❌ *Invalid Price*\n\nPlease enter a valid number.\n\n💡 *Example:* 15000\n\nType 0 to cancel");
    return true;
  }

  session.shopOwner.pendingProduct.price = price;
  session.shopOwner.step = 'add_product_images';
  
  await sendText(from, `✅ *Step 4 Complete: Price Set*\n\n💰 *Price:* MWK ${price.toLocaleString()}\n\n` +
    `📋 *Step 5/5: Product Images*\n\n` +
    `Send up to 3 images of your product.\n\n` +
    `📸 *How to add images:*\n` +
    `1. Tap the 📎 attachment icon\n` +
    `2. Select 📷 Camera or 🖼️ Gallery\n` +
    `3. Choose your product image\n` +
    `4. Send the image\n\n` +
    `*After sending images:*\n` +
    `• Type 'done' when finished\n` +
    `• Type 0 to cancel`);

  return true;
}

async function handleProductImages(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner) return false;

  const shopOwnerData = session.shopOwner;
  
  if (text.toLowerCase() === 'done') {
    if (shopOwnerData.currentImages.length === 0) {
      await sendText(from, "⚠️ *No Images Added*\n\nContinue without images?\n\n" +
        "1. ✅ Yes, continue without images\n" +
        "2. 📸 Add images\n" +
        "0. ❌ Cancel");
      return true;
    }
    
    // Store images in pending product
    if (shopOwnerData.pendingProduct) {
      shopOwnerData.pendingProduct.images = shopOwnerData.currentImages;
    }
    
    shopOwnerData.step = 'confirm_product';
    await showProductConfirmation(from, session);
    return true;
  }

  return true;
}

async function showProductConfirmation(from: string, session: WhatsAppSession): Promise<void> {
  if (!session.shopOwner || !session.shopOwner.pendingProduct) return;

  const product = session.shopOwner.pendingProduct;
  const categories = session.shopOwner.currentStepData?.categories || [];
  
  let message = `📋 *PRODUCT CONFIRMATION*\n\n`;
  message += `*Here's what we'll save:*\n\n`;
  message += `📝 *Name:* ${product.name}\n`;
  message += `📄 *Description:* ${product.description}\n`;
  
  // Show category name
  if (product.categoryId && categories.length > 0) {
    const category = categories.find((c: ProductCategory) => c.id === product.categoryId);
    if (category) {
      message += `📂 *Category:* ${category.name}\n`;
    }
  }
  
  message += `💰 *Price:* ${product.currency || 'MWK'} ${product.price?.toLocaleString()}\n`;
  
  if (product.images && product.images.length > 0) {
    message += `📸 *Images:* ${product.images.length} uploaded\n`;
  } else {
    message += `📸 *Images:* No images (optional)\n`;
  }
  
  message += `\n*Is this correct?*\n\n`;
  message += `1. ✅ Yes, save product now\n`;
  message += `2. ✏️ Edit product details\n`;
  message += `0. ❌ Cancel & discard\n\n`;
  message += `*Type the number only*`;

  await sendText(from, message);
}

async function handleProductConfirmation(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.shopOwner || !session.shopOwner.pendingProduct) return false;

  if (text === '1') {
    await sendText(from, "🔄 *Saving your product to catalog...*");
    await saveProductToAirtable(from, session);
    return true;
  } else if (text === '2') {
    await sendText(from, "✏️ *Editing product...*");
    session.shopOwner.step = 'add_product_category';
    
    const categories = session.shopOwner.currentStepData?.categories || [];
    let message = `✏️ *EDITING PRODUCT*\n\n` +
      `📋 *Step 1/5: Select Category*\n\n` +
      `Choose the category for your product:\n\n`;
    
    categories.forEach((category: ProductCategory, index: number) => {
      message += `${index + 1}. ${category.icon || '📁'} ${category.name}\n`;
    });
    
    message += `\n*Type category number:*\n` +
      `*Type 0 to cancel*`;
    
    await sendText(from, message);
    return true;
  } else if (text === '0') {
    await cancelShopOwnerFlow(from, session);
    return true;
  } else {
    await sendText(from, "❌ *Invalid Option*\n\nPlease type 1, 2, or 0.");
    return true;
  }
}


// Update the saveProductToAirtable function
async function saveProductToAirtable(from: string, session: WhatsAppSession): Promise<void> {
  if (!session.shopOwner || !session.shopOwner.pendingProduct) return;

  try {
    // Create complete product object WITHOUT categoryId
    const productData = {
      ...session.shopOwner.pendingProduct,
      id: `PROD-${Date.now().toString().slice(-8)}`,
      inStock: true,
      specifications: 'Added via WhatsApp',
      createdDate: new Date().toISOString().split('T')[0],
      currency: 'MWK'
    } as Product;
    
    console.log("💾 Saving product to Airtable:", JSON.stringify(productData, null, 2));
    
    const success = await createProduct(productData);
    
    if (success) {
      await sendText(from, "🎉 *PRODUCT SAVED SUCCESSFULLY!*\n\n" +
        `✅ *${productData.name}* is now in your catalog!\n\n` +
        `📋 *Product Details:*\n` +
        `• Name: ${productData.name}\n` +
        `• Price: MWK ${productData.price?.toLocaleString()}\n` +
        `• Status: ✅ Active\n\n` +
        `*What would you like to do next?*\n\n` +
        `1. 📦 Add another product\n` +
        `2. 🏪 Shop owner dashboard\n` +
        `3. 🏠 Main menu\n\n` +
        `*Type the number only*`);
      
      // Reset for next product
      session.shopOwner.pendingProduct = null;
      session.shopOwner.currentImages = [];
      session.shopOwner.currentStepData = null;
      session.shopOwner.step = 'verified';
    } else {
      await sendText(from, "❌ *Save Failed*\n\nFailed to save product. Please check your Airtable configuration and try again.\n\n" +
        "*Options:*\n" +
        "1. 🔄 Try saving again\n" +
        "2. ✏️ Edit product details\n" +
        "0. ❌ Cancel");
      session.shopOwner.step = 'confirm_product';
    }
  } catch (error) {
    console.error("❌ Error saving product:", error);
    await sendText(from, "⚠️ *System Error*\n\nError saving product. Please try again.\n\n" +
      "*Options:*\n" +
      "1. 🔄 Try saving again\n" +
      "2. ✏️ Edit product details\n" +
      "0. ❌ Cancel");
  }
}

async function cancelShopOwnerFlow(from: string, session: WhatsAppSession): Promise<void> {
  await sendText(from, "🔄 *Cancelling operation...*");
  session.shopOwner = null;
  session.step = "idle";
  
  const { getWelcomeMenu } = await import('./utils');
  await sendText(from, "❌ *Operation cancelled.*\n\n" + getWelcomeMenu(from));
}

// Handle image messages - IMPROVED WITH BETTER FEEDBACK
export async function handleShopOwnerImage(
  from: string, 
  session: WhatsAppSession, 
  imageUrl: string
): Promise<boolean> {
  console.log(`🖼️ Handling shop owner image for ${from}`);
  
  if (!session.shopOwner || session.shopOwner.step !== 'add_product_images') {
    console.log(`❌ Not in image upload step or no shop owner session`);
    return false;
  }

  const shopOwnerData = session.shopOwner;
  
  // Check if we've reached max images
  if (shopOwnerData.currentImages.length >= 3) {
    await sendText(from, "✅ *Maximum Images Reached!*\n\n" +
      "You've added 3 images (maximum).\n\n" +
      "*Options:*\n" +
      "• Type 'done' to continue\n" +
      "• Type 0 to cancel");
    return true;
  }
  
  // Add image URL to current images
  shopOwnerData.currentImages.push(imageUrl);
  
  console.log(`✅ Image added. Total: ${shopOwnerData.currentImages.length}/3`);
  
  await sendText(from, `✅ *Image Upload Successful!*\n\n` +
    `📸 *Progress:* ${shopOwnerData.currentImages.length}/3 images added\n\n` +
    `*Options:*\n` +
    `• Send another image (${3 - shopOwnerData.currentImages.length} remaining)\n` +
    `• Type 'done' to finish\n` +
    `• Type 0 to cancel`);
    
  return true;
}

// Helper function to provide better user guidance
export function getProductCreationGuide(): string {
  return `📋 *PRODUCT CREATION GUIDE*\n\n` +
    `*Step-by-Step Process:*\n\n` +
    `1️⃣ *Category* - Choose product category\n` +
    `2️⃣ *Name* - Enter product name\n` +
    `3️⃣ *Description* - Describe your product\n` +
    `4️⃣ *Price* - Set price in MWK\n` +
    `5️⃣ *Images* - Add up to 3 photos\n\n` +
    `💡 *Tips:*\n` +
    `• Use clear, descriptive names\n` +
    `• Add multiple images from different angles\n` +
    `• Set competitive pricing\n` +
    `• Type '0' anytime to cancel`;
}
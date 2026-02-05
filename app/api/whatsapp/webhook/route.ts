// route.ts - FIXED VERSION WITH CORRECT IMPORTS
import { NextRequest, NextResponse } from "next/server";
import { sessionManager } from "./session";
import { sendText, getWelcomeMenu, getHelpMenu } from "./utils";
// Remove startProductsFlow from import since it doesn't exist
import { handleProductsInput, startCategorySelection } from "./products";
import { testAirtableConnection } from "./airtable";
import { checkOrderStatus, handleOrderInput } from "./orders";
import { 
  startShopOwnerFlow, 
  handleShopOwnerInput, 
  handleShopOwnerImage,
  isVerifiedShopOwner 
} from "./shop-owner";
import { downloadAndSaveImage, isValidImageUrl, getImageProcessingMessage, getImageSuccessMessage, isWhatsAppImageUrl } from "./image-upload";

let airtableConnected = false;

// Send processing message
async function sendProcessingMessage(phoneNumber: string, message: string): Promise<void> {
  await sendText(phoneNumber, `⏳ *${message}*\n\nPlease wait...`);
}

export async function POST(req: NextRequest) {
  let from = ""; // Declare from variable at function scope
  
  try {
    console.log("📱 WhatsApp webhook called");
    
    const body = await req.json();
    console.log("📦 Request body type:", body.object);
    
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const msg = value?.messages?.[0];
    
    if (!msg) {
      console.log("📭 No message in request");
      return NextResponse.json({ ok: true });
    }

    from = msg.from; // Assign to the outer variable
    const msgType = msg.type;
    
    console.log(`👤 [${from}] Message type: ${msgType}`);

    // Test Airtable connection on first request
    if (!airtableConnected) {
      console.log("🔌 Testing Airtable connection...");
      airtableConnected = await testAirtableConnection();
      console.log("✅ Airtable connected:", airtableConnected);
      
      if (!airtableConnected) {
        await sendText(from, "⚠️ *System Setup*\n\nOur system is currently setting up. Please wait a moment and try again.");
        return NextResponse.json({ success: true });
      }
    }

    // Get or create session
    let session = sessionManager.getSession(from);
    if (!session) {
      console.log(`🆕 Creating new session for ${from}`);
      session = sessionManager.createSession(from);
      
      await sendText(from, getWelcomeMenu(from));
      return NextResponse.json({ success: true });
    }

    // Handle image messages
    if (msgType === 'image') {
      console.log(`🖼️ [${from}] Received image`);
      
      const image = msg.image;
      if (image && image.id) {
        console.log(`🖼️ [${from}] Image ID: ${image.id}`);
        
        // Send immediate feedback
        await sendText(from, getImageProcessingMessage());
        
        try {
          // Get image URL from WhatsApp API
          const imageUrl = await getWhatsAppMediaUrl(image.id);
          
          if (imageUrl) {
            console.log(`✅ [${from}] Image URL obtained`);
            console.log(`📷 Image URL: ${imageUrl.substring(0, 80)}...`);
            
            // Check if this is a WhatsApp image URL
            if (isWhatsAppImageUrl(imageUrl)) {
              console.log(`✅ [${from}] This is a WhatsApp image URL, accepting it`);
              
              // Check if in shop owner product image flow
              if (session.step === "shop_owner" && session.shopOwner?.step === 'add_product_images') {
                console.log(`🛍️ [${from}] In shop owner image upload flow`);
                
                // WhatsApp URLs work directly - no need to download
                const savedImageUrl = imageUrl;
                
                if (savedImageUrl) {
                  console.log(`✅ [${from}] WhatsApp image ready for upload`);
                  await handleShopOwnerImage(from, session, savedImageUrl);
                } else {
                  console.error(`❌ [${from}] Failed to process WhatsApp image`);
                  await sendText(from, "❌ *Image Processing Failed*\n\nPlease try sending the image again.");
                }
                return NextResponse.json({ success: true });
              }
              
              // If not in shop owner flow
              await sendText(from, "📸 *Image Received!*\n\nTo add products as a shop owner, type '6' to access your dashboard.\n\nFor browsing products, please use the main menu.");
            } else {
              // Validate the image URL for non-WhatsApp images
              if (!isValidImageUrl(imageUrl)) {
                console.error(`❌ [${from}] Invalid image URL format`);
                await sendText(from, "❌ *Invalid Image*\n\nPlease send a valid image (JPG, PNG, etc.).");
                return NextResponse.json({ success: true });
              }
              
              // Handle non-WhatsApp image
              console.log(`✅ [${from}] Valid non-WhatsApp image, processing...`);
              const savedImageUrl = await downloadAndSaveImage(imageUrl);
              
              if (savedImageUrl) {
                // Check if in shop owner product image flow
                if (session.step === "shop_owner" && session.shopOwner?.step === 'add_product_images') {
                  console.log(`🛍️ [${from}] In shop owner image upload flow`);
                  await handleShopOwnerImage(from, session, savedImageUrl);
                } else {
                  await sendText(from, "📸 *Image Saved!*\n\nTo add products as a shop owner, type '6' to access your dashboard.\n\nFor browsing products, please use the main menu.");
                }
              } else {
                await sendText(from, "❌ *Image Upload Failed*\n\nCould not save image. Please try again.");
              }
            }
          } else {
            console.error(`❌ [${from}] Failed to get image URL`);
            await sendText(from, "❌ *Image Error*\n\nFailed to get image from WhatsApp. Please try again.");
          }
        } catch (error) {
          console.error(`❌ [${from}] Error processing image:`, error);
          await sendText(from, "⚠️ *Network Issue*\n\nHaving trouble processing your image. Please try again in a moment.");
        }
      } else {
        console.error(`❌ [${from}] No image data in message`);
        await sendText(from, "❌ *No Image Data*\n\nPlease send a valid image.");
      }
      
      return NextResponse.json({ success: true });
    }

    // Handle text messages
    const rawText = msg.text?.body?.trim() || "";
    const text = rawText.toLowerCase();

    console.log(`💬 [${from}] Received text: "${rawText}"`);

    // Handle main menu command
    if (text === "0" || text === "menu" || text === "home" || text === "main") {
      console.log(`🏠 [${from}] Resetting session to main menu`);
      sessionManager.resetSession(from);
      await sendText(from, getWelcomeMenu(from));
      return NextResponse.json({ success: true });
    }

    // Handle help command
    if (text === "help" || text === "support") {
      console.log(`❓ [${from}] Requesting help`);
      await sendText(from, getHelpMenu());
      return NextResponse.json({ success: true });
    }

    // Handle shop owner access via command
    if (text === "shop" || text === "owner" || text === "dashboard") {
      console.log(`🏪 [${from}] Shop owner command detected`);
      if (isVerifiedShopOwner(from)) {
        console.log(`✅ [${from}] Starting shop owner flow`);
        await startShopOwnerFlow(from, session);
      } else {
        console.log(`❌ [${from}] Not a verified shop owner`);
        await sendText(from, "❌ *Shop Owner Access Denied*\n\nYou are not registered as a shop owner.\n\nPlease contact admin to register your shop.");
      }
      return NextResponse.json({ success: true });
    }

    // Check if in shop owner flow
    if (session.step === "shop_owner") {
      console.log(`🛍️ [${from}] Processing shop owner flow`);
      const handled = await handleShopOwnerInput(from, session, rawText);
      if (!handled) {
        console.log(`🔄 [${from}] Shop owner flow not handled, resetting to menu`);
        sessionManager.resetSession(from);
        await sendText(from, getWelcomeMenu(from));
      }
      return NextResponse.json({ success: true });
    }

    // Check if in order flow
    if (session.step === "order") {
      console.log(`📦 [${from}] Processing order flow`);
      const handled = await handleOrderInput(from, session, rawText);
      if (!handled) {
        sessionManager.resetSession(from);
        await sendText(from, getWelcomeMenu(from));
      }
      return NextResponse.json({ success: true });
    }

    // Check if in products flow
    if (session.step === "products") {
      console.log(`🛒 [${from}] Processing products flow`);
      
      // Already in products flow, handle input
      console.log(`➡️ [${from}] Continuing products flow`);
      const shouldContinue = await handleProductsInput(from, session, rawText);
      if (!shouldContinue) {
        // Return to main menu
        console.log(`🏠 [${from}] Returning to main menu`);
        sessionManager.resetSession(from);
        await sendText(from, getWelcomeMenu(from));
      }
      
      return NextResponse.json({ success: true });
    }

    // Handle main menu options
    if (session.step === "idle") {
      console.log(`📋 [${from}] Processing main menu option: ${text}`);
      
      if (text === "1") {
        // Browse by Location - Redirect to new category flow for now
        console.log(`📍 [${from}] Option 1: Browse by Location (Redirecting to Categories)`);
        await sendText(from, "📍 *Location browsing is temporarily unavailable*\n\nRedirecting you to category browsing instead...");
        
        try {
          const started = await startCategorySelection(from, session);
          if (!started) {
            await sendText(from, getWelcomeMenu(from));
          }
        } catch (error) {
          console.error("Error starting category selection:", error);
          await sendText(from, "❌ Error starting category browsing.\n\n" + getWelcomeMenu(from));
        }
      } else if (text === "2") {
        // Browse Categories (NEW FLOW: Category → District → Shop → Product)
        console.log(`📁 [${from}] Option 2: Browse Categories (New Flow)`);
        
        try {
          const started = await startCategorySelection(from, session);
          if (!started) {
            await sendText(from, getWelcomeMenu(from));
          }
        } catch (error) {
          console.error("Error starting category selection:", error);
          await sendText(from, "❌ Error starting category browsing.\n\n" + getWelcomeMenu(from));
        }
      } else if (text === "3") {
        // Search products
        console.log(`🔍 [${from}] Option 3: Search products`);
        session.step = "products";
        session.products = {
          step: 'search_products',
          categories: [],
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
        await sendText(from, "🔍 *SEARCH PRODUCTS*\n\nType what you're looking for:\n\nExamples: dress, pizza, shoes, medicine\n\n*Type your search:*\n*Type 0 to go back*");
      } else if (text === "4") {
        // My Orders
        console.log(`📦 [${from}] Option 4: My Orders`);
        await checkOrderStatus(from, session);
      } else if (text === "5") {
        // Help & Support
        console.log(`❓ [${from}] Option 5: Help & Support`);
        await sendText(from, getHelpMenu());
      } else if (text === "6") {
        // Shop Owner Dashboard
        console.log(`🏪 [${from}] Option 6: Shop Owner Dashboard`);
        if (isVerifiedShopOwner(from)) {
          console.log(`✅ [${from}] Starting shop owner flow`);
          await startShopOwnerFlow(from, session);
        } else {
          console.log(`❌ [${from}] Not a verified shop owner`);
          await sendText(from, "❌ *Access Denied*\n\nYou are not registered as a shop owner.\n\nPlease contact admin to register your shop.\n\n" + getWelcomeMenu(from));
        }
      } else {
        // Default response - show menu again
        console.log(`❌ [${from}] Invalid option, showing menu again`);
        await sendText(from, "❌ *Invalid Option*\n\nPlease select a valid option from the menu:\n\n" + getWelcomeMenu(from));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("💥 Webhook error:", error);
    
    // Check if 'from' is defined before using it
    if (from) {
      await sendText(from, "⚠️ *System Error*\n\nAn error occurred. Please try again.");
    }
    
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to get WhatsApp media URL - WITH RETRY LOGIC
async function getWhatsAppMediaUrl(mediaId: string, retries = 3): Promise<string | null> {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    const whatsappToken = process.env.WHATSAPP_TOKEN;
    
    if (!phoneNumberId || !whatsappToken) {
      console.error('❌ WhatsApp configuration missing for media URL');
      return null;
    }

    console.log(`📥 Fetching media URL for ID: ${mediaId}`);
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const urlResponse = await fetch(
        `https://graph.facebook.com/v18.0/${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!urlResponse.ok) {
        console.error("❌ Failed to get media URL:", await urlResponse.text());
        
        // Retry logic
        if (retries > 0) {
          console.log(`🔄 Retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return getWhatsAppMediaUrl(mediaId, retries - 1);
        }
        
        return null;
      }
      
      const data = await urlResponse.json();
      const mediaUrl = data.url;
      
      if (!mediaUrl) {
        console.error("❌ No URL in media response:", data);
        return null;
      }
      
      console.log(`✅ Got media URL (first 80 chars): ${mediaUrl.substring(0, 80)}...`);
      
      return mediaUrl;
      
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error("❌ Request timeout getting media URL");
      } else {
        console.error("❌ Fetch error getting media URL:", fetchError);
      }
      
      // Retry logic
      if (retries > 0) {
        console.log(`🔄 Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getWhatsAppMediaUrl(mediaId, retries - 1);
      }
      
      return null;
    }
    
  } catch (error) {
    console.error("❌ Error getting media URL:", error);
    
    // Final retry
    if (retries > 0) {
      console.log(`🔄 Final retry attempt...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getWhatsAppMediaUrl(mediaId, retries - 1);
    }
    
    return null;
  }
}

export async function GET(req: NextRequest) {
  console.log("🔐 WhatsApp verification called");
  
  const { searchParams } = new URL(req.url);
  const verifyToken = process.env.VERIFY_TOKEN;
  const hubChallenge = searchParams.get("hub.challenge");
  
  console.log(`🔑 Verify token from params: ${searchParams.get("hub.verify_token")}`);
  console.log(`Expected verify token: ${verifyToken}`);
  console.log(`Hub challenge: ${hubChallenge}`);
  
  if (searchParams.get("hub.verify_token") === verifyToken) {
    console.log("✅ Verification successful, returning challenge");
    return new Response(hubChallenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  console.log("❌ Verification failed");
  return new Response("Forbidden", { status: 403 });
}
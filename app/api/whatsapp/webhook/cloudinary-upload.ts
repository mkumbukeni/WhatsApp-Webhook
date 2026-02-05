// cloudinary-upload.ts - COMPLETE FIXED VERSION
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

console.log('🔧 Cloudinary Configuration:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing',
  hasAll: !!(process.env.CLOUDINARY_CLOUD_NAME && 
             process.env.CLOUDINARY_API_KEY && 
             process.env.CLOUDINARY_API_SECRET)
});

// Test Cloudinary credentials on startup
async function testCloudinarySetup(): Promise<void> {
  try {
    console.log('🔐 Testing Cloudinary connection...');
    const result = await cloudinary.api.ping();
    
    if (result.status === 'ok') {
      console.log('✅ Cloudinary credentials are VALID and working');
      console.log('✅ Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
      console.log('✅ API Key:', process.env.CLOUDINARY_API_KEY?.substring(0, 8) + '...');
    } else {
      console.error('❌ Cloudinary ping returned unexpected result:', result);
    }
  } catch (error: any) {
    console.error('❌ Cloudinary connection test FAILED:', error.message);
    
    if (error.message.includes('Invalid Signature')) {
      console.error('🔐 CRITICAL ERROR: Invalid Cloudinary API Signature!');
      console.error('💡 SOLUTION:');
      console.error('1. Go to https://cloudinary.com/console');
      console.error('2. Click "Account Details"');
      console.error('3. Scroll to "API Key" section');
      console.error('4. Click "Regenerate" for both API Key and Secret');
      console.error('5. Update your .env.local file with new values');
      console.error('6. Restart your server');
    }
  }
}

// Run test on startup
testCloudinarySetup();

// Upload single image to Cloudinary - WITH WHATSAPP LIMITATION HANDLING
export async function uploadToCloudinary(imageUrl: string): Promise<string | null> {
  try {
    console.log(`📤 Processing image: ${imageUrl.substring(0, 80)}...`);
    
    // Check if it's a WhatsApp URL
    if (isWhatsAppUrl(imageUrl)) {
      console.log("📱 WhatsApp image detected");
      console.log("⚠️ IMPORTANT: WhatsApp URLs are PRIVATE and expire in 2 hours");
      console.log("⚠️ Cloudinary cannot download them (401 Unauthorized)");
      console.log("💡 Returning WhatsApp URL as-is (temporary solution)");
      
      // WhatsApp Business API images are private and cannot be downloaded by Cloudinary
      // They return 401 Unauthorized when accessed without proper authentication
      return imageUrl;
    }
    
    // For non-WhatsApp URLs, try Cloudinary upload
    console.log("☁️ Attempting Cloudinary upload...");
    
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'whatsapp-products',
      resource_type: 'auto',
      timeout: 10000, // 10 second timeout
    });
    
    console.log(`✅ Successfully uploaded to Cloudinary`);
    console.log(`📎 Cloudinary URL: ${result.secure_url.substring(0, 80)}...`);
    
    return result.secure_url;
    
  } catch (error: any) {
    console.error('❌ Cloudinary upload failed:', error.message);
    
    // Specific error handling
    if (error.message.includes('Invalid Signature')) {
      console.error('🔐 SIGNATURE ERROR: Cloudinary API credentials are incorrect!');
    } else if (error.message.includes('401')) {
      console.error('🔐 UNAUTHORIZED: Cannot access this URL (might be private)');
    } else if (error.message.includes('404')) {
      console.error('🔍 NOT FOUND: Image URL does not exist');
    }
    
    // Return original URL as fallback
    console.log('🔄 Returning original URL as fallback');
    return imageUrl;
  }
}

// Upload multiple images to Cloudinary
export async function uploadMultipleToCloudinary(imageUrls: string[]): Promise<string[]> {
  console.log(`🖼️ Starting batch upload of ${imageUrls.length} images...`);
  
  const results: string[] = [];
  let cloudinaryCount = 0;
  let whatsappCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    console.log(`📸 Processing image ${i + 1}/${imageUrls.length}...`);
    
    try {
      const result = await uploadToCloudinary(url);
      
      if (result) {
        results.push(result);
        
        // Categorize the result
        if (isWhatsAppUrl(result)) {
          whatsappCount++;
          console.log(`⚠️ Image ${i + 1}: WhatsApp URL (expires in 2 hours)`);
        } else if (result.includes('cloudinary.com')) {
          cloudinaryCount++;
          console.log(`✅ Image ${i + 1}: Cloudinary URL (permanent)`);
        } else {
          console.log(`ℹ️ Image ${i + 1}: Other URL`);
        }
      } else {
        failedCount++;
        results.push(url); // Use original as fallback
        console.error(`❌ Image ${i + 1}: Upload failed, using original`);
      }
    } catch (error) {
      failedCount++;
      results.push(url); // Use original as fallback
      console.error(`❌ Image ${i + 1}: Error, using original`);
    }
    
    // Rate limiting delay
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
  
  // Summary report
  console.log('📊 UPLOAD SUMMARY:');
  console.log(`  ✅ Cloudinary URLs: ${cloudinaryCount} (permanent storage)`);
  console.log(`  ⚠️ WhatsApp URLs: ${whatsappCount} (expire in 2 hours)`);
  console.log(`  ❌ Failed uploads: ${failedCount}`);
  console.log(`  📦 Total processed: ${results.length}/${imageUrls.length}`);
  
  if (whatsappCount > 0) {
    console.warn('⚠️ WARNING: WhatsApp URLs will expire in 2 hours!');
    console.warn('💡 Airtable cannot display these after expiration');
    console.warn('🔧 For permanent storage, consider:');
    console.warn('   1. WhatsApp Business API with media permissions');
    console.warn('   2. Asking users to upload to public hosting first');
  }
  
  return results;
}

// Check if URL is WhatsApp
export function isWhatsAppUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  const urlLower = url.toLowerCase();
  return urlLower.includes('lookaside.fbsbx.com') || 
         urlLower.includes('whatsapp.net') || 
         urlLower.includes('fbcdn.net') ||
         urlLower.includes('facebook.com');
}

// Health check for Cloudinary
export async function checkCloudinaryHealth(): Promise<{
  healthy: boolean;
  message: string;
  cloudName: string;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
}> {
  try {
    const result = await cloudinary.api.ping();
    
    return {
      healthy: result.status === 'ok',
      message: result.status === 'ok' 
        ? '✅ Cloudinary is properly configured and working'
        : '❌ Cloudinary ping failed',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'Not set',
      apiKeyConfigured: !!process.env.CLOUDINARY_API_KEY,
      apiSecretConfigured: !!process.env.CLOUDINARY_API_SECRET
    };
  } catch (error: any) {
    return {
      healthy: false,
      message: `❌ Cloudinary error: ${error.message}`,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'Not set',
      apiKeyConfigured: !!process.env.CLOUDINARY_API_KEY,
      apiSecretConfigured: !!process.env.CLOUDINARY_API_SECRET
    };
  }
}

// Get Cloudinary configuration status
export function getCloudinaryConfigStatus(): {
  configured: boolean;
  missing: string[];
  details: Record<string, string>;
} {
  const missing: string[] = [];
  const details: Record<string, string> = {};
  
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
  
  details.cloud_name = process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing';
  details.api_key = process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing';
  details.api_secret = process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing';
  
  return {
    configured: missing.length === 0,
    missing,
    details
  };
}
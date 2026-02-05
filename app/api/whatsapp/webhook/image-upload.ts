// image-upload.ts - FIXED VERSION
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

console.log('Cloudinary Config Check:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
});

// Cloudinary upload function - FIXED
async function uploadToCloudinary(imageUrl: string): Promise<string | null> {
  try {
    console.log(`☁️ Uploading to Cloudinary: ${imageUrl.substring(0, 80)}...`);
    
    // For WhatsApp URLs, we need to handle differently
    if (isWhatsAppImageUrl(imageUrl)) {
      console.log("📱 WhatsApp image detected");
      
      // Try to download first, then upload
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Upload from buffer
        const result = await cloudinary.uploader.upload(
          `data:${contentType};base64,${buffer.toString('base64')}`,
          {
            folder: 'whatsapp-products',
            resource_type: 'auto',
          }
        );
        
        console.log(`✅ WhatsApp image uploaded to Cloudinary`);
        return result.secure_url;
      } catch (downloadError) {
        console.error("❌ Error downloading WhatsApp image:", downloadError);
        return imageUrl; // Return original
      }
    }
    
    // For regular URLs
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'whatsapp-products',
      resource_type: 'auto',
    });
    
    console.log(`✅ Uploaded to Cloudinary`);
    return result.secure_url;
    
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    
    // Check for signature error
    if (error && typeof error === 'object' && 'message' in error) {
      const errMsg = String((error as any).message);
      if (errMsg.includes('Invalid Signature')) {
        console.error('🔐 ERROR: Invalid Cloudinary signature!');
        console.error('💡 Fix: Check CLOUDINARY_API_SECRET in .env.local');
        console.error('💡 Regenerate in Cloudinary Dashboard if needed');
      }
    }
    
    return null;
  }
}

// Main function to process images
export async function downloadAndSaveImage(imageUrl: string): Promise<string | null> {
  try {
    console.log(`🖼️ Processing image...`);
    console.log(`📥 Image URL starts with: ${imageUrl.substring(0, 80)}...`);
    
    // If it's already a Cloudinary URL, return it
    if (imageUrl.includes('cloudinary.com') || 
        imageUrl.includes('res.cloudinary.com')) {
      console.log("✅ Already a Cloudinary URL");
      return imageUrl;
    }
    
    // If it's a WhatsApp URL
    if (isWhatsAppImageUrl(imageUrl)) {
      console.log("📱 WhatsApp image, uploading to Cloudinary...");
      
      // Check Cloudinary config first
      if (!process.env.CLOUDINARY_API_SECRET) {
        console.error("❌ Cloudinary not configured!");
        console.warn("⚠️ Returning WhatsApp URL (will expire)");
        return imageUrl;
      }
      
      const cloudinaryUrl = await uploadToCloudinary(imageUrl);
      return cloudinaryUrl;
    }
    
    // For other URLs
    console.log("📥 Processing external image...");
    const cloudinaryUrl = await uploadToCloudinary(imageUrl);
    return cloudinaryUrl;
    
  } catch (error) {
    console.error("❌ Error processing image:", error);
    return null;
  }
}

export function isValidImageUrl(url: string): boolean {
  if (!url) {
    console.log("❌ No URL provided");
    return false;
  }
  
  try {
    new URL(url);
    
    const urlLower = url.toLowerCase();
    
    // WhatsApp URLs are valid
    const isWhatsAppUrl = isWhatsAppImageUrl(url);
    
    // Check for common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => urlLower.includes(ext));
    
    // Cloudinary URLs are always valid
    const isCloudinaryUrl = urlLower.includes('cloudinary.com') || urlLower.includes('res.cloudinary.com');
    
    const isValid = isWhatsAppUrl || hasImageExtension || isCloudinaryUrl;
    
    console.log(`✅ Valid image URL detected (WhatsApp: ${isWhatsAppUrl}, Cloudinary: ${isCloudinaryUrl})`);
    
    return isValid;
  } catch {
    console.log("❌ Invalid URL format");
    return false;
  }
}

// Function to handle WhatsApp image URLs specifically
export function isWhatsAppImageUrl(url: string): boolean {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  return urlLower.includes('lookaside.fbsbx.com') || 
         urlLower.includes('whatsapp.net') || 
         urlLower.includes('fbcdn.net');
}

// Function to upload multiple images to Cloudinary
export async function uploadMultipleImages(imageUrls: string[]): Promise<string[]> {
  const uploadedUrls: string[] = [];
  
  console.log(`☁️ Starting batch upload of ${imageUrls.length} images to Cloudinary...`);
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    console.log(`📤 Uploading image ${i + 1}/${imageUrls.length}...`);
    
    const uploadedUrl = await downloadAndSaveImage(url);
    if (uploadedUrl) {
      uploadedUrls.push(uploadedUrl);
      console.log(`✅ Image ${i + 1} uploaded successfully`);
    } else {
      console.error(`❌ Failed to upload image ${i + 1}, using original`);
      uploadedUrls.push(url); // Use original as fallback
    }
    
    // Small delay to avoid rate limiting
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`✅ Batch upload complete: ${uploadedUrls.length}/${imageUrls.length} images uploaded`);
  return uploadedUrls;
}

export function getImageProcessingMessage(): string {
  return "🖼️ *Processing your image...*\n\nPlease wait while we save your image to secure storage.\n\n⏳ This may take a moment.";
}

export function getImageSuccessMessage(count: number): string {
  return `✅ *Image uploaded successfully!*\n\n${count} image${count > 1 ? 's' : ''} saved to secure storage.\n\n*Options:*\n• Send another image\n• Type 'done' to finish\n• Type 0 to cancel`;
}

// Helper function to check if Cloudinary is configured
export function isCloudinaryConfigured(): boolean {
  const hasCloudName = !!process.env.CLOUDINARY_CLOUD_NAME;
  const hasApiKey = !!process.env.CLOUDINARY_API_KEY;
  const hasApiSecret = !!process.env.CLOUDINARY_API_SECRET;
  
  const isConfigured = hasCloudName && hasApiKey && hasApiSecret;
  
  console.log("☁️ Cloudinary configuration check:", {
    hasCloudName,
    hasApiKey,
    hasApiSecret,
    isConfigured
  });
  
  return isConfigured;
}
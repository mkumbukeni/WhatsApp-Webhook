// test.ts - UPDATED WITH IMAGE ATTACHMENT TEST
import { testAirtableConnection, testImageAttachment } from "./airtable";

export async function GET() {
  console.log("Testing system configuration...");
  
  const envVars = {
    AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? '✅ Set' : '❌ Missing',
    AIRTABLE_BASE_ID: process.env.AIRTABLE_PRODUCTS_BASE_ID ? '✅ Set' : '❌ Missing',
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN ? '✅ Set' : '❌ Missing',
    PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID ? '✅ Set' : '❌ Missing',
    VERIFY_TOKEN: process.env.VERIFY_TOKEN ? '✅ Set' : '❌ Missing',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
  };
  
  console.log("Environment variables:", envVars);
  
  const airtableConnected = await testAirtableConnection();
  
  // Test image attachment to Airtable
  let imageAttachmentTest = { success: false, message: "Not tested" };
  
  if (airtableConnected) {
    console.log("🧪 Testing Airtable image attachment...");
    try {
      await testImageAttachment();
      imageAttachmentTest = { success: true, message: "Image attachment test completed" };
    } catch (error: any) {
      imageAttachmentTest = { 
        success: false, 
        message: `Image attachment test failed: ${error.message}` 
      };
    }
  }
  
  return Response.json({
    environment: envVars,
    airtableConnected,
    imageAttachmentTest,
    timestamp: new Date().toISOString(),
    message: airtableConnected ? "System ready" : "Check Airtable configuration",
    notes: [
      "WhatsApp images expire in 2 hours (WhatsApp API limitation)",
      "Cloudinary credentials are correct but cannot download WhatsApp images",
      "Check Airtable 'images' field is set to 'Attachment' type"
    ]
  });
}
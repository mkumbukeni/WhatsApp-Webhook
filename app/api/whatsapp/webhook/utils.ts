// utils.ts - UPDATED WITH 6 OPTIONS AND LOCATION-BASED BROWSING
export async function sendText(to: string, body: string): Promise<boolean> {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    const whatsappToken = process.env.WHATSAPP_TOKEN;
    
    console.log('Sending WhatsApp message to:', to);
    console.log('Message length:', body.length);

    if (!phoneNumberId || !whatsappToken) {
      console.error('WhatsApp configuration missing');
      return false;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          text: { body },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send text:", response.status, errorText);
      return false;
    }
    
    console.log('Message sent successfully');
    return true;
  } catch (error) {
    console.error("Error sending text:", error);
    return false;
  }
}

export async function sendImage(to: string, imageData: any, caption: string = ""): Promise<boolean> {
  try {
    const phoneNumberId = process.env.PHONE_NUMBER_ID;
    const whatsappToken = process.env.WHATSAPP_TOKEN;
    
    let imageUrl: string;
    
    if (typeof imageData === 'string') {
      imageUrl = imageData;
    } else if (imageData && typeof imageData === 'object') {
      if (imageData.url) {
        imageUrl = imageData.url;
      } else if (imageData.thumbnails?.full?.url) {
        imageUrl = imageData.thumbnails.full.url;
      } else if (imageData.thumbnails?.large?.url) {
        imageUrl = imageData.thumbnails.large.url;
      } else {
        console.error('No valid URL found in image data:', imageData);
        return false;
      }
    } else {
      console.error('Invalid image data type:', typeof imageData);
      return false;
    }
    
    console.log('Sending WhatsApp image to:', to);

    if (!phoneNumberId || !whatsappToken) {
      console.error('WhatsApp configuration missing');
      return false;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "image",
          image: { 
            link: imageUrl,
            caption: caption.substring(0, 1024)
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send image:", errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending image:", error);
    return false;
  }
}

// UPDATED: 6 OPTIONS WITH LOCATION-BASED BROWSING
export function getWelcomeMenu(phoneNumber?: string): string {
  console.log("=== GET WELCOME MENU CALLED ===");
  console.log("Phone:", phoneNumber);
  
  return `🛍️ *PRODUCTS CATALOG*\n\n` +
         `*Select an option:*\n\n` +
         `1. 📍 Browse by Location\n` +
         `2. 📂 Browse Categories\n` +
         `3. 🔍 Search Products\n` +
         `4. 📦 My Orders\n` +
         `5. ❓ Help & Support\n` +
         `6. 🏪 Shop Owner Dashboard\n\n` +
         `*Type:* 1, 2, 3, 4, 5, or 6`;
}

export function getHelpMenu(): string {
  return `📞 *HELP & SUPPORT*\n\n` +
         `*Select an option:*\n\n` +
         `1. How to order\n` +
         `2. Payment methods\n` +
         `3. Delivery information\n` +
         `4. Contact support\n` +
         `5. Return to main menu\n\n` +
         `*Type:* 1, 2, 3, 4, or 5`;
}
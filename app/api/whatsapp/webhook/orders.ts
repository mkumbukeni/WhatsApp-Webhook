// orders.ts - FIXED Order management functions WITH NUMBERS ONLY
import { sendText } from './utils';
import { 
  Order, 
  OrderStatus, 
  PaymentMethod, 
  PaymentStatus,
  WhatsAppSession,
  OrderSessionData,
  Product
} from './types';
import { createOrder, updateOrderStatus, getOrderById, getCustomerOrders } from './airtable';

export async function startOrderFlow(
  from: string, 
  session: WhatsAppSession, 
  product: Product,
  shopOwnerId: string
): Promise<boolean> {
  try {
    console.log("Starting order flow with:", {
      from,
      productId: product.id,
      productName: product.name,
      shopOwnerId,
      productHasId: !!product.id,
      productHasPrice: !!product.price,
      productHasCurrency: !!product.currency
    });

    // Initialize order session
    const orderSessionData: OrderSessionData = {
      step: 'collecting_quantity',
      currentOrderId: null,
      pendingOrder: {
        customerPhone: from,
        productId: product.id,
        productName: product.name,
        shopOwnerId: shopOwnerId,
        currency: product.currency,
        status: 'pending' as OrderStatus,
        paymentStatus: 'pending' as PaymentStatus,
        orderDate: new Date().toISOString().split('T')[0],
        quantity: 1,
        totalPrice: product.price
      }
    };

    session.order = orderSessionData;
    session.step = "order";

    // Ask for quantity
    const message = `🛒 *ORDER ${product.name}*\n\n` +
      `Price: ${product.currency} ${product.price.toLocaleString()} each\n\n` +
      `How many would you like to order?\n\n` +
      `*Type a number:* 1, 2, 3, etc.\n` +
      `*Type 0 to cancel*`;

    await sendText(from, message);
    return true;
  } catch (error) {
    console.error("Error starting order flow:", error);
    await sendText(from, "❌ Error starting order.");
    return false;
  }
}

export async function handleOrderInput(
  from: string, 
  session: WhatsAppSession, 
  userInput: string
): Promise<boolean> {
  if (!session.order) return false;

  const text = userInput.toLowerCase().trim();
  const orderData = session.order;

  switch (orderData.step) {
    case 'collecting_quantity':
      return await handleQuantitySelection(from, session, text);
    case 'collecting_notes':
      return await handleNotesCollection(from, session, text);
    case 'collecting_delivery_address':
      return await handleAddressCollection(from, session, text);
    case 'collecting_delivery_address_details':
      return await handleAddressDetails(from, session, text);
    case 'collecting_payment_method':
      return await handlePaymentMethodSelection(from, session, text);
    case 'confirming_order':
      return await handleOrderConfirmation(from, session, text);
    default:
      return false;
  }
}

async function handleQuantitySelection(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.order || !session.order.pendingOrder) return false;

  if (text === '0') {
    await cancelOrderFlow(from, session);
    return true;
  }

  const quantity = parseInt(text);
  if (isNaN(quantity) || quantity < 1 || quantity > 100) {
    await sendText(from, "❌ Please type a number between 1 and 100.\n\n*Type 0 to cancel*");
    return true;
  }

  // Update quantity and calculate total
  const orderData = session.order;
  const productPrice = orderData.pendingOrder?.totalPrice || 0;
  const currency = orderData.pendingOrder?.currency || 'MWK';
  
  if (orderData.pendingOrder) {
    orderData.pendingOrder.quantity = quantity;
    orderData.pendingOrder.totalPrice = productPrice * quantity;
    orderData.step = 'collecting_notes';
    session.order = orderData;
  }

  const message = `✅ Quantity: ${quantity}\n` +
    `💰 Total: ${currency} ${(productPrice * quantity).toLocaleString()}\n\n` +
    `Any special requests or notes?\n\n` +
    `*Type your notes or:*\n` +
    `1. No notes\n` +
    `0. Cancel order`;

  await sendText(from, message);
  return true;
}

async function handleNotesCollection(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.order || !session.order.pendingOrder) return false;

  if (text === '0') {
    await cancelOrderFlow(from, session);
    return true;
  }

  const orderData = session.order;
  
  if (orderData.pendingOrder) {
    if (text === '1') {
      orderData.pendingOrder.notes = 'No notes';
    } else {
      orderData.pendingOrder.notes = text;
    }
    
    orderData.step = 'collecting_delivery_address';
    session.order = orderData;
  }

  const message = `📍 Do you want delivery?\n\n` +
    `*Select an option:*\n` +
    `1. Yes, I want delivery\n` +
    `2. No, I will pickup\n` +
    `0. Cancel order`;

  await sendText(from, message);
  return true;
}

async function handleAddressCollection(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.order || !session.order.pendingOrder) return false;

  if (text === '0') {
    await cancelOrderFlow(from, session);
    return true;
  }

  const orderData = session.order;
  
  if (orderData.pendingOrder) {
    if (text === '2') {
      // Pickup
      orderData.pendingOrder.deliveryAddress = 'PICKUP';
      orderData.step = 'collecting_payment_method';
      session.order = orderData;
      
      const message = `💳 *SELECT PAYMENT METHOD*\n\n` +
        `*Select an option:*\n\n` +
        `1. Cash (Pay on delivery/collection)\n` +
        `2. Mobile Money\n` +
        `3. Bank Transfer\n` +
        `0. Cancel order`;
      
      await sendText(from, message);
      return true;
    } else if (text === '1') {
      // Need address
      orderData.step = 'collecting_delivery_address_details';
      session.order = orderData;
      await sendText(from, "📍 Please type your delivery address:\n\n*Type 0 to cancel*");
      return true;
    } else {
      await sendText(from, "❌ Please type 1, 2, or 0.\n\n1. Delivery\n2. Pickup\n0. Cancel");
      return true;
    }
  }
  
  return true;
}

async function handleAddressDetails(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.order || !session.order.pendingOrder) return false;

  if (text === '0') {
    await cancelOrderFlow(from, session);
    return true;
  }

  const orderData = session.order;
  
  if (orderData.pendingOrder) {
    orderData.pendingOrder.deliveryAddress = text;
    orderData.step = 'collecting_payment_method';
    session.order = orderData;
    
    const message = `💳 *SELECT PAYMENT METHOD*\n\n` +
      `*Select an option:*\n\n` +
      `1. Cash (Pay on delivery/collection)\n` +
      `2. Mobile Money\n` +
      `3. Bank Transfer\n` +
      `0. Cancel order`;
    
    await sendText(from, message);
  }
  
  return true;
}

async function handlePaymentMethodSelection(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.order || !session.order.pendingOrder) return false;

  if (text === '0') {
    await cancelOrderFlow(from, session);
    return true;
  }

  let paymentMethod: PaymentMethod;
  
  if (text === '1') {
    paymentMethod = 'cash';
  } else if (text === '2') {
    paymentMethod = 'mobile_money';
  } else if (text === '3') {
    paymentMethod = 'bank_transfer';
  } else {
    await sendText(from, "❌ Please type 1, 2, 3, or 0.\n\n1. Cash\n2. Mobile Money\n3. Bank Transfer\n0. Cancel");
    return true;
  }

  const orderData = session.order;
  if (orderData.pendingOrder) {
    orderData.pendingOrder.paymentMethod = paymentMethod;
    orderData.step = 'confirming_order';
    session.order = orderData;
  }

  // Show order summary
  const order = orderData.pendingOrder!;
  const message = await generateOrderSummary(from, order);
  
  await sendText(from, message);
  return true;
}

async function generateOrderSummary(from: string, order: Partial<Order>): Promise<string> {
  let message = `📋 *ORDER SUMMARY*\n\n`;
  
  message += `*Product:* ${order.productName}\n`;
  message += `*Quantity:* ${order.quantity}\n`;
  message += `*Total Price:* ${order.currency} ${order.totalPrice?.toLocaleString()}\n`;
  
  if (order.notes && order.notes !== 'No notes') {
    message += `*Notes:* ${order.notes}\n`;
  }
  
  if (order.deliveryAddress === 'PICKUP') {
    message += `*Collection:* Pickup from shop\n`;
  } else if (order.deliveryAddress) {
    message += `*Delivery to:* ${order.deliveryAddress}\n`;
  }
  
  message += `*Payment:* ${order.paymentMethod?.replace('_', ' ').toUpperCase()}\n\n`;
  
  message += `*Select an option:*\n`;
  message += `1. Confirm order\n`;
  message += `2. Edit order\n`;
  message += `0. Cancel order\n\n`;
  message += `*Type the number only*`;
  
  return message;
}

async function handleOrderConfirmation(from: string, session: WhatsAppSession, text: string): Promise<boolean> {
  if (!session.order || !session.order.pendingOrder) return false;

  const orderData = session.order;
  
  if (text === '0') {
    await cancelOrderFlow(from, session);
    return true;
  }

  if (text === '2') {
    // Edit order - go back to quantity
    orderData.step = 'collecting_quantity';
    session.order = orderData;
    
    await sendText(from, "✏️ Editing order. How many would you like?\n\n*Type a number:* 1, 2, 3, etc.\n*Type 0 to cancel*");
    return true;
  }

  if (text !== '1') {
    await sendText(from, "❌ Please type 1, 2, or 0.\n\n1. Confirm\n2. Edit\n0. Cancel");
    return true;
  }

  // Generate order ID
  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  
  if (!orderData.pendingOrder) return false;

  const completeOrder: Order = {
    id: orderId,
    customerPhone: orderData.pendingOrder.customerPhone!,
    productId: orderData.pendingOrder.productId!,
    productName: orderData.pendingOrder.productName!,
    shopOwnerId: orderData.pendingOrder.shopOwnerId!,
    quantity: orderData.pendingOrder.quantity!,
    totalPrice: orderData.pendingOrder.totalPrice!,
    currency: orderData.pendingOrder.currency!,
    status: 'pending',
    orderDate: new Date().toISOString().split('T')[0],
    paymentMethod: orderData.pendingOrder.paymentMethod,
    paymentStatus: 'pending' as PaymentStatus,
    notes: orderData.pendingOrder.notes,
    deliveryAddress: orderData.pendingOrder.deliveryAddress
  };

  console.log("Attempting to create order:", completeOrder);
  
  try {
    // Save order to Airtable
    const createdOrder = await createOrder(completeOrder);
    
    if (createdOrder) {
      console.log("Order created successfully:", createdOrder.id);
      orderData.currentOrderId = orderId;
      orderData.step = 'order_complete';
      session.order = orderData;

      // Send confirmation message
      const confirmationMessage = `✅ *ORDER PLACED SUCCESSFULLY!*\n\n` +
        `*Order ID:* ${orderId}\n` +
        `*Product:* ${completeOrder.productName}\n` +
        `*Quantity:* ${completeOrder.quantity}\n` +
        `*Total:* ${completeOrder.currency} ${completeOrder.totalPrice.toLocaleString()}\n\n` +
        `The seller will contact you shortly.\n\n` +
        `*Select an option:*\n` +
        `1. View this order\n` +
        `2. Browse more products\n` +
        `3. Main menu`;
      
      await sendText(from, confirmationMessage);
    } else {
      console.error("createOrder returned null");
      throw new Error('Failed to create order - createOrder returned null');
    }
  } catch (error) {
    console.error("Error creating order:", error);
    await sendText(from, "❌ Failed to place order. Please try again or contact support.");
    await cancelOrderFlow(from, session);
  }

  return true;
}

async function cancelOrderFlow(from: string, session: WhatsAppSession): Promise<void> {
  session.order = null;
  session.step = "idle";
  
  const { getWelcomeMenu } = await import('./utils');
  await sendText(from, "❌ Order cancelled.\n\n" + getWelcomeMenu());
}

export async function checkOrderStatus(from: string, session: WhatsAppSession): Promise<boolean> {
  try {
    const orders = await getCustomerOrders(from);
    
    if (orders.length === 0) {
      await sendText(from, "📭 You have no orders yet.\n\n*Select:*\n1. Browse products\n2. Main menu");
      
      if (!session.order) {
        session.order = {
          step: 'idle',
          currentOrderId: null,
          pendingOrder: null
        };
      }
      return true;
    }

    let message = `📦 *YOUR ORDERS*\n\n`;
    
    orders.forEach((order: Order, index: number) => {
      const statusEmoji = getStatusEmoji(order.status);
      message += `${index + 1}. *${order.productName}*\n`;
      message += `   📅 ${order.orderDate}\n`;
      message += `   🆔 ${order.id}\n`;
      message += `   📊 ${statusEmoji} ${order.status.toUpperCase()}\n`;
      message += `   💰 ${order.currency} ${order.totalPrice.toLocaleString()}\n\n`;
    });

    message += `*Select an option:*\n`;
    for (let i = 0; i < orders.length; i++) {
      message += `${i + 1}. View order ${i + 1}\n`;
    }
    message += `${orders.length + 1}. Main menu\n\n`;
    message += `*Type the number only*`;

    await sendText(from, message);
    
    // Store orders in session for detailed view
    if (!session.order) {
      session.order = {
        step: 'idle',
        currentOrderId: null,
        pendingOrder: null
      };
    }
    
    return true;
  } catch (error) {
    console.error("Error checking order status:", error);
    await sendText(from, "❌ Error loading orders.\n\n*Select:*\n1. Try again\n2. Main menu");
    return false;
  }
}

function getStatusEmoji(status: OrderStatus): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'confirmed': return '✅';
    case 'processing': return '🔧';
    case 'shipped': return '🚚';
    case 'delivered': return '🎉';
    case 'cancelled': return '❌';
    default: return '📋';
  }
}
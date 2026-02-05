// types.ts - UPDATED WITH ALL NEW FIELDS FOR CATEGORY → DISTRICT → SHOP → PRODUCT FLOW
export interface ProductCategory {
  id: string;
  name: string;
  icon: string;
  description?: string;
  district?: string;
  location?: string; // This is the "area" field
}

export interface ShopOwner {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  profileImage?: string;
  deliveryAvailable?: boolean;
  openingHours?: string;
  categoryId: string;
  recordId?: string;
}

export interface Product {
  id: string;
  name: string;
  shopOwnerId: string;
  description: string;
  price: number;
  currency: string;
  images: string[]; // Array of image URLs
  inStock: boolean;
  specifications?: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  createdDate?: string;
  featured?: boolean;
  categoryId?: string;
  shopOwnerRecordId?: string;
  district?: string; // Added for location-based search
  location?: string; // Added for location-based search
  // NEW FIELDS for enhanced search display
  shopName?: string;
  shopPhone?: string;
}

export interface ProductSessionData {
  step: ProductFlowStep;
  categories: ProductCategory[];
  shopOwners: ShopOwner[];
  products: Product[];
  currentCategoryId: string | null;
  currentShopOwnerId: string | null;
  currentProductId: string | null;
  currentPage: number;
  lastSearchQuery?: string;
  selectedProductIndex?: number;
  selectedDistrict?: string; // Added for location
  selectedArea?: string; // Added for location (area)
  currentStepData?: any; // For storing temporary data like districts/areas
  shopPage?: number; // Added for shop pagination
  productPage?: number; // Added for product pagination
  shopSearchMode?: boolean; // Added for shop search mode
  productSearchMode?: boolean; // Added for product search mode
  currentCategoryName?: string; // Added for current category name
  currentShopName?: string; // Added for current shop name
}

export type ProductFlowStep = 
  | 'idle'
  | 'select_category'
  | 'select_district_or_search'
  | 'select_district'
  | 'show_shops'
  | 'show_shop_search_results'
  | 'show_products'
  | 'show_product_details'
  | 'search_shops'
  | 'search_products_in_shop'
  | 'show_product_search_results'
  | 'search_products'
  | 'show_location_selection'
  | 'show_global_search_results'
  | 'show_categories'
  | 'show_shop_owners'
  | 'show_product_options';

// ORDER TYPES (unchanged)
export interface Order {
  id: string;
  customerPhone: string;
  customerName?: string;
  productId: string;
  productName: string;
  shopOwnerId: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: OrderStatus;
  orderDate: string;
  notes?: string;
  deliveryAddress?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
}

export type OrderStatus = 
  | 'pending'
  | 'confirmed' 
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 
  | 'cash'
  | 'mobile_money'
  | 'bank_transfer'
  | 'credit_card';

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface OrderSessionData {
  step: OrderFlowStep;
  currentOrderId: string | null;
  pendingOrder: Partial<Order> | null;
}

export type OrderFlowStep = 
  | 'idle'
  | 'collecting_quantity'
  | 'collecting_notes'
  | 'collecting_delivery_address'
  | 'collecting_delivery_address_details'
  | 'collecting_payment_method'
  | 'confirming_order'
  | 'order_complete';

// SHOP OWNER TYPES (unchanged)
export interface ShopOwnerSessionData {
  step: ShopOwnerFlowStep;
  pendingProduct: Partial<Product> | null;
  currentImages: string[];
  currentStepData?: any;
}

export type ShopOwnerFlowStep = 
  | 'idle'
  | 'awaiting_verification'
  | 'verified'
  | 'add_product_category'
  | 'add_product_name'
  | 'add_product_description'
  | 'add_product_price'
  | 'add_product_images'
  | 'confirm_product'
  | 'product_added';

// SESSION TYPES (unchanged)
export interface WhatsAppSession {
  phoneNumber: string;
  step: string;
  products: ProductSessionData | null;
  order: OrderSessionData | null;
  shopOwner: ShopOwnerSessionData | null;
}

export interface AirtableRecord<T> {
  id: string;
  fields: T;
}

export interface AirtableResponse<T> {
  records: AirtableRecord<T>[];
}
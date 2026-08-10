import axios from 'axios';
import {
  clearResultEncryptionSession,
  decryptResultEnvelope,
  getResultEncryptionSession,
  type EncryptedResultEnvelope,
} from './resultEncryption';

const ACCESS_TOKEN_KEY = 'randombox.accessToken';
export const AUTH_SESSION_STARTED_EVENT = 'random-drop-auth-session-started';
export const getAccessToken = () => window.localStorage.getItem(ACCESS_TOKEN_KEY);

// Generate an idempotency key on insecure LAN origins where randomUUID is unavailable.
const createClientNonce = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return `web-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(undefined, async (error) => {
  const original = error.config;
  if (error.response?.status !== 401 || original?._retried || String(original?.url || '').includes('/auth/refresh')) {
    throw error;
  }
  original._retried = true;
  refreshPromise ??= api.post<{ accessToken: string }>('/auth/refresh')
    .then(({ data }) => {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      return data.accessToken;
    })
    .finally(() => { refreshPromise = null; });
  try {
    const token = await refreshPromise;
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  } catch (refreshError) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    clearResultEncryptionSession();
    throw refreshError;
  }
});

export type ApiUser = {
  id: string;
  loginId: string;
  nickname: string;
  realName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  verificationStatus: string;
};

export type ApiBox = {
  id: string;
  slug: string;
  code: string;
  typeName: string;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string;
  title: string;
  roundNo: number;
  price: number;
  total: number;
  remaining: number;
  status: string;
  themeColor: string;
  thumbnailUrl: string | null;
  productCount: number;
  minimumLevel: number;
  maximumLevel: number;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  eventActive?: boolean;
  events?: Array<{id:string;type:'PROBABILITY_UP'|'DOUBLE_UP';title:string;increasePercent:number;startsAt:string;endsAt:string}>;
};

export type ApiCatalogCategory = {
  id: string;
  code: string;
  name: string;
  boxCount: number;
  onSaleCount: number;
};

export type ApiBoxProduct = {
  id: string;
  name: string;
  brandName: string | null;
  listPrice: number;
  marketPrice: number;
  level: number;
  levelName: string;
  color: string;
  imageUrl: string | null;
  weight: number;
  remaining: number;
};

export type AccountSummary = {
  user: ApiUser;
  wallet: { balance: number; lifetimeEarned: number; lifetimeSpent: number };
  assets: Array<{ status: string; count: number; value: number }>;
  activeTrades: number;
  unreadNotifications: number;
};

export type ApiInventoryItem = {
  id: string;
  status: string;
  acquisitionType: string;
  acquiredPrice: number;
  acquiredAt: string;
  productId: string;
  name: string;
  brandName: string | null;
  listPrice: number;
  marketPrice: number;
  level: number;
  levelName: string;
  color: string;
  pointRewardEnabled: boolean;
  pointRewardRate: number;
  imageUrl: string | null;
};

export type ApiTradeListing = {
  id: string;
  listingNo: string;
  wantedDescription: string | null;
  desiredProductId: string | null;
  desiredProductName: string | null;
  desiredProductBrand: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  ownerUserId: string;
  ownerNickname: string;
  assetId: string;
  name: string;
  brandName: string | null;
  marketPrice: number;
  listPrice: number;
  level: number;
  levelName: string;
  color: string;
  imageUrl: string | null;
  categoryName: string | null;
  mine: boolean;
};

export type ApiTradeEligibleProduct = {
  id: string;
  name: string;
  brandName: string | null;
  listPrice: number;
  marketPrice: number;
  level: number;
  levelName: string;
  color: string;
  imageUrl: string | null;
};

export type ApiNotice = {
  id: string;
  title: string;
  category: string;
  thumbnailUrl: string | null;
  pinned: boolean;
  viewCount: number;
  publishedAt: string | null;
};
export type ApiNoticeDetail = ApiNotice & { content: string };

export type ApiFaq = { id: string; category: string; question: string; answer: string };
export type ApiActivity = { id: string; type: string; typeName: string; title: string; createdAt: string };
export type ApiActivityPage = { items: ApiActivity[]; page: number; limit: number; total: number; totalPages: number };
export type ApiNotification = { id: string; type: string; title: string; body: string; linkUrl: string | null; readAt: string | null; createdAt: string };
export type ApiProduct = { id: string; sku: string; name: string; brandName: string | null; categoryCode: string | null; categoryName: string | null; listPrice: number; marketPrice: number; stock: number; status: string; level: number; levelName: string; imageUrl: string | null };
export type ShopProduct={id:string;sku:string;brandName:string|null;name:string;description:string|null;listPrice:number;marketPrice:number;pointPrice:number;stock:number;categoryCode:string;categoryName:string;imageUrl:string|null;rating:number;reviewCount:number};
export type ShopReview={id:string;rating:number;title:string;content:string;imageUrl:string|null;adminReply:string|null;adminReplyAt:string|null;createdAt:string;nickname:string};
export type ShopQuestion={id:string;title:string;content:string;status:string;answer:string|null;answeredAt:string|null;createdAt:string;nickname:string};
export type ShopProductDetail=ShopProduct&{detailContent:string|null;manufacturerInfo:string|null;modelInfo:string|null;originInfo:string|null;shippingInfo:string|null;images:Array<{id:string;url:string;type:string}>;reviews:ShopReview[];questions:ShopQuestion[]};
export type ApiPointLedger = { id: string; direction: string; amount: number; balanceAfter: number; reasonType: string; memo: string | null; createdAt: string };
export type ApiOrder = { id: string; orderNo: string; quantity: number; totalAmount: number; pointUsed: number; paidAmount: number; status: string; orderedAt: string; boxTitle: string; roundNo: number; boxTypeName: string; openedQuantity: number };
export type ApiBasketOrder = {
  id: string;
  orderNo: string;
  quantity: number;
  openedQuantity: number;
  unopenedQuantity: number;
  unitPrice: number;
  totalAmount: number;
  orderedAt: string;
  boxTitle: string;
  boxTypeName: string;
  boxSlug: string;
  roundNo: number;
  themeColor: string;
  thumbnailUrl: string | null;
};
export type ApiAddress = { id: string; label: string; recipientName: string; recipientPhone: string; postalCode: string; addressLine1: string; addressLine2: string | null; deliveryMemo: string | null; isDefault: boolean };
export type ApiInquiry = { id: string; category: string; title: string; content: string; imageUrl: string | null; status: string; answer: string | null; createdAt: string; answeredAt: string | null };
export type ApiLegalDocument = {
  id: number;
  documentType: string;
  version: string;
  title: string;
  content: string;
  required: boolean;
  effectiveAt: string;
};

export type OpenBoxReward = {
  assetId: string;
  productId: string;
  name: string;
  value: number;
  consumerPrice?: number;
  marketPrice?: number;
  level: number;
  levelName: string;
  color: string;
  imageUrl: string | null;
};

export type OpenBoxResult = {
  openingId: string;
  orderId: string;
  sequenceNo: number;
  startLevel: number;
  level: number;
  levelUpCount: number;
  levelPath: number[];
  baseProductLevel?: number;
  resultProductLevel?: number;
  grade: string;
  double: boolean;
  rewards: OpenBoxReward[];
  openedAt: string;
  signature: string;
};

export const userApi = {
  async shopCategories(){const{data}=await api.get<{items:any[]}>('/shop/categories');return data.items.map(row=>({id:String(row.id),code:String(row.code),name:String(row.name)}));},
  async shopProducts(params:{category?:string;keyword?:string;sort?:string}={}){const{data}=await api.get<{items:any[];total:number}>('/shop/products',{params});return{total:Number(data.total),items:data.items.map(row=>({id:String(row.id),sku:String(row.sku),brandName:row.brand_name??null,name:String(row.name),description:row.description??null,listPrice:Number(row.list_price),marketPrice:Number(row.market_price),pointPrice:Number(row.point_price),stock:Number(row.stock_quantity),categoryCode:String(row.category_code),categoryName:String(row.category_name),imageUrl:row.image_url||null,rating:Number(row.rating_average||0),reviewCount:Number(row.review_count||0)})) as ShopProduct[]};},
  async shopProduct(id:string){const{data}=await api.get<any>(`/shop/products/${id}`);const row=data.product;return{id:String(row.id),sku:String(row.sku),brandName:row.brand_name??null,name:String(row.name),description:row.description??null,detailContent:row.detail_content??null,manufacturerInfo:row.manufacturer_info??null,modelInfo:row.model_info??null,originInfo:row.origin_info??null,shippingInfo:row.shipping_info??null,listPrice:Number(row.list_price),marketPrice:Number(row.market_price),pointPrice:Number(row.point_price),stock:Number(row.stock_quantity),categoryCode:String(row.category_code),categoryName:String(row.category_name),imageUrl:data.images.find((image:any)=>image.image_type==='THUMBNAIL')?.image_url||null,rating:Number(row.rating_average||0),reviewCount:Number(row.review_count||0),images:data.images.map((image:any)=>({id:String(image.id),url:String(image.image_url),type:String(image.image_type)})),reviews:data.reviews.map((review:any)=>({id:String(review.id),rating:Number(review.rating),title:String(review.title),content:String(review.content),imageUrl:review.image_url||null,adminReply:review.admin_reply||null,adminReplyAt:review.admin_reply_at||null,createdAt:String(review.created_at),nickname:String(review.nickname)})),questions:data.questions.map((question:any)=>({id:String(question.id),title:String(question.title),content:String(question.content),status:String(question.status),answer:question.answer||null,answeredAt:question.answered_at||null,createdAt:String(question.created_at),nickname:String(question.nickname)}))} as ShopProductDetail;},
  async purchaseShopProduct(id:string,quantity:number){const{data}=await api.post(`/shop/products/${id}/purchase`,{quantity});return data as{orderId:string;orderNo:string;balanceAfter:number;assetIds:string[]};},
  async createShopReview(id:string,input:{rating:number;title:string;content:string;imageUrl?:string}){const{data}=await api.post(`/shop/products/${id}/reviews`,input);return data;},
  async createShopQuestion(id:string,input:{title:string;content:string}){const{data}=await api.post(`/shop/products/${id}/questions`,input);return data;},
  async boxes(category?: string) {
    const { data } = await api.get<{ items: ApiBox[] }>('/catalog/boxes', { params: category ? { category } : undefined });
    return data.items;
  },
  async catalogCategories() {
    const { data } = await api.get<{ items: ApiCatalogCategory[] }>('/catalog/categories');
    return data.items;
  },
  async box(identifier: string) {
    const { data } = await api.get<ApiBox & { products: Record<string, unknown>[] }>(`/catalog/boxes/${identifier}`);
    return {
      ...data,
      products: data.products.map(row => ({
        id: String(row.id), name: String(row.name), brandName: row.brand_name ? String(row.brand_name) : null,
        listPrice: Number(row.list_price || 0), marketPrice: Number(row.market_price || 0),
        level: Number(row.level_no || 1), levelName: String(row.level_name || ''), color: String(row.color_hex || '#ffffff'),
        imageUrl: row.image_url ? String(row.image_url) : null, weight: Number(row.weight_value || 0), remaining: Number(row.remaining_quantity || 0),
      })) as ApiBoxProduct[],
    };
  },
  async products() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/catalog/products', { params: { limit: 100 } });
    return data.items.map(row => ({ id: String(row.id), sku: String(row.sku || ''), name: String(row.name), brandName: row.brand_name ?? null, categoryCode: row.category_code ?? null, categoryName: row.category_name ?? null, listPrice: Number(row.list_price || 0), marketPrice: Number(row.market_price || 0), stock: Number(row.stock_quantity || 0), status: String(row.status), level: Number(row.level_no || 1), levelName: String(row.level_name || ''), imageUrl: row.image_url ?? null })) as ApiProduct[];
  },
  async login(input: { loginId: string; password: string }) {
    const { data } = await api.post<{ accessToken: string; user: ApiUser }>('/auth/login', input);
    clearResultEncryptionSession();
    window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    window.dispatchEvent(new Event(AUTH_SESSION_STARTED_EVENT));
    return data;
  },
  async register(input: { loginId: string; password: string; nickname: string; email?: string; consentIds: number[] }) {
    const { data } = await api.post<{ accessToken: string; user: ApiUser }>('/auth/register', input);
    clearResultEncryptionSession();
    window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    window.dispatchEvent(new Event(AUTH_SESSION_STARTED_EVENT));
    return data;
  },
  async terms() {
    const { data } = await api.get<{ items: Record<string, unknown>[] }>('/auth/terms');
    return data.items.map(row => ({
      id: Number(row.id), documentType: String(row.documentType || ''), version: String(row.version || ''),
      title: String(row.title || ''), content: String(row.content || ''), required: Boolean(row.requiredFlag),
      effectiveAt: String(row.effectiveAt || ''),
    })) as ApiLegalDocument[];
  },
  async logout() {
    await api.post('/auth/logout');
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    clearResultEncryptionSession();
  },
  async summary() {
    const { data } = await api.get<Record<string, any>>('/me/summary');
    const user = data.user || {};
    const wallet = data.wallet || {};
    return {
      user: {
        id: String(user.id), loginId: String(user.loginId ?? user.login_id ?? ''), nickname: String(user.nickname || ''),
        realName: user.realName ?? user.real_name ?? null, email: user.email ?? null, phone: user.phone ?? null,
        status: String(user.status || ''), verificationStatus: String(user.verificationStatus ?? user.verification_status ?? ''),
      },
      wallet: { balance: Number(wallet.balance || 0), lifetimeEarned: Number(wallet.lifetime_earned || wallet.lifetimeEarned || 0), lifetimeSpent: Number(wallet.lifetime_spent || wallet.lifetimeSpent || 0) },
      assets: (data.assets || []).map((row: Record<string, unknown>) => ({ status: String(row.status), count: Number(row.count || 0), value: Number(row.value || 0) })),
      activeTrades: Number(data.activeTrades || 0), unreadNotifications: Number(data.unreadNotifications || 0),
    } as AccountSummary;
  },
  async createOrder(input: { boxId: string; quantity?: number; paymentMethod: 'POINT' | 'EXTERNAL' }) {
    const { data } = await api.post<{ id: string; status: string; paymentRequired?: boolean }>('/orders', input);
    return data;
  },
  async openOrder(orderId: string, clientNonce = createClientNonce()) {
    const encryptionSession = await getResultEncryptionSession(api);
    const { data } = await api.post<EncryptedResultEnvelope>(`/orders/${orderId}/open`, {
      clientNonce,
      resultEncryptionKeyId: encryptionSession.keyId,
    });
    return decryptResultEnvelope<OpenBoxResult>(data, encryptionSession, { orderId, clientNonce });
  },
  async basket() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/orders/basket');
    return data.items.map(row => {
      const quantity = Number(row.quantity || 0);
      const openedQuantity = Number(row.opened_quantity || 0);
      return {
        id: String(row.id), orderNo: String(row.order_no), quantity, openedQuantity,
        unopenedQuantity: Math.max(0, quantity - openedQuantity), unitPrice: Number(row.unit_price || 0),
        totalAmount: Number(row.total_amount || 0), orderedAt: String(row.ordered_at),
        boxTitle: String(row.box_title), boxTypeName: String(row.box_type_name), boxSlug: String(row.box_slug),
        roundNo: Number(row.round_no || 0), themeColor: String(row.theme_color || '#6d5ce7'),
        thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      } as ApiBasketOrder;
    });
  },
  async inventory(status?: string) {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/inventory', { params: status ? { status } : undefined });
    return data.items.map(row => ({
      id: String(row.id), status: String(row.status), acquisitionType: String(row.acquisition_type), acquiredPrice: Number(row.acquired_price || 0), acquiredAt: String(row.acquired_at),
      productId: String(row.product_id), name: String(row.name), brandName: row.brand_name ?? null, listPrice: Number(row.list_price || 0), marketPrice: Number(row.market_price || 0),
      level: Number(row.level_no || 1), levelName: String(row.level_name || ''), color: String(row.color_hex || '#ffffff'),
      pointRewardEnabled: Boolean(row.point_reward_enabled), pointRewardRate: Number(row.point_reward_rate || 0), imageUrl: row.image_url ?? null,
    })) as ApiInventoryItem[];
  },
  async convertAsset(assetId: string) {
    const { data } = await api.post(`/inventory/${assetId}/convert`);
    return data;
  },
  async tradeListings() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/trades/listings');
    return data.items.map(row => ({
      id: String(row.id), listingNo: String(row.listing_no), wantedDescription: row.wanted_description ?? null,
      desiredProductId: row.desired_product_id ? String(row.desired_product_id) : null, desiredProductName: row.desired_product_name ?? null, desiredProductBrand: row.desired_product_brand ?? null, status: String(row.status),
      createdAt: String(row.created_at), expiresAt: row.expires_at ? String(row.expires_at) : null, ownerUserId: String(row.owner_user_id), ownerNickname: String(row.owner_nickname),
      assetId: String(row.asset_id), name: String(row.name), brandName: row.brand_name ?? null, marketPrice: Number(row.market_price || 0), listPrice: Number(row.list_price || 0),
      level: Number(row.level_no || 1), levelName: String(row.level_name || ''), color: String(row.color_hex || '#ffffff'), imageUrl: row.image_url ?? null, categoryName: row.category_name ?? null, mine: Boolean(row.mine),
    })) as ApiTradeListing[];
  },
  async myTrades() {
    const { data } = await api.get<{items:Record<string,any>[]}>('/trades/mine');
    return data.items.map(row=>({id:String(row.id),tradeNo:String(row.trade_no),requesterUserId:String(row.requester_user_id),receiverUserId:String(row.receiver_user_id),requesterNickname:String(row.requester_nickname),receiverNickname:String(row.receiver_nickname),status:String(row.status),message:row.message??null,assets:row.assets??'',createdAt:String(row.created_at)}));
  },
  async myTradeDisputes() {
    const { data } = await api.get<{items:Record<string,any>[]}>('/trades/disputes/mine');
    return data.items.map(row=>({id:String(row.id),tradeId:String(row.trade_id),tradeNo:String(row.trade_no),reasonType:String(row.reason_type),description:String(row.description),status:String(row.status),resolutionNote:row.resolution_note??null,createdAt:String(row.created_at)}));
  },
  async reportTrade(tradeId:string,input:{reasonType:string;description:string}) {
    const { data } = await api.post(`/trades/${tradeId}/disputes`,input);
    return data;
  },
  async tradeEligibleAssets(listingId:string) {
    const {data}=await api.get<{level:number;items:Record<string,any>[]}>(`/trades/listings/${listingId}/eligible-assets`);
    return {level:data.level,items:data.items.map(row=>({id:String(row.id),name:String(row.name),brandName:row.brand_name??null,marketPrice:Number(row.market_price||0),levelName:String(row.level_name||''),imageUrl:row.image_url??null}))};
  },
  async createTradeProposal(listingId:string,assetIds:string[],message:string) {
    const {data}=await api.post(`/trades/listings/${listingId}/proposals`,{assetIds:assetIds.map(Number),message}); return data;
  },
  async updateTrade(tradeId:string,action:'accept'|'reject'|'cancel') {
    const {data}=await api.post(`/trades/${tradeId}/${action}`); return data;
  },
  async cancelTradeListing(listingId:string) { await api.delete(`/trades/listings/${listingId}`); },
  async notices() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/community/notices');
    return data.items.map(row => ({ id: String(row.id), title: String(row.title), category: String(row.category), thumbnailUrl: row.thumbnail_url ?? null, pinned: Boolean(row.pinned_flag), viewCount: Number(row.view_count || 0), publishedAt: row.published_at ? String(row.published_at) : null })) as ApiNotice[];
  },
  async notice(id: string) {
    const { data } = await api.get<Record<string, any>>(`/community/notices/${id}`);
    return { id: String(data.id), title: String(data.title), content: String(data.content || ''), category: String(data.category || ''), thumbnailUrl: data.thumbnail_url ?? null, pinned: Boolean(data.pinned_flag), viewCount: Number(data.view_count || 0), publishedAt: data.published_at ? String(data.published_at) : null } as ApiNoticeDetail;
  },
  async faqs() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/community/faqs');
    return data.items.map(row => ({ id: String(row.id), category: String(row.category), question: String(row.question), answer: String(row.answer) })) as ApiFaq[];
  },
  async activity(params: { page?: number; limit?: number; activityType?: string } = {}) {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page || 1));
    searchParams.set('limit', String(params.limit || 5));
    if (params.activityType) searchParams.set('activityType', params.activityType);
    const { data } = await api.get<{ items: Record<string, any>[]; page: number; limit: number; total: number; totalPages: number }>(`/me/activity?${searchParams}`);
    const labels: Record<string, string> = { BOX_OPENING: '박스 개봉', ASSET_EVENT: '보유 상품 활동', POINT: '포인트 변동' };
    return {
      items: data.items.map(row => {
        const type = String(row.activity_type);
        return { id: String(row.id), type, typeName: String(row.activity_name || labels[type] || '기타 활동'), title: String(row.title), createdAt: String(row.created_at) };
      }),
      page: Number(data.page || 1),
      limit: Number(data.limit || 5),
      total: Number(data.total || 0),
      totalPages: Number(data.totalPages || 1),
    } as ApiActivityPage;
  },
  async notifications() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/me/notifications');
    return data.items.map(row => ({ id: String(row.id), type: String(row.notification_type), title: String(row.title), body: String(row.body), linkUrl: row.link_url ?? null, readAt: row.read_at ? String(row.read_at) : null, createdAt: String(row.created_at) })) as ApiNotification[];
  },
  async markNotificationsRead(ids?: string[]) {
    await api.post('/me/notifications/read', { ids: ids?.map(Number) || [] });
  },
  async points() {
    const { data } = await api.get<Record<string, any>>('/me/points');
    const wallet = data.wallet || {};
    return { wallet: { balance: Number(wallet.balance || 0), lifetimeEarned: Number(wallet.lifetime_earned || 0), lifetimeSpent: Number(wallet.lifetime_spent || 0) }, ledger: (data.ledger || []).map((row: Record<string, any>) => ({ id: String(row.id), direction: String(row.direction), amount: Number(row.amount || 0), balanceAfter: Number(row.balance_after || 0), reasonType: String(row.reason_type || ''), memo: row.memo ?? null, createdAt: String(row.created_at) })) as ApiPointLedger[] };
  },
  async orders() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/orders');
    return data.items.map(row => ({ id: String(row.id), orderNo: String(row.order_no), quantity: Number(row.quantity || 0), totalAmount: Number(row.total_amount || 0), pointUsed: Number(row.point_used || 0), paidAmount: Number(row.paid_amount || 0), status: String(row.status), orderedAt: String(row.ordered_at), boxTitle: String(row.box_title), roundNo: Number(row.round_no || 0), boxTypeName: String(row.box_type_name || ''), openedQuantity: Number(row.opened_quantity || 0) })) as ApiOrder[];
  },
  async inquiries() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/community/inquiries');
    return data.items.map(row => ({ id: String(row.id), category: String(row.category), title: String(row.title), content: String(row.content), imageUrl: row.image_url ?? null, status: String(row.status), answer: row.answer ?? null, createdAt: String(row.created_at), answeredAt: row.answered_at ? String(row.answered_at) : null })) as ApiInquiry[];
  },
  async createInquiry(input: { category: string; title: string; content: string; imageUrl?: string }) {
    const { data } = await api.post('/community/inquiries', input);
    return data;
  },
  async tradeEligibleProducts(assetId: string) {
    const { data } = await api.get<{ level: number; items: Record<string, any>[] }>('/trades/listings/eligible-products', { params: { assetId } });
    return {
      level: Number(data.level),
      items: data.items.map(row => ({
        id: String(row.id), name: String(row.name), brandName: row.brand_name ?? null,
        listPrice: Number(row.list_price || 0), marketPrice: Number(row.market_price || 0),
        level: Number(row.level_no || 1), levelName: String(row.level_name || ''), color: String(row.color_hex || '#ffffff'), imageUrl: row.image_url ?? null,
      })) as ApiTradeEligibleProduct[],
    };
  },
  async createTradeListing(assetId: string, desiredProductId: string, wantedDescription?: string) {
    const { data } = await api.post('/trades/listings', { assetId, desiredProductId, wantedDescription });
    return data;
  },
  async addresses() {
    const { data } = await api.get<{ items: Record<string, any>[] }>('/me/addresses');
    return data.items.map(row => ({ id: String(row.id), label: String(row.label), recipientName: String(row.recipient_name), recipientPhone: String(row.recipient_phone), postalCode: String(row.postal_code), addressLine1: String(row.address_line1), addressLine2: row.address_line2 ?? null, deliveryMemo: row.delivery_memo ?? null, isDefault: Boolean(row.is_default) })) as ApiAddress[];
  },
  async saveAddress(input: Omit<ApiAddress, 'id'>, id?: string) {
    const payload = { label: input.label, recipientName: input.recipientName, recipientPhone: input.recipientPhone, postalCode: input.postalCode, addressLine1: input.addressLine1, addressLine2: input.addressLine2, deliveryMemo: input.deliveryMemo, isDefault: input.isDefault };
    if (id) { await api.put(`/me/addresses/${id}`, payload); return { id }; }
    const { data } = await api.post<{ id: string }>('/me/addresses', payload);
    return data;
  },
  async deleteAddress(id: string) {
    await api.delete(`/me/addresses/${id}`);
  },
  async createShipment(assetIds: string[], input: { addressId?: string; newAddress?: Omit<ApiAddress, 'id'> }) {
    const { data } = await api.post('/inventory/shipments', { assetIds, ...input });
    return data;
  },
};

export const hasAccessToken = () => Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY));

import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeftRight, ArrowRight, Bell, Box, ChevronDown, Circle, CircleHelp, Clock3,
  Coins, Gift, Home, Inbox, LogIn, Menu, MessageCircle, PackageCheck,
  Search, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Truck, UserRound, WalletCards, X,
} from 'lucide-react';
import BoxRevealStage from './components/BoxRevealStage';
import GiftBox3DRevealStage from './components/GiftBox3DRevealStage';
import SlotMachineRevealStage from './components/SlotMachineRevealStage';
import CapsuleMachineRevealStage from './components/CapsuleMachineRevealStage';
import MagicPortalRevealStage from './components/MagicPortalRevealStage';
import VendingMachineRevealStage from './components/VendingMachineRevealStage';
import ClawMachineRevealStage from './components/ClawMachineRevealStage';
import WelcomePerformanceCalibration from './components/WelcomePerformanceCalibration';
import {ShoppingPage,ShoppingProductDetailPage} from './ShopPages';
import { alertDialog, confirmDialog } from './components/AppDialog';
import { tradeListingDialog } from './components/TradeListingDialog';
import ShippingRequestDialog from './components/ShippingRequestDialog';
import BannerCarousel from './components/BannerCarousel';
import TradeHistoryPage from './TradeHistoryPage';
import TradeMarketplacePage from './TradeMarketplacePage';
import { getAccessToken, hasAccessToken, userApi } from './services/api';
import type { ApiAddress, ApiBox, ApiInventoryItem, OpenBoxResult } from './services/api';

const formatPrice = (value: number) => new Intl.NumberFormat('ko-KR').format(Number(value || 0));
const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
};
const assetStatusLabel: Record<string, string> = {
  AVAILABLE: '보유중', TRADE_PENDING: '트레이드중', DELIVERY_PENDING: '배송신청', SHIPPING_REQUESTED: '배송신청', SHIPPED: '배송중', DELIVERED: '배송완료', CONVERTED: '포인트전환',
};

const nav = [
  { to:'/shop', label:'랜덤박스', icon:Home },
  { to:'/shopping', label:'쇼핑', icon:ShoppingBag },
  { to:'/animation-preview', label:'연출 미리보기', icon:Sparkles },
  { to:'/trade', label:'트레이드', icon:ArrowLeftRight },
  { to:'/community', label:'커뮤니티', icon:MessageCircle },
  { to:'/inventory', label:'인벤토리', icon:Inbox },
  { to:'/mypage', label:'마이페이지', icon:UserRound },
];

type AnimationPreviewMode = 'basic' | 'double' | 'levelup' | 'jackpot';
type RevealStyle = 'box' | 'box3d' | 'slot' | 'capsule' | 'portal' | 'vending' | 'claw';

const previewOutcomes: Record<AnimationPreviewMode, OpenBoxResult> = {
  basic: {
    openingId: '101', orderId: 'preview-basic', sequenceNo: 1,
    startLevel: 1, level: 1, levelUpCount: 0, levelPath: [1], grade: 'NORMAL', double: false,
    rewards: [{ assetId: 'preview-basic-asset', productId: 'preview-basic-product', name: '기본 박스 샘플 상품', value: 12000, level: 1, levelName: 'NORMAL', color: '#ffffff', imageUrl: null }],
    openedAt: new Date(0).toISOString(), signature: 'preview-only',
  },
  double: {
    openingId: '100', orderId: 'preview-double', sequenceNo: 1,
    startLevel: 1, level: 1, levelUpCount: 0, levelPath: [1], grade: 'DOUBLE', double: true,
    rewards: [
      { assetId: 'preview-double-asset-1', productId: 'preview-double-product-1', name: '더블 샘플 상품 A', value: 12000, level: 1, levelName: 'NORMAL', color: '#63f4ff', imageUrl: null },
      { assetId: 'preview-double-asset-2', productId: 'preview-double-product-2', name: '더블 샘플 상품 B', value: 12000, level: 1, levelName: 'NORMAL', color: '#8067ff', imageUrl: null },
    ],
    openedAt: new Date(0).toISOString(), signature: 'preview-only',
  },
  levelup: {
    openingId: '102', orderId: 'preview-levelup', sequenceNo: 1,
    startLevel: 1, level: 2, levelUpCount: 1, levelPath: [1, 2], grade: 'RED', double: false,
    rewards: [{ assetId: 'preview-levelup-asset', productId: 'preview-levelup-product', name: '레드 레벨업 샘플 상품', value: 58000, level: 2, levelName: 'RED', color: '#ff6c9d', imageUrl: null }],
    openedAt: new Date(0).toISOString(), signature: 'preview-only',
  },
  jackpot: {
    openingId: '103', orderId: 'preview-jackpot', sequenceNo: 1,
    startLevel: 1, level: 3, levelUpCount: 2, levelPath: [1, 2, 3], grade: 'GOLD', double: false,
    rewards: [{ assetId: 'preview-jackpot-asset', productId: 'preview-jackpot-product', name: '골드 잭팟 샘플 상품', value: 124000, level: 3, levelName: 'GOLD', color: '#fff1a6', imageUrl: null }],
    openedAt: new Date(0).toISOString(), signature: 'preview-only',
  },
};

const revealStyleOptions: { value: RevealStyle; label: string; icon: typeof Gift }[] = [
  { value: 'box', label: '선물상자', icon: Gift },
  { value: 'box3d', label: '3D 선물상자', icon: Sparkles },
  { value: 'slot', label: '슬롯머신', icon: Coins },
  { value: 'capsule', label: '캡슐 머신', icon: Circle },
  // { value: 'portal', label: '마법 포털', icon: Sparkles },
  // { value: 'vending', label: '자판기', icon: ShoppingBag },
  // { value: 'claw', label: '캡슐 뽑기', icon: Circle },
];

const revealStyleCopy: Record<RevealStyle, { heading: string; description: string; meta: string }> = {
  box: {
    heading: '터치할수록 더 높은 등급으로 진화해요',
    description: '각 단계에서 세 번 터치하세요. 마지막 단계의 세 번째 터치에서 상품을 공개합니다.',
    meta: '단계형 선물상자 연출',
  },
  box3d: {
    heading: '3D 에너지로 선물상자를 진화시키세요',
    description: '기존 선물상자 흐름에 입체 파티클, 전기 아크, 충격파와 공간 광원을 더한 독립 연출입니다.',
    meta: '단계형 3D 선물상자 연출',
  },
  slot: {
    heading: '행운의 슬롯을 돌려보세요',
    description: '한 번 터치하면 릴이 회전하고 서버에서 확정된 결과가 공개됩니다.',
    meta: '1회 터치 · 슬롯 연출',
  },
  capsule: {
    heading: '행운의 캡슐을 뽑아보세요',
    description: '한 번 터치하면 캡슐이 섞이고 레버를 거쳐 당첨 상품이 배출됩니다.',
    meta: '1회 터치 · 캡슐 머신 연출',
  },
  portal: {
    heading: '마법 포털에서 상품을 소환하세요',
    description: '한 번 터치하면 빛이 모이고 포털이 갈라지며 당첨 상품이 나타납니다.',
    meta: '1회 터치 · 마법 포털 연출',
  },
  vending: {
    heading: '행운의 자판기에서 상품을 뽑아보세요',
    description: '한 번 터치하면 진열대가 움직이고 선택된 상품이 배출구로 내려옵니다.',
    meta: '1회 터치 · 자판기 연출',
  },
  claw: {
    heading: '집게로 행운의 캡슐을 뽑아보세요',
    description: '레버로 집게 위치를 정하고 뽑기 버튼을 누르면 귀여운 캡슐 하나가 선택됩니다.',
    meta: '1회 조작 · 집게 뽑기 연출',
  },
};

const parseRevealStyle = (value: string | null): RevealStyle => {
  if (value === 'box3d' || value === 'slot' || value === 'capsule' || value === 'portal' || value === 'vending' || value === 'claw') return value;
  return 'box';
};

function RevealStyleToolbar({
  value,
  onChange,
  compact = false,
}: {
  value: RevealStyle;
  onChange: (style: RevealStyle) => void;
  compact?: boolean;
}) {
  return <div className={clsx('reveal-style-toolbar', compact && 'compact')} role="tablist" aria-label="개봉 연출 방식 선택">
    {revealStyleOptions.map(({ value: option, label, icon: Icon }) => <button
      key={option}
      type="button"
      role="tab"
      aria-selected={value === option}
      className={value === option ? 'active' : ''}
      onClick={() => onChange(option)}
    >
      <Icon size={compact ? 15 : 16}/> {label}{compact ? '' : ' 연출'}
    </button>)}
  </div>;
}

function RevealStage({
  style,
  boxId,
  outcome,
  sequential,
  remainingCount,
  continuePending,
  onContinue,
}: {
  style: RevealStyle;
  boxId: string;
  outcome?: OpenBoxResult | null;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
}) {
  const props = {
    boxId,
    outcome,
    sequential,
    remainingCount,
    continuePending,
    onContinue,
  };
  if (style === 'box3d') return <GiftBox3DRevealStage {...props}/>;
  if (style === 'slot') return <SlotMachineRevealStage {...props}/>;
  if (style === 'capsule') return <CapsuleMachineRevealStage {...props}/>;
  if (style === 'portal') return <MagicPortalRevealStage {...props}/>;
  if (style === 'vending') return <VendingMachineRevealStage {...props}/>;
  if (style === 'claw') return <ClawMachineRevealStage {...props}/>;
  return <BoxRevealStage {...props}/>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen,setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const location = useLocation();
  const contextualBanner = location.pathname.startsWith('/trade')
    ? 'EXCHANGE'
    : location.pathname.startsWith('/community')
      ? 'COMMUNITY'
      : null;
  const authenticated = hasAccessToken();
  const { data: summary } = useQuery({ queryKey: ['account-summary'], queryFn: userApi.summary, enabled: authenticated, retry: false });
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const configuredSocketBase = import.meta.env.VITE_USER_WS_URL || '/ws';
    const socketBase = configuredSocketBase.startsWith('/')
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${configuredSocketBase}`
      : configuredSocketBase;
    const socket = new WebSocket(`${socketBase}?token=${encodeURIComponent(token)}`);
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as { event?: string };
        if (!message.event || message.event === 'connected') return;
        void queryClient.invalidateQueries({ queryKey: ['account-summary'] });
        if (message.event.startsWith('trade.')) void queryClient.invalidateQueries({ queryKey: ['trade-listings'] });
        void queryClient.invalidateQueries({ queryKey: ['account-activity'] });
        void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      } catch {
        return;
      }
    };
    return () => socket.close();
  }, [authenticated, queryClient]);
  return <div className="site-shell">
    <WelcomePerformanceCalibration authenticated={authenticated}/>
    <header className="site-header"><div className="header-inner">
      <Link className="logo" to="/"><span><Box size={22}/><Sparkles size={10}/></span><strong>RANDOM DROP</strong></Link>
      <nav className="desktop-nav">{nav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}</nav>
      <div className="user-tools"><Link className="tool-button" aria-label="통합 검색" to="/search"><Search size={19}/></Link><Link className="tool-button cart-tool" aria-label="개봉 장바구니" to={authenticated ? '/cart' : '/login?returnTo=%2Fcart'}><ShoppingCart size={19}/></Link><Link className="notification" aria-label="알림" to={authenticated ? '/mypage/notifications' : '/login?returnTo=%2Fmypage%2Fnotifications'}><Bell size={19}/>{Boolean(summary?.unreadNotifications) && <i>{summary!.unreadNotifications > 99 ? '99+' : summary!.unreadNotifications}</i>}</Link>{authenticated ? <Link className="wallet" to="/mypage/points"><Coins size={16}/><span>{formatPrice(summary?.wallet.balance || 0)} P</span></Link> : <Link className="header-login" to="/login" aria-label="로그인" title="로그인"><LogIn size={18}/><span>로그인</span></Link>}<button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Menu size={21}/></button></div>
    </div></header>
    {menuOpen && <><button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기"/><aside className="mobile-drawer"><div><span>MENU</span><button onClick={() => setMenuOpen(false)}><X size={20}/></button></div>{nav.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}><Icon size={19}/>{label}<ArrowRight size={16}/></NavLink>)}</aside></>}
    {contextualBanner && <BannerCarousel placement={contextualBanner}/>}
    <main>{children}</main>
    <nav className="mobile-bottom-nav">{nav.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} end={to === '/'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
    <footer><div><Link className="logo footer-logo" to="/"><span><Box size={20}/></span><strong>RANDOM DROP</strong></Link><p>열어보는 순간이 가장 재미있는 랜덤박스 플랫폼</p></div><div><b>고객지원</b><span>평일 10:00 — 18:00</span><span>support@randomdrop.kr</span></div><div><b>안내</b><Link to="/community">공지사항</Link><Link to="/community">이용약관 · 개인정보처리방침</Link></div><small>© 2026 Random Drop. All rights reserved.</small></footer>
  </div>;
}

function GiftVisual({ box, large = false }: { box:ApiBox; large?:boolean }) {
  const soldOut = box.remaining === 0;
  const palette = box.maximumLevel >= 8 ? 'violet' : box.maximumLevel >= 4 ? 'rose' : 'peach';
  return <div className={clsx('gift-visual',`palette-${palette}`,large && 'large')} style={{ '--box-theme': box.themeColor || '#ff6659' } as React.CSSProperties}><div className="gift-glow"/>{box.thumbnailUrl ? <img className="box-thumbnail" src={box.thumbnailUrl} alt={box.title}/> : <div className="gift-shape"><i className="gift-box-lid"/><i className="gift-box-body"/><i className="gift-box-ribbon"/><i className="gift-box-band"/><i className="gift-box-bow left"/><i className="gift-box-bow right"/></div>}<span className={clsx(soldOut && 'sold-out')}>{soldOut ? 'SOLD OUT' : `남은 수량 ${box.remaining}개`}</span></div>;
}

function BoxCard({ box, featured = false }: { box:ApiBox; featured?: boolean }) {
  return <article className={clsx('box-card',featured && 'featured',box.eventActive&&'event-active')}><Link to={`/boxes/${box.slug}`}><GiftVisual box={box}/>{box.eventActive&&<div className="box-event-badges">{box.events?.map(event=><span key={event.id}>{event.type==='DOUBLE_UP'?'더블 UP':'확률 UP'} <b>+{event.increasePercent}%</b></span>)}</div>}<div className="box-card-copy"><div><span>{box.categoryName}</span>{featured && <em>HOT</em>}</div><h3>{box.title}</h3><p>{box.typeName} · 총 {box.productCount}종의 {box.categoryName} 상품으로 구성된 박스입니다.</p><footer><strong>{formatPrice(box.price)}원</strong><span>{box.remaining ? `${Math.round((box.remaining/Math.max(1,box.total))*100)}% 남음` : '판매 종료'}</span></footer></div></Link></article>;
}

function CatalogCategoryTabs({categories,selected,onChange}:{categories:Array<{code:string;name:string;boxCount:number}>;selected:string;onChange:(code:string)=>void}) {
  return <div className="catalog-category-tabs" role="tablist" aria-label="랜덤박스 카테고리"><button type="button" className={selected==='ALL'?'active':''} onClick={()=>onChange('ALL')}>전체</button>{categories.map(category=><button type="button" key={category.code} className={selected===category.code?'active':''} onClick={()=>onChange(category.code)}><span>{category.name}</span><small>{category.boxCount}</small></button>)}</div>;
}

function ShopPage() {
  const { data: boxes = [], isLoading, isError } = useQuery({ queryKey: ['boxes'], queryFn: () => userApi.boxes() });
  const { data: categories = [] } = useQuery({ queryKey: ['catalog-categories'], queryFn: userApi.catalogCategories });
  const [category, setCategory] = useState('ALL');
  const filteredBoxes = category === 'ALL' ? boxes : boxes.filter(box => box.categoryCode === category);
  const onSaleCount = filteredBoxes.filter(box => box.status === 'ON_SALE').length;
  const remainingCount = filteredBoxes.reduce((sum, box) => sum + Number(box.remaining || 0), 0);
  const eventBoxes = filteredBoxes.filter(box => box.eventActive);

  return <section className="content-section page-section shop-page">
    <BannerCarousel placement="EVENT"/>
    <div className="page-title split">
      <div><span className="section-kicker">RANDOM BOX SHOP</span><h1>랜덤박스</h1><p>카테고리별 랜덤박스를 비교하고 원하는 박스를 선택해 보세요.</p></div>
      <label className="box-selector"><span className="sr-only">박스 카테고리</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="ALL">전체 카테고리</option>{categories.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={15}/></label>
    </div>
    <CatalogCategoryTabs categories={categories} selected={category} onChange={setCategory}/>
    {eventBoxes.length>0&&<section className="active-box-events"><div><Sparkles size={18}/><span>이벤트 진행중</span><b>{eventBoxes.length}개 박스</b></div><p>확률업 또는 더블업 혜택이 적용되는 박스입니다.</p></section>}
    <div className="inventory-summary shop-summary"><span>조회 박스 <b>{filteredBoxes.length}개</b></span><span>판매 중 <b>{onSaleCount}개</b></span><span>남은 수량 <b>{formatPrice(remainingCount)}개</b></span></div>
    <p className="result-count">현재 조건에 맞는 박스 <b>{filteredBoxes.length}개</b></p>
    {isLoading ? <div className="data-state">박스 목록을 불러오고 있습니다.</div> : isError ? <div className="data-state error">박스 목록을 불러오지 못했습니다.</div> : filteredBoxes.length ? <div className="box-grid">{filteredBoxes.map((box,index) => <BoxCard key={box.id} box={box} featured={index === 0}/>)}</div> : <div className="data-state">선택한 종류의 판매 박스가 없습니다.</div>}
  </section>;
}

function HomePage() {
  const { data: boxes = [], isLoading, isError } = useQuery({ queryKey: ['boxes'], queryFn: () => userApi.boxes() });
  const { data: categories = [] } = useQuery({ queryKey: ['catalog-categories'], queryFn: userApi.catalogCategories });
  const [category, setCategory] = useState('ALL');
  const filteredBoxes = category === 'ALL' ? boxes : boxes.filter(box => box.categoryCode === category);
  const featured = filteredBoxes.find(box => box.status === 'ON_SALE') || filteredBoxes[0] || boxes.find(box => box.status === 'ON_SALE') || boxes[0];
  return <>
    <section className="hero hero-with-banner"><div className="hero-copy hero-copy-with-visual"><div className="hero-copy-backdrop" aria-hidden="true"><div className="hero-ring one"/><div className="hero-ring two"/>{featured && <GiftVisual box={featured} large/>}</div><span className="section-kicker"><Sparkles size={14}/> 오늘의 드롭</span><h1>결과보다 먼저,<br/><em>기대감</em>을 열어보세요.</h1><p>원하는 테마의 박스를 고르고, 화면을 터치하는 순간 시작되는 특별한 개봉 경험.</p><div className="hero-actions"><Link to={featured ? `/boxes/${featured.slug}` : '#box-collection'}>지금 열어보기 <ArrowRight size={17}/></Link><Link to="/inventory" className="ghost">내 인벤토리</Link></div><div className="trust-row"><span><ShieldCheck size={16}/> 확률 버전 공개</span><span><PackageCheck size={16}/> 실물 배송</span><span><ArrowLeftRight size={16}/> 안전한 트레이드</span></div></div><div className="hero-banner-stage"><BannerCarousel placement="HOME" fullWidth/></div></section>
    <section className="content-section" id="box-collection"><div className="section-heading"><div><span className="section-kicker">BOX COLLECTION</span><h2>어떤 행운을 열어볼까요?</h2><p>K-POP 굿즈, K-뷰티, K-FOOD 카테고리에서 원하는 박스를 선택하세요.</p></div><label className="box-selector"><span className="sr-only">박스 카테고리</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="ALL">전체 카테고리</option>{categories.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select><ChevronDown size={15}/></label></div><CatalogCategoryTabs categories={categories} selected={category} onChange={setCategory}/>{isLoading ? <div className="data-state">박스 목록을 불러오고 있습니다.</div> : isError ? <div className="data-state error">박스 목록을 불러오지 못했습니다.</div> : filteredBoxes.length ? <div className="box-grid">{filteredBoxes.map((box,index) => <BoxCard key={box.id} box={box} featured={index === 0}/>)}</div> : <div className="data-state">선택한 카테고리의 판매 박스가 없습니다.</div>}</section>
    <section className="flow-section"><div className="section-heading"><div><span className="section-kicker">HOW IT WORKS</span><h2>열고, 고르고, 다시 연결되는 흐름</h2></div></div><div className="flow-grid">{[[ShoppingBag,'01','박스 구매','가격과 구성·확률을 확인하고 박스를 구매해요.'],[Sparkles,'02','몰입형 개봉','화면을 터치하며 특별한 개봉 결과를 확인해요.'],[WalletCards,'03','상품 선택','보관, 트레이드, 배송, 포인트 전환 중 선택해요.'],[Truck,'04','수령과 순환','원하는 상품은 배송받고 나머지는 다시 순환시켜요.']].map(([Icon,no,title,desc]:any) => <article key={no}><div><Icon size={20}/><span>{no}</span></div><h3>{title}</h3><p>{desc}</p></article>)}</div></section>
  </>;
}

function BoxDetailPage() {
  const { boxId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authenticated = hasAccessToken();
  const { data: box, isLoading, isError } = useQuery({ queryKey: ['box', boxId], queryFn: () => userApi.box(boxId), enabled: Boolean(boxId) });
  const summaryQuery = useQuery({ queryKey: ['account-summary'], queryFn: userApi.summary, enabled: authenticated });
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const purchase = async (openImmediately: boolean) => {
    if (!box) return;
    if (!authenticated) return navigate(`/login?returnTo=${encodeURIComponent(`/boxes/${box.slug}`)}`);
    if (summaryQuery.data && summaryQuery.data.wallet.balance < box.price * quantity) return;
    setPurchasing(true); setPurchaseError('');
    try {
      const order = await userApi.createOrder({ boxId: box.slug, quantity, paymentMethod: 'POINT' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['account-points'] }),
        queryClient.invalidateQueries({ queryKey: ['account-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['box-basket'] }),
      ]);
      navigate(openImmediately
        ? `/open/${box.slug}?orderId=${order.id}&count=${quantity}${quantity > 1 ? '&mode=all' : ''}`
        : '/cart');
    } catch (error: any) {
      setPurchaseError(error.response?.data?.error?.message || '주문을 생성하지 못했습니다.');
    } finally { setPurchasing(false); }
  };
  if (isLoading) return <section className="detail-page"><div className="data-state">박스 정보를 불러오고 있습니다.</div></section>;
  if (isError || !box) return <section className="detail-page"><div className="data-state error">박스 정보를 불러오지 못했습니다.</div></section>;
  const soldOut = box.status !== 'ON_SALE' || box.remaining === 0;
  const soldCount = Math.max(0, box.total - box.remaining);
  const totalPointCost = box.price * quantity;
  const pointBalance = summaryQuery.data?.wallet.balance || 0;
  const pointBalanceLoading = authenticated && summaryQuery.isLoading;
  const insufficientPoints = authenticated && summaryQuery.isSuccess && pointBalance < totalPointCost;
  const pointPurchaseDisabled = soldOut || purchasing || pointBalanceLoading || insufficientPoints;
  return <section className="detail-page"><Link className="back-link" to="/"><ArrowRight size={15}/> 박스 목록</Link><div className="detail-grid"><div className="detail-visual"><GiftVisual box={box} large/><div className="detail-thumbs"><button className="active">BOX</button><button>LINEUP {box.productCount}</button><button>LEVEL {box.minimumLevel}–{box.maximumLevel}</button></div></div><div className="detail-copy"><span className="section-kicker">{box.typeName}</span><h1>{box.title}</h1><p>총 {box.productCount}종의 상품이 포함되어 있으며, 개봉 결과는 개봉 직전에 서버에서 확정됩니다.</p><div className="price-line"><strong>{formatPrice(box.price)} P</strong><span>1회 개봉</span></div><div className="stock-line"><div><span style={{ width:`${Math.min(100, (soldCount / Math.max(1, box.total)) * 100)}%` }}/></div><p><b>{soldCount}개 판매</b><span>총 {box.total}개</span></p></div><div className="detail-info"><article><b>당첨 레벨</b><span>레벨 {box.minimumLevel}부터 {box.maximumLevel}까지</span></article><article><b>개봉 후 선택</b><span>배송 · 트레이드 · 포인트 전환</span></article><article><b>판매 기간</b><span>{box.saleEndsAt?`${formatDate(box.saleStartsAt)} — ${formatDate(box.saleEndsAt)}`:'재고 소진 시까지'}</span></article></div>{box.products.length > 0 && <div className="product-lineup"><b>구성 상품 및 당첨 확률</b>{box.products.map(product => <span key={product.id}>{product.brandName ? `${product.brandName} · ` : ''}{product.name}<em>{formatPrice(product.listPrice)}원 · {(product.weight*100).toFixed(4).replace(/\.?0+$/,'')}%</em></span>)}</div>}<label className="agreement"><input type="checkbox" defaultChecked/><span>상품 구성, 확률 및 개봉 후 취소 제한을 확인했습니다.</span></label><div className="purchase-quantity"><span>구매 수량</span><button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))}>−</button><b>{quantity}</b><button type="button" onClick={() => setQuantity(value => Math.min(10, box.remaining, value + 1))}>＋</button><em>총 {formatPrice(totalPointCost)} P</em></div>{authenticated && <div className={`point-purchase-balance${insufficientPoints ? ' insufficient' : ''}`}><span>보유 포인트 <b>{summaryQuery.isLoading ? '확인 중' : `${formatPrice(pointBalance)} P`}</b></span>{insufficientPoints && <em>{formatPrice(totalPointCost - pointBalance)} P 부족</em>}</div>}<div className="purchase-actions"><button className="basket-purchase-button" disabled={pointPurchaseDisabled} onClick={() => void purchase(false)}><ShoppingCart size={17}/> {insufficientPoints ? '포인트 부족' : '포인트로 구매 후 담기'}</button><button className="purchase-button" disabled={pointPurchaseDisabled} onClick={() => void purchase(true)}>{soldOut ? '구매할 수 없음' : purchasing ? '주문 처리 중' : insufficientPoints ? '포인트가 부족합니다' : quantity > 1 ? '포인트로 구매하고 모두 열기' : '포인트로 구매하고 바로 열기'}<ArrowRight size={17}/></button></div>{purchaseError && <p className="form-error">{purchaseError}</p>}<small className="purchase-note"><ShieldCheck size={14}/> 결제 포인트는 즉시 차감되며, 담아둔 박스는 개봉 장바구니에서 열 수 있습니다.</small></div></div></section>;
}

function AnimationPreviewPage() {
  const [mode, setMode] = useState<AnimationPreviewMode>('basic');
  const [revealStyle, setRevealStyle] = useState<RevealStyle>('box');
  const outcome = previewOutcomes[mode];
  const descriptions: Record<AnimationPreviewMode, string> = {
    basic: '레벨업 없이 세 번째 터치에서 기본 박스가 개봉됩니다.',
    double: '두 번째 터치에서 더블이 확정되고 세 번째 터치에서 두 박스가 함께 개봉됩니다.',
    levelup: '서버 결과에 따라 한 단계 높은 레드 등급으로 진화해 개봉됩니다.',
    jackpot: '두 단계 레벨업이 확정되어 골드 잭팟 상품을 공개합니다.',
  };
  return <section className="open-page animation-preview-page">
    <div className="open-heading"><span>LOGIN-FREE ANIMATION LAB</span><h1>개봉 연출 미리보기</h1><p>선물상자, 슬롯머신, 캡슐 머신, 마법 포털, 자판기와 새 집게 뽑기 연출을 로그인 없이 확인할 수 있습니다.</p></div>
    <RevealStyleToolbar value={revealStyle} onChange={setRevealStyle}/>
    <div className="animation-preview-toolbar" role="tablist" aria-label="미리보기 연출 선택">
      {([['basic', '기본 개봉'], ['double', '더블 개봉'], ['levelup', '레벨업 개봉'], ['jackpot', '잭팟 개봉']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={mode === value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>{label}</button>)}
    </div>
    <RevealStage key={`${revealStyle}-${mode}`} style={revealStyle} boxId={`preview-${mode}`} outcome={outcome}/>
    <div className="animation-preview-note"><Sparkles size={15}/><span>{descriptions[mode]}</span><b>샘플 데이터 · 서버 저장 없음</b></div>
  </section>;
}

function BoxCartPage() {
  const authenticated = hasAccessToken();
  const queryClient = useQueryClient();
  const { data: basket = [], isLoading, isError } = useQuery({ queryKey: ['box-basket'], queryFn: userApi.basket, enabled: authenticated });
  const totalCount = basket.reduce((sum, order) => sum + order.unopenedQuantity, 0);
  const clearOpeningCache = (orderId: string) => queryClient.removeQueries({ queryKey: ['box-opening', orderId] });
  if (!authenticated) return <section className="content-section page-section"><div className="data-state"><p>로그인 후 구매한 박스를 확인할 수 있습니다.</p><Link className="inline-action" to="/login?returnTo=%2Fcart">로그인</Link></div></section>;
  return <section className="content-section page-section box-cart-page">
    <div className="page-title split"><div><span className="section-kicker">OPENING CART</span><h1>개봉 장바구니</h1><p>구매한 박스를 하나씩 즐기거나 한 번에 연속으로 열어보세요.</p></div><div className="basket-count"><ShoppingCart size={20}/><span>남은 박스</span><b>{totalCount}개</b></div></div>
    {isLoading ? <div className="data-state">구매한 박스를 불러오고 있습니다.</div> : isError ? <div className="data-state error">개봉 장바구니를 불러오지 못했습니다.</div> : basket.length ? <div className="basket-list">{basket.map(order => <article key={order.id}><div className="basket-art" style={{ '--basket-color': order.themeColor } as React.CSSProperties}>{order.thumbnailUrl ? <img src={order.thumbnailUrl} alt={order.boxTitle}/> : <Gift size={38}/>}<b>{order.unopenedQuantity}</b></div><div className="basket-copy"><span>{order.boxTypeName}</span><h2>{order.boxTitle}</h2><p>{order.orderNo} · {formatDate(order.orderedAt, true)}</p><small>{order.quantity}개 구매 · {order.openedQuantity}개 개봉 완료</small></div><div className="basket-actions"><Link onClick={() => clearOpeningCache(order.id)} to={`/open/${order.boxSlug}?orderId=${order.id}&count=1`}>하나 열기</Link>{order.unopenedQuantity > 1 && <Link className="primary" onClick={() => clearOpeningCache(order.id)} to={`/open/${order.boxSlug}?orderId=${order.id}&count=${order.unopenedQuantity}&mode=all`}>{order.unopenedQuantity}개 모두 열기 <ArrowRight size={15}/></Link>}</div></article>)}</div> : <div className="empty-basket"><ShoppingCart size={38}/><h2>담아둔 박스가 없습니다.</h2><p>랜덤박스에서 박스를 구매하면 이곳에서 개봉 방법을 선택할 수 있습니다.</p><Link to="/shop">랜덤박스 둘러보기 <ArrowRight size={15}/></Link></div>}
  </section>;
}

function OpenBoxPage() {
  const { boxId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const revealStyle = parseRevealStyle(searchParams.get('reveal'));
  const requestedCount = Math.max(1, Number(searchParams.get('count') || 1));
  const sequential = searchParams.get('mode') === 'all' && requestedCount > 1;
  const queryClient = useQueryClient();
  const [queuedOutcome, setQueuedOutcome] = useState<OpenBoxResult | null>(null);
  const [sessionResults, setSessionResults] = useState<OpenBoxResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const initialCapturedRef = useRef(false);
  const boxQuery = useQuery({ queryKey: ['box', boxId], queryFn: () => userApi.box(boxId), enabled: Boolean(boxId) });
  const openingQuery = useQuery({ queryKey: ['box-opening', orderId, requestedCount], queryFn: () => userApi.openOrder(orderId!), enabled: Boolean(orderId) && hasAccessToken(), retry: false, staleTime: Infinity, gcTime: Infinity });
  const outcome = queuedOutcome || openingQuery.data || null;
  useEffect(() => {
    if (!openingQuery.data || initialCapturedRef.current) return;
    initialCapturedRef.current = true;
    setSessionResults([openingQuery.data]);
    void queryClient.invalidateQueries({ queryKey: ['box-basket'] });
  }, [openingQuery.data, queryClient]);
  const nextOpening = useMutation({
    mutationFn: () => userApi.openOrder(orderId!),
    onSuccess: result => {
      setQueuedOutcome(result);
      setSessionResults(previous => [...previous, result]);
      void queryClient.invalidateQueries({ queryKey: ['box-basket'] });
    },
  });
  const sessionResultCount = Math.max(sessionResults.length, outcome ? 1 : 0);
  const remainingCount = Math.max(0, requestedCount - sessionResultCount);
  const continueOpening = () => {
    if (remainingCount > 0) nextOpening.mutate();
    else setShowSummary(true);
  };
  const animationStartLevel = Math.min(3, Math.max(1, outcome?.startLevel || 1));
  const animationEndLevel = Math.min(3, Math.max(animationStartLevel, outcome?.level || 3));
  const animationStageCount = animationEndLevel - animationStartLevel + 1;
  const error = openingQuery.error as any;
  const errorMessage = error?.response?.data?.error?.message || '개봉 결과를 준비하지 못했습니다.';
  const title = boxQuery.data?.title || '랜덤박스';
  const allRewards = sessionResults.flatMap(result => result.rewards);
  const changeRevealStyle = (nextStyle: RevealStyle) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextStyle !== 'box') nextParams.set('reveal', nextStyle);
    else nextParams.delete('reveal');
    setSearchParams(nextParams, { replace: true });
  };
  if (showSummary) return <section className="open-page opening-summary-page"><div className="opening-summary"><span className="section-kicker">ALL BOXES OPENED</span><h1>모든 박스를 열었습니다!</h1><p>{sessionResults.length}개의 박스에서 총 {allRewards.length}개의 상품을 획득했습니다.</p><div className="opening-result-grid">{allRewards.map((reward, index) => <article key={`${reward.assetId}-${index}`}><div>{reward.imageUrl ? <img src={reward.imageUrl} alt={reward.name}/> : <Gift size={32}/>}<i>{reward.levelName}</i></div><b>{reward.name}</b><span>{formatPrice(reward.consumerPrice || reward.value)}원</span></article>)}</div><div className="opening-summary-actions"><Link className="primary" to="/inventory"><PackageCheck size={16}/> 인벤토리 보기</Link><Link to="/shop"><ShoppingBag size={16}/> 랜덤박스 가기</Link></div></div></section>;
  const isStagedGiftReveal = revealStyle === 'box' || revealStyle === 'box3d';
  return <section className="open-page"><div className="open-heading"><span>{title}{sequential ? ` · 연속 개봉 ${sessionResultCount}/${requestedCount}` : ''}</span><h1>{revealStyleCopy[revealStyle].heading}</h1><p>{isStagedGiftReveal && outcome ? '개봉 연출은 기본에서 레드, 골드까지 최대 3단계로 진행됩니다.' : revealStyleCopy[revealStyle].description}</p></div><RevealStyleToolbar value={revealStyle} onChange={changeRevealStyle} compact/>{openingQuery.isLoading ? <div className="open-loading">안전한 개봉 결과를 준비하고 있습니다.</div> : openingQuery.isError ? <div className="open-loading">{errorMessage}</div> : orderId && !hasAccessToken() ? <div className="open-loading">로그인 후 개봉할 수 있습니다.</div> : nextOpening.isError ? <div className="open-loading">{(nextOpening.error as any)?.response?.data?.error?.message || '다음 박스를 준비하지 못했습니다.'}<button onClick={() => nextOpening.reset()}>다시 시도</button></div> : <RevealStage key={`${revealStyle}-${outcome?.openingId || boxId}`} style={revealStyle} boxId={boxId} outcome={outcome} sequential={sequential} remainingCount={remainingCount} continuePending={nextOpening.isPending} onContinue={continueOpening}/>}<div className="open-meta"><span><Clock3 size={15}/> {outcome ? isStagedGiftReveal ? `${animationStageCount}단계 · 총 ${animationStageCount * 3}회 터치` : revealStyleCopy[revealStyle].meta : '체험 모드'}</span><span><ShieldCheck size={15}/> 서버 결과 검증 완료</span><Link to="/cart">개봉 장바구니 <ArrowRight size={15}/></Link></div></section>;
}

function TradePage() {
  const { data: trades = [], isLoading, isError } = useQuery({ queryKey: ['trade-listings'], queryFn: userApi.tradeListings });
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('ALL');
  const categories = [...new Set(trades.map(trade => trade.categoryName).filter((value): value is string => Boolean(value)))];
  const keyword = searchText.trim().toLowerCase();
  const filteredTrades = trades.filter(trade => (category === 'ALL' || trade.categoryName === category) && (!keyword || [trade.name, trade.brandName, trade.ownerNickname, trade.wantedDescription].some(value => String(value || '').toLowerCase().includes(keyword))));
  return <section className="content-section page-section"><div className="page-title"><span className="section-kicker">SMART TRADE</span><h1>원하는 상품으로 바꿔보세요</h1><p>현금 거래 없이 내 인벤토리 상품으로 안전하게 제안하고 재흥정할 수 있어요.</p></div><div className="trade-toolbar"><div><Search size={18}/><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="상품명, 브랜드, 등록자 검색" aria-label="트레이드 검색"/></div><label className="toolbar-select"><select value={category} onChange={event => setCategory(event.target.value)} aria-label="트레이드 카테고리"><option value="ALL">전체 카테고리</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={15}/></label><Link to={hasAccessToken() ? '/inventory' : '/login?returnTo=%2Finventory'}>내 상품으로 등록 <ArrowRight size={15}/></Link></div><div className="result-count">검색 결과 <b>{filteredTrades.length}</b>건</div><div className="trade-layout"><div className="trade-list">{isLoading ? <div className="data-state">트레이드 상품을 불러오고 있습니다.</div> : isError ? <div className="data-state error">트레이드 상품을 불러오지 못했습니다.</div> : filteredTrades.length ? filteredTrades.map((trade,index) => <article key={trade.id}><div className={`trade-image tone-${index}`}>{trade.imageUrl ? <img src={trade.imageUrl} alt={trade.name}/> : <Gift size={34}/>}<span>{trade.levelName || `레벨 ${trade.level}`}</span></div><div><span>{formatDate(trade.createdAt, true)} · {trade.ownerNickname}</span><h3>{trade.name}</h3><p>원하는 상품: <b>{trade.desiredProductBrand ? `${trade.desiredProductBrand} · ` : ''}{trade.desiredProductName || '선택 정보 없음'}</b></p>{trade.wantedDescription && <p className="trade-message">“{trade.wantedDescription}”</p>}<footer><b>가치 {formatPrice(trade.marketPrice || trade.listPrice)}원</b><Link className="inline-action" to={hasAccessToken() ? '/inventory' : '/login?returnTo=%2Ftrade'}>{trade.mine ? '내 등록 상품' : '내 상품 선택'}</Link></footer></div></article>) : <div className="data-state">검색 조건에 맞는 트레이드 상품이 없습니다.</div>}</div><aside className="trade-guide"><ArrowLeftRight size={24}/><h3>안전 트레이드 가이드</h3><ol><li>상품을 선택해 제안해요.</li><li>상대방이 수락하거나 재흥정해요.</li><li>합의되면 소유권이 자동으로 바뀌어요.</li></ol><p>진행 중인 상품은 중복 사용되지 않도록 잠금 처리됩니다.</p></aside></div></section>;
}

// Keep the legacy view referenced until its remaining inline layout is removed.
void TradePage;

function InventoryPage() {
  const authenticated = hasAccessToken();
  const queryClient = useQueryClient();
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | 'AVAILABLE' | 'TRADE' | 'DELIVERY'>('ALL');
  const [shippingItem, setShippingItem] = useState<ApiInventoryItem | null>(null);
  const { data: inventory = [], isLoading, isError } = useQuery({ queryKey: ['inventory'], queryFn: () => userApi.inventory(), enabled: authenticated });
  const { data: addresses = [] } = useQuery({ queryKey: ['addresses'], queryFn: userApi.addresses, enabled: authenticated });
  const convertMutation = useMutation({ mutationFn: userApi.convertAsset, onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['inventory'] }), queryClient.invalidateQueries({ queryKey: ['account-summary'] })]); } });
  const tradeMutation = useMutation({ mutationFn: ({ assetId, desiredProductId, message }: { assetId: string; desiredProductId: string; message?: string }) => userApi.createTradeListing(assetId, desiredProductId, message), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['inventory'] }), queryClient.invalidateQueries({ queryKey: ['trade-listings'] }), queryClient.invalidateQueries({ queryKey: ['account-summary'] })]); }, onError: async reason => { await alertDialog({ title:'트레이드 등록 실패', message:reason instanceof Error ? reason.message : '트레이드를 등록하지 못했습니다.' }); } });
  const shipmentMutation = useMutation({
    mutationFn: async ({ assetId, addressId, newAddress }: { assetId: string; addressId?: string; newAddress?: Omit<ApiAddress, 'id'> }) => {
      if (!addressId && !newAddress) throw new Error('배송지를 선택해 주세요.');
      return userApi.createShipment([assetId], { addressId, newAddress });
    },
    onSuccess: async () => {
      setShippingItem(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['inventory'] }), queryClient.invalidateQueries({ queryKey: ['addresses'] })]);
      await alertDialog({ title:'배송 신청 완료', message:'배송 신청이 접수되었습니다. 관리자 확인 후 배송 준비가 시작됩니다.' });
    },
    onError: reason => { void alertDialog({ title:'배송 신청 실패', message:reason instanceof Error ? reason.message : '배송을 신청하지 못했습니다.' }); },
  });
  const available = inventory.filter(item => item.status === 'AVAILABLE');
  const tradeCount = inventory.filter(item => item.status === 'TRADE_PENDING').length;
  const shippingStatuses = ['DELIVERY_PENDING', 'SHIPPING_REQUESTED', 'SHIPPED', 'DELIVERED'];
  const shippingCount = inventory.filter(item => shippingStatuses.includes(item.status)).length;
  const filteredInventory = inventory.filter(item => inventoryFilter === 'ALL' || (inventoryFilter === 'AVAILABLE' && item.status === 'AVAILABLE') || (inventoryFilter === 'TRADE' && item.status === 'TRADE_PENDING') || (inventoryFilter === 'DELIVERY' && shippingStatuses.includes(item.status)));
  const value = available.reduce((sum, item) => sum + (item.marketPrice || item.listPrice), 0);
  const registerTrade = async (item: ApiInventoryItem) => {
    try {
      const eligible = await userApi.tradeEligibleProducts(item.id);
      if (!eligible.items.length) {
        await alertDialog({ title:'교환 상품 없음', message:`${item.levelName || `레벨 ${item.level}`}에 등록된 교환 가능 상품이 없습니다.` });
        return;
      }
      const result = await tradeListingDialog({ asset:item, products:eligible.items });
      if (!result) return;
      tradeMutation.mutate({ assetId:item.id, desiredProductId:result.desiredProductId, message:result.message });
    } catch (reason) {
      await alertDialog({ title:'상품 조회 실패', message:reason instanceof Error ? reason.message : '교환 가능한 상품을 불러오지 못했습니다.' });
    }
  };
  const requestShipment = (item: ApiInventoryItem) => setShippingItem(item);
  const convert = async (item: ApiInventoryItem) => {
    if (await confirmDialog({ title:'포인트 전환', message:`${item.name} 상품을 포인트로 전환하시겠습니까?\n전환 후에는 취소할 수 없습니다.`, confirmLabel:'포인트로 전환', tone:'danger' })) convertMutation.mutate(item.id);
  };
  if (!authenticated) return <section className="content-section page-section"><div className="data-state"><p>인벤토리는 로그인 후 확인할 수 있습니다.</p><Link className="inline-action" to="/login?returnTo=%2Finventory">로그인</Link></div></section>;
  return <section className="content-section page-section"><div className="page-title split"><div><span className="section-kicker">MY INVENTORY</span><h1>내가 얻은 모든 상품</h1><p>보관 중인 상품을 배송받거나, 트레이드하거나, 포인트로 전환하세요.</p></div><div className="inventory-summary"><span>보유 상품 <b>{available.length}</b></span><span>예상 가치 <b>{formatPrice(value)}원</b></span></div></div><div className="inventory-tabs">{([['ALL', '전체', inventory.length], ['AVAILABLE', '보유중', available.length], ['TRADE', '트레이드', tradeCount], ['DELIVERY', '배송', shippingCount]] as const).map(([valueKey, label, count]) => <button key={valueKey} className={inventoryFilter === valueKey ? 'active' : ''} onClick={() => setInventoryFilter(valueKey)}>{label} {count}</button>)}</div><div className="inventory-grid">{isLoading ? <div className="data-state">인벤토리를 불러오고 있습니다.</div> : isError ? <div className="data-state error">인벤토리를 불러오지 못했습니다.</div> : filteredInventory.length ? filteredInventory.map((item,index) => <article key={item.id}><div className={`inventory-image tone-${index}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <Gift size={39}/>}<span>{item.levelName || `레벨 ${item.level}`}</span></div><div className="inventory-copy"><span>{formatDate(item.acquiredAt, true)} 당첨</span><h3>{item.name}</h3><p>기준 가치 <b>{formatPrice(item.marketPrice || item.listPrice)}원</b></p><em>{assetStatusLabel[item.status] || item.status}</em><div><button disabled={item.status !== 'AVAILABLE' || tradeMutation.isPending} onClick={() => registerTrade(item)}><ArrowLeftRight size={15}/> 트레이드</button><button disabled={item.status !== 'AVAILABLE' || shipmentMutation.isPending} onClick={() => requestShipment(item)}><Truck size={15}/> 배송받기</button><button disabled={item.status !== 'AVAILABLE' || !item.pointRewardEnabled || convertMutation.isPending} onClick={() => convert(item)}><Coins size={15}/> 포인트 전환</button></div></div></article>) : <div className="data-state">선택한 상태의 상품이 없습니다.</div>}</div>{shippingItem && <ShippingRequestDialog item={shippingItem} addresses={addresses} pending={shipmentMutation.isPending} onClose={() => setShippingItem(null)} onSubmit={input => shipmentMutation.mutate({ assetId:shippingItem.id, ...input })}/>}</section>;
}

function CommunityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tab = searchParams.get('tab') || 'notices';
  const selectedNoticeId = searchParams.get('notice');
  const noticesQuery = useQuery({ queryKey: ['community-notices'], queryFn: userApi.notices });
  const faqsQuery = useQuery({ queryKey: ['community-faqs'], queryFn: userApi.faqs });
  const noticeQuery = useQuery({ queryKey: ['community-notice', selectedNoticeId], queryFn: () => userApi.notice(selectedNoticeId!), enabled: Boolean(selectedNoticeId) });
  const inquiriesQuery = useQuery({ queryKey: ['community-inquiries'], queryFn: userApi.inquiries, enabled: hasAccessToken() && tab === 'inquiries' });
  const [inquiryCategory, setInquiryCategory] = useState('서비스 이용');
  const [inquiryTitle, setInquiryTitle] = useState('');
  const [inquiryContent, setInquiryContent] = useState('');
  const inquiryMutation = useMutation({ mutationFn: userApi.createInquiry, onSuccess: async () => { setInquiryTitle(''); setInquiryContent(''); await queryClient.invalidateQueries({ queryKey: ['community-inquiries'] }); } });
  const notices = noticesQuery.data || [];
  const faqs = faqsQuery.data || [];
  const selectTab = (nextTab: string) => setSearchParams({ tab: nextTab });
  const selectNotice = (id: string) => setSearchParams({ tab: 'notices', notice: id });
  const submitInquiry = (event: React.FormEvent) => { event.preventDefault(); inquiryMutation.mutate({ category: inquiryCategory, title: inquiryTitle, content: inquiryContent }); };
  return <section className="content-section page-section"><div className="page-title"><span className="section-kicker">COMMUNITY</span><h1>랜덤드롭 소식과 가이드</h1><p>공지, FAQ와 1:1 문의를 한곳에서 확인하세요.</p></div><div className="community-grid"><div className="post-list"><div className="post-tabs"><button className={tab === 'notices' ? 'active' : ''} onClick={() => selectTab('notices')}>공지사항 {notices.length}</button><button className={tab === 'faqs' ? 'active' : ''} onClick={() => selectTab('faqs')}>FAQ {faqs.length}</button><button className={tab === 'inquiries' ? 'active' : ''} onClick={() => selectTab('inquiries')}>1:1 문의</button></div>{tab === 'notices' && (selectedNoticeId ? <div className="notice-detail"><button className="back-link" onClick={() => selectTab('notices')}>← 목록으로</button>{noticeQuery.isLoading ? <div className="data-state">공지 내용을 불러오고 있습니다.</div> : noticeQuery.isError || !noticeQuery.data ? <div className="data-state error">공지 내용을 불러오지 못했습니다.</div> : <><span>{noticeQuery.data.category}</span><h2>{noticeQuery.data.title}</h2><small>{formatDate(noticeQuery.data.publishedAt)} · 조회 {formatPrice(noticeQuery.data.viewCount)}</small><div>{noticeQuery.data.content}</div></>}</div> : noticesQuery.isLoading ? <div className="data-state">공지사항을 불러오고 있습니다.</div> : noticesQuery.isError ? <div className="data-state error">공지사항을 불러오지 못했습니다.</div> : notices.length ? notices.map((notice,index) => <article key={notice.id} className="clickable-row" onClick={() => selectNotice(notice.id)} onKeyDown={event => event.key === 'Enter' && selectNotice(notice.id)} role="button" tabIndex={0}><span>{notice.category || '공지'}</span><div className="post-copy"><b>{notice.title}</b><small>{formatDate(notice.publishedAt)} · 조회 {formatPrice(notice.viewCount)}</small></div><ArrowRight size={17}/>{(notice.pinned || index === 0) && <em>{notice.pinned ? '고정' : 'NEW'}</em>}</article>) : <div className="data-state">등록된 공지사항이 없습니다.</div>)}{tab === 'faqs' && <div className="faq-list"><h2>자주 묻는 질문</h2>{faqsQuery.isLoading ? <div className="data-state">FAQ를 불러오고 있습니다.</div> : faqsQuery.isError ? <div className="data-state error">FAQ를 불러오지 못했습니다.</div> : faqs.length ? faqs.map(faq => <details key={faq.id}><summary><span>{faq.category}</span>{faq.question}</summary><p>{faq.answer}</p></details>) : <div className="data-state">등록된 FAQ가 없습니다.</div>}</div>}{tab === 'inquiries' && (!hasAccessToken() ? <div className="data-state"><p>1:1 문의는 로그인 후 이용할 수 있습니다.</p><Link className="inline-action" to="/login?returnTo=%2Fcommunity%3Ftab%3Dinquiries">로그인</Link></div> : <div className="inquiry-section"><form className="inquiry-form" onSubmit={submitInquiry}><h2>새 문의 작성</h2><label>문의 유형<select value={inquiryCategory} onChange={event => setInquiryCategory(event.target.value)}><option>서비스 이용</option><option>결제·포인트</option><option>배송</option><option>트레이드</option><option>기타</option></select></label><label>제목<input value={inquiryTitle} onChange={event => setInquiryTitle(event.target.value)} maxLength={255} required/></label><label>문의 내용<textarea value={inquiryContent} onChange={event => setInquiryContent(event.target.value)} maxLength={5000} rows={6} required/></label>{inquiryMutation.isError && <p className="form-error">{(inquiryMutation.error as any)?.response?.data?.error?.message || '문의를 등록하지 못했습니다.'}</p>}<button disabled={inquiryMutation.isPending}>{inquiryMutation.isPending ? '등록 중' : '문의 등록'}</button></form><div className="inquiry-list"><h2>내 문의 내역</h2>{inquiriesQuery.isLoading ? <div className="data-state">문의 내역을 불러오고 있습니다.</div> : inquiriesQuery.data?.length ? inquiriesQuery.data.map(inquiry => <details key={inquiry.id}><summary><span>{inquiry.status === 'ANSWERED' ? '답변완료' : '접수'}</span><b>{inquiry.title}</b><small>{formatDate(inquiry.createdAt)}</small></summary><p>{inquiry.content}</p>{inquiry.answer && <div className="inquiry-answer"><b>답변</b>{inquiry.answer}</div>}</details>) : <div className="data-state">등록한 문의가 없습니다.</div>}</div></div>)}</div><aside><CircleHelp size={25}/><h3>궁금한 점이 있나요?</h3><p>자주 묻는 질문을 먼저 확인하거나 로그인 후 1:1 문의를 남겨주세요.</p><button onClick={() => selectTab('faqs')}>FAQ 보기</button><button className="outline" onClick={() => selectTab('inquiries')}>1:1 문의</button></aside></div></section>;
}

function MyPage() {
  const authenticated = hasAccessToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activityPage, setActivityPage] = useState(1);
  const [activityType, setActivityType] = useState('');
  const summaryQuery = useQuery({ queryKey: ['account-summary'], queryFn: userApi.summary, enabled: authenticated, retry: false });
  const activityQuery = useQuery({
    queryKey: ['account-activity', activityPage, activityType],
    queryFn: () => userApi.activity({ page: activityPage, limit: 5, activityType }),
    enabled: authenticated,
  });
  const logoutMutation = useMutation({ mutationFn: userApi.logout, onSuccess: () => { queryClient.clear(); navigate('/'); } });
  if (!authenticated) return <section className="content-section page-section"><div className="data-state"><p>마이페이지는 로그인 후 확인할 수 있습니다.</p><Link className="inline-action" to="/login?returnTo=%2Fmypage">로그인</Link></div></section>;
  if (summaryQuery.isLoading) return <section className="content-section page-section"><div className="data-state">계정 정보를 불러오고 있습니다.</div></section>;
  if (summaryQuery.isError || !summaryQuery.data) return <section className="content-section page-section"><div className="data-state error">계정 정보를 불러오지 못했습니다.</div></section>;
  const summary = summaryQuery.data;
  const assetCount = summary.assets.reduce((sum, row) => sum + row.count, 0);
  const availableCount = summary.assets.filter(row => row.status === 'AVAILABLE').reduce((sum, row) => sum + row.count, 0);
  const initials = summary.user.nickname.slice(0, 2).toUpperCase() || 'RD';
  const serviceLinks = [['주문·결제 내역', '/mypage/orders'], ['트레이드 거래·신고', '/trade/history'], ['배송지 관리', '/mypage/addresses'], ['알림 설정', '/mypage/notifications'], ['약관 및 개인정보', '/mypage/legal'], ['고객센터', '/community?tab=inquiries']];
  const activityData = activityQuery.data;
  return <section className="content-section page-section">
    <div className="mypage-head"><div className="profile-avatar">{initials}</div><div><span>반가워요</span><h1>{summary.user.nickname}님</h1><p>{summary.user.loginId} · {summary.user.verificationStatus === 'VERIFIED' ? '본인인증 완료' : '일반회원'}</p></div><button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>{logoutMutation.isPending ? '로그아웃 중' : '로그아웃'}</button></div>
    <div className="account-cards"><article><Coins size={21}/><span>보유 포인트</span><strong>{formatPrice(summary.wallet.balance)} P</strong><Link to="/mypage/points">내역 보기 <ArrowRight size={14}/></Link></article><article><Gift size={21}/><span>보유 상품</span><strong>{assetCount}개</strong><Link to="/inventory">인벤토리 <ArrowRight size={14}/></Link></article><article><ArrowLeftRight size={21}/><span>진행 트레이드</span><strong>{summary.activeTrades}건</strong><Link to="/trade">확인하기 <ArrowRight size={14}/></Link></article></div>
    <div className="account-meta"><span>즉시 사용 가능 상품 <b>{availableCount}개</b></span><span>읽지 않은 알림 <b>{summary.unreadNotifications}개</b></span><span>누적 적립 <b>{formatPrice(summary.wallet.lifetimeEarned)} P</b></span></div>
    <div className="mypage-grid">
      <section>
        <div className="mypage-activity-head">
          <h2>최근 활동</h2>
          <select value={activityType} onChange={event => { setActivityType(event.target.value); setActivityPage(1); }} aria-label="활동명 조건 검색">
            <option value="">전체 활동</option>
            <option value="BOX_OPENING">박스 개봉</option>
            <option value="ASSET_EVENT">보유 상품 활동</option>
            <option value="POINT">포인트 변동</option>
          </select>
        </div>
        {activityQuery.isLoading ? <div className="data-state">최근 활동을 불러오고 있습니다.</div>
          : activityQuery.isError ? <div className="data-state error">최근 활동을 불러오지 못했습니다.</div>
            : activityData?.items.length ? <>
              <div className="mypage-activity-list">{activityData.items.map(activity => <article key={`${activity.type}-${activity.id}`}><div><b>{activity.typeName}</b><span>{activity.title}</span></div><small>{formatDate(activity.createdAt, true)}</small></article>)}</div>
              <div className="mypage-activity-pagination">
                <button type="button" disabled={activityData.page <= 1 || activityQuery.isFetching} onClick={() => setActivityPage(page => Math.max(1, page - 1))}>이전</button>
                <span><b>{activityData.page}</b> / {activityData.totalPages} · 총 {activityData.total}건</span>
                <button type="button" disabled={activityData.page >= activityData.totalPages || activityQuery.isFetching} onClick={() => setActivityPage(page => page + 1)}>다음</button>
              </div>
            </> : <div className="data-state">조건에 맞는 최근 활동이 없습니다.</div>}
      </section>
      <section><h2>서비스 설정</h2>{serviceLinks.map(([label, to]) => <Link className="service-link" key={label} to={to}>{label}<ArrowRight size={16}/></Link>)}</section>
    </div>
  </section>;
}

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const keyword = (searchParams.get('q') || '').trim().toLowerCase();
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: () => userApi.boxes() });
  const productsQuery = useQuery({ queryKey: ['catalog-products'], queryFn: userApi.products });
  const boxes = (boxesQuery.data || []).filter(box => !keyword || [box.title, box.typeName, box.categoryName, box.code].some(value => value.toLowerCase().includes(keyword)));
  const products = (productsQuery.data || []).filter(product => !keyword || [product.name, product.brandName, product.categoryName].some(value => String(value || '').toLowerCase().includes(keyword)));
  const submit = (event: React.FormEvent) => { event.preventDefault(); setSearchParams(searchText.trim() ? { q: searchText.trim() } : {}); };
  return <section className="content-section page-section search-page"><div className="page-title"><span className="section-kicker">SEARCH</span><h1>통합 검색</h1><p>박스와 구성 상품을 한 번에 찾아보세요.</p></div><form className="global-search" onSubmit={submit}><Search size={20}/><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="박스명, 상품명, 브랜드 검색" autoFocus/><button>검색</button></form>{!keyword ? <div className="data-state">검색어를 입력해 주세요.</div> : <><div className="search-result-section"><h2>박스 <b>{boxes.length}</b></h2>{boxesQuery.isLoading ? <div className="data-state">박스를 검색하고 있습니다.</div> : boxes.length ? <div className="box-grid compact">{boxes.map(box => <BoxCard key={box.id} box={box}/>)}</div> : <div className="data-state">일치하는 박스가 없습니다.</div>}</div><div className="search-result-section"><h2>구성 상품 <b>{products.length}</b></h2>{productsQuery.isLoading ? <div className="data-state">상품을 검색하고 있습니다.</div> : products.length ? <div className="product-search-list">{products.map(product => <article key={product.id}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name}/> : <Gift size={30}/>}<div><span>{product.categoryName || '미분류'} · {product.levelName}</span><h3>{product.brandName ? `${product.brandName} · ` : ''}{product.name}</h3><p>{formatPrice(product.marketPrice || product.listPrice)}원</p></div></article>)}</div> : <div className="data-state">일치하는 상품이 없습니다.</div>}</div></>}</section>;
}

function AccountServicePageContent() {
  const { section = 'points' } = useParams();
  const authenticated = hasAccessToken();
  const queryClient = useQueryClient();
  const pointsQuery = useQuery({ queryKey: ['account-points'], queryFn: userApi.points, enabled: authenticated && section === 'points' });
  const ordersQuery = useQuery({ queryKey: ['account-orders'], queryFn: userApi.orders, enabled: authenticated && section === 'orders' });
  const addressesQuery = useQuery({ queryKey: ['addresses'], queryFn: userApi.addresses, enabled: authenticated && section === 'addresses' });
  const notificationsQuery = useQuery({ queryKey: ['account-notifications'], queryFn: userApi.notifications, enabled: authenticated && section === 'notifications' });
  const termsQuery = useQuery({ queryKey: ['legal-terms'], queryFn: userApi.terms, enabled: section === 'legal' });
  const emptyAddress = { label: '기본 배송지', recipientName: '', recipientPhone: '', postalCode: '', addressLine1: '', addressLine2: '', deliveryMemo: '', isDefault: true };
  const [addressForm, setAddressForm] = useState<Omit<ApiAddress, 'id'>>(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState<string>();
  const saveAddressMutation = useMutation({ mutationFn: () => userApi.saveAddress(addressForm, editingAddressId), onSuccess: async () => { setAddressForm(emptyAddress); setEditingAddressId(undefined); await queryClient.invalidateQueries({ queryKey: ['addresses'] }); } });
  const deleteAddressMutation = useMutation({ mutationFn: userApi.deleteAddress, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['addresses'] }); } });
  const readMutation = useMutation({ mutationFn: () => userApi.markNotificationsRead(), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['account-notifications'] }), queryClient.invalidateQueries({ queryKey: ['account-summary'] })]); } });
  const editAddress = (address: ApiAddress) => { setEditingAddressId(address.id); setAddressForm({ label: address.label, recipientName: address.recipientName, recipientPhone: address.recipientPhone, postalCode: address.postalCode, addressLine1: address.addressLine1, addressLine2: address.addressLine2 || '', deliveryMemo: address.deliveryMemo || '', isDefault: address.isDefault }); };
  const deleteAddress = async (address: ApiAddress) => {
    const confirmed = await confirmDialog({
      title: '배송지 삭제',
      message: `${address.label} 배송지를 삭제하시겠습니까?`,
      confirmLabel: '삭제',
      tone: 'danger',
    });
    if (confirmed) deleteAddressMutation.mutate(address.id);
  };
  if (!authenticated && section !== 'legal') return <section className="content-section page-section"><div className="data-state"><p>로그인 후 이용할 수 있습니다.</p><Link className="inline-action" to={`/login?returnTo=${encodeURIComponent(`/mypage/${section}`)}`}>로그인</Link></div></section>;
  const titles: Record<string, string> = { points: '포인트 내역', orders: '주문·결제 내역', addresses: '배송지 관리', notifications: '알림 설정', legal: '약관 및 개인정보' };
  return <section className="content-section page-section account-service-page"><Link className="back-link" to="/mypage">← 마이페이지</Link><div className="page-title"><span className="section-kicker">MY ACCOUNT</span><h1>{titles[section] || '서비스 설정'}</h1></div>{section === 'points' && (pointsQuery.isLoading ? <div className="data-state">포인트 내역을 불러오고 있습니다.</div> : pointsQuery.data ? <><div className="point-summary"><article><span>사용 가능</span><b>{formatPrice(pointsQuery.data.wallet.balance)} P</b></article><article><span>누적 적립</span><b>{formatPrice(pointsQuery.data.wallet.lifetimeEarned)} P</b></article><article><span>누적 사용</span><b>{formatPrice(pointsQuery.data.wallet.lifetimeSpent)} P</b></article></div><div className="record-list">{pointsQuery.data.ledger.length ? pointsQuery.data.ledger.map(row => <article key={row.id}><div><b>{row.memo || row.reasonType}</b><span>{formatDate(row.createdAt, true)}</span></div><strong className={row.direction === 'CREDIT' ? 'credit' : 'debit'}>{row.direction === 'CREDIT' ? '+' : '-'}{formatPrice(row.amount)} P</strong><small>잔액 {formatPrice(row.balanceAfter)} P</small></article>) : <div className="data-state">포인트 내역이 없습니다.</div>}</div></> : <div className="data-state error">포인트 내역을 불러오지 못했습니다.</div>)}{section === 'orders' && (ordersQuery.isLoading ? <div className="data-state">주문 내역을 불러오고 있습니다.</div> : ordersQuery.data?.length ? <div className="record-list">{ordersQuery.data.map(order => <article key={order.id}><div><b>{order.boxTitle} {order.roundNo}회차</b><span>{order.orderNo} · {formatDate(order.orderedAt, true)}</span></div><strong>{formatPrice(order.totalAmount)}원</strong><small>{order.status} · {order.openedQuantity}/{order.quantity}개 개봉</small></article>)}</div> : <div className="data-state">주문 내역이 없습니다.</div>)}{section === 'addresses' && <div className="address-layout"><form className="address-form" onSubmit={event => { event.preventDefault(); saveAddressMutation.mutate(); }}><h2>{editingAddressId ? '배송지 수정' : '배송지 추가'}</h2><label>배송지 이름<input value={addressForm.label} onChange={event => setAddressForm({...addressForm, label:event.target.value})} required/></label><label>받는 분<input value={addressForm.recipientName} onChange={event => setAddressForm({...addressForm, recipientName:event.target.value})} required/></label><label>연락처<input value={addressForm.recipientPhone} onChange={event => setAddressForm({...addressForm, recipientPhone:event.target.value})} required/></label><label>우편번호<input value={addressForm.postalCode} onChange={event => setAddressForm({...addressForm, postalCode:event.target.value})} required/></label><label className="wide">주소<input value={addressForm.addressLine1} onChange={event => setAddressForm({...addressForm, addressLine1:event.target.value})} required/></label><label className="wide">상세 주소<input value={addressForm.addressLine2 || ''} onChange={event => setAddressForm({...addressForm, addressLine2:event.target.value})}/></label><label className="wide">배송 메모<input value={addressForm.deliveryMemo || ''} onChange={event => setAddressForm({...addressForm, deliveryMemo:event.target.value})}/></label><label className="check wide"><input type="checkbox" checked={addressForm.isDefault} onChange={event => setAddressForm({...addressForm, isDefault:event.target.checked})}/> 기본 배송지로 설정</label><button disabled={saveAddressMutation.isPending}>{saveAddressMutation.isPending ? '저장 중' : '저장'}</button>{editingAddressId && <button type="button" className="ghost" onClick={() => { setEditingAddressId(undefined); setAddressForm(emptyAddress); }}>취소</button>}</form><div className="address-list"><h2>등록 배송지</h2>{addressesQuery.isLoading ? <div className="data-state">배송지를 불러오고 있습니다.</div> : addressesQuery.data?.length ? addressesQuery.data.map(address => <article key={address.id}><div><b>{address.label}{address.isDefault && <em>기본</em>}</b><span>{address.recipientName} · {address.recipientPhone}</span><p>[{address.postalCode}] {address.addressLine1} {address.addressLine2}</p></div><button onClick={() => editAddress(address)}>수정</button><button className="danger" onClick={() => void deleteAddress(address)}>삭제</button></article>) : <div className="data-state">등록된 배송지가 없습니다.</div>}</div></div>}{section === 'notifications' && <><div className="service-actions"><button onClick={() => readMutation.mutate()} disabled={readMutation.isPending}>모두 읽음 처리</button></div>{notificationsQuery.isLoading ? <div className="data-state">알림을 불러오고 있습니다.</div> : notificationsQuery.data?.length ? <div className="notification-list">{notificationsQuery.data.map(notification => <Link key={notification.id} className={notification.readAt ? 'read' : ''} to={notification.linkUrl || '#'}><div><b>{notification.title}</b><p>{notification.body}</p></div><small>{formatDate(notification.createdAt, true)}</small></Link>)}</div> : <div className="data-state">알림이 없습니다.</div>}</>}{section === 'legal' && (termsQuery.isLoading ? <div className="data-state">약관을 불러오고 있습니다.</div> : termsQuery.data?.length ? <div className="legal-list">{termsQuery.data.map(term => <details key={term.id}><summary><b>{term.title}</b><span>{term.required ? '필수' : '선택'} · {term.version}</span></summary><div>{term.content}</div></details>)}</div> : <div className="data-state">등록된 약관이 없습니다.</div>)}</section>;
}

function AccountOrdersPage(){
  const authenticated=hasAccessToken();
  const ordersQuery=useQuery({queryKey:['account-orders'],queryFn:userApi.orders,enabled:authenticated});
  if(!authenticated)return <section className="content-section page-section"><div className="data-state"><p>로그인 후 이용할 수 있습니다.</p><Link className="inline-action" to="/login?returnTo=%2Fmypage%2Forders">로그인</Link></div></section>;
  return <section className="content-section page-section account-service-page"><Link className="back-link" to="/mypage">← 마이페이지</Link><div className="page-title"><span className="section-kicker">MY ACCOUNT</span><h1>주문·결제 내역</h1></div>{ordersQuery.isLoading?<div className="data-state">주문 내역을 불러오고 있습니다.</div>:ordersQuery.data?.length?<div className="record-list">{ordersQuery.data.map(order=><article key={order.id}><div><b>{order.boxTitle}</b><span>{order.orderNo} · {formatDate(order.orderedAt,true)}</span></div><strong>{formatPrice(order.totalAmount)}원</strong><small>{order.status} · {order.openedQuantity}/{order.quantity}개 개봉</small></article>)}</div>:<div className="data-state">주문 내역이 없습니다.</div>}</section>;
}

function AccountServicePage(){
  const {section='points'}=useParams();
  return section==='orders'?<AccountOrdersPage/>:<AccountServicePageContent/>;
}

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get('returnTo') || '/mypage';
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try { await userApi.login({ loginId, password }); await queryClient.invalidateQueries({ queryKey: ['account-summary'] }); navigate(returnTo); }
    catch (reason: any) { setError(reason.response?.data?.error?.message || '로그인하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };
  return <section className="content-section page-section auth-page"><div className="page-title"><span className="section-kicker">MEMBER LOGIN</span><h1>랜덤드롭에 로그인</h1><p>박스를 구매하고 개봉 결과를 인벤토리에 안전하게 보관하세요.</p></div><form className="auth-form" onSubmit={submit}><label>아이디<input value={loginId} onChange={(event) => setLoginId(event.target.value)} autoComplete="username" required/></label><label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required/></label>{error && <p className="form-error">{error}</p>}<button className="purchase-button" disabled={submitting}>{submitting ? '로그인 중입니다' : '로그인'}</button><div className="auth-switch"><span>아직 회원이 아니신가요?</span><Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>회원가입</Link></div></form></section>;
}

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const returnTo = new URLSearchParams(location.search).get('returnTo') || '/mypage';
  const { data: terms = [], isLoading: termsLoading, isError: termsError } = useQuery({ queryKey: ['legal-terms'], queryFn: userApi.terms });
  const [loginId, setLoginId] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [consentIds, setConsentIds] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const allConsented = terms.length > 0 && terms.every(term => consentIds.includes(term.id));
  const toggleConsent = (id: number) => setConsentIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleAll = () => setConsentIds(allConsented ? [] : terms.map(term => term.id));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== passwordConfirm) return setError('비밀번호 확인이 일치하지 않습니다.');
    if (terms.some(term => term.required && !consentIds.includes(term.id))) return setError('필수 약관에 모두 동의해 주세요.');
    setSubmitting(true);
    try {
      await userApi.register({ loginId, password, nickname, email: email.trim() || undefined, consentIds });
      await queryClient.invalidateQueries({ queryKey: ['account-summary'] });
      navigate(returnTo);
    } catch (reason: any) {
      setError(reason.response?.data?.error?.message || '회원가입을 완료하지 못했습니다.');
    } finally { setSubmitting(false); }
  };
  return <section className="content-section page-section auth-page register-page"><div className="page-title"><span className="section-kicker">CREATE ACCOUNT</span><h1>랜덤드롭 회원가입</h1><p>계정을 만들고 박스 개봉, 인벤토리, 트레이드 기능을 이용하세요.</p></div><form className="auth-form" onSubmit={submit}><div className="auth-grid"><label>아이디<input value={loginId} onChange={event => setLoginId(event.target.value)} minLength={4} maxLength={80} pattern="[A-Za-z0-9._-]+" autoComplete="username" placeholder="영문, 숫자, 점, 밑줄, 하이픈" required/></label><label>닉네임<input value={nickname} onChange={event => setNickname(event.target.value)} minLength={2} maxLength={80} autoComplete="nickname" required/></label><label className="wide">이메일 <small>선택</small><input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={190} autoComplete="email"/></label><label>비밀번호<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={10} maxLength={100} autoComplete="new-password" placeholder="영문과 숫자를 포함한 10자 이상" required/></label><label>비밀번호 확인<input type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} minLength={10} maxLength={100} autoComplete="new-password" required/></label></div><div className="terms-box"><label className="terms-all"><input type="checkbox" checked={allConsented} onChange={toggleAll} disabled={termsLoading || termsError || terms.length === 0}/><span>전체 약관에 동의합니다.</span></label>{termsLoading ? <div className="terms-state">약관을 불러오고 있습니다.</div> : termsError ? <div className="terms-state error">약관을 불러오지 못했습니다.</div> : terms.length ? terms.map(term => <details key={term.id}><summary><label onClick={event => event.stopPropagation()}><input type="checkbox" checked={consentIds.includes(term.id)} onChange={() => toggleConsent(term.id)}/><span>{term.required ? '[필수]' : '[선택]'} {term.title}</span></label><small>내용 보기</small></summary><div>{term.content}</div></details>) : <div className="terms-state">현재 등록된 가입 약관이 없습니다.</div>}</div>{error && <p className="form-error">{error}</p>}<button className="purchase-button" disabled={submitting || termsLoading || termsError}>{submitting ? '가입 처리 중입니다' : '회원가입'}</button><div className="auth-switch"><span>이미 계정이 있으신가요?</span><Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>로그인</Link></div></form></section>;
}

export default function App() {
  return <Shell><Routes><Route path="/" element={<HomePage/>}/><Route path="/shop" element={<ShopPage/>}/><Route path="/shopping" element={<ShoppingPage/>}/><Route path="/shopping/:id" element={<ShoppingProductDetailPage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/animation-preview" element={<AnimationPreviewPage/>}/><Route path="/boxes/:boxId" element={<BoxDetailPage/>}/><Route path="/cart" element={<BoxCartPage/>}/><Route path="/open/:boxId" element={<OpenBoxPage/>}/><Route path="/trade" element={<TradeMarketplacePage/>}/><Route path="/trade/history" element={<TradeHistoryPage/>}/><Route path="/inventory" element={<InventoryPage/>}/><Route path="/community" element={<CommunityPage/>}/><Route path="/mypage" element={<MyPage/>}/><Route path="/mypage/:section" element={<AccountServicePage/>}/></Routes></Shell>;
}

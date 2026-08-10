import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Gift, Minus, Plus, Search, ShoppingBag, Star, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { hasAccessToken, userApi } from './services/api';
const number = (value: number) => new Intl.NumberFormat('ko-KR').format(value || 0);
export function ShoppingPage() { const [category, setCategory] = useState('ALL');
 const [keyword, setKeyword] = useState('');
 const [submitted, setSubmitted] = useState('');
 const [sort, setSort] = useState('latest');
 const categories = useQuery({ queryKey: ['shop-categories'], queryFn: userApi.shopCategories });
 const products = useQuery({ queryKey: ['shop-products', category, submitted, sort], queryFn: () => userApi.shopProducts({ category, keyword: submitted, sort }) });
 const search = (event: FormEvent) => { event.preventDefault(); setSubmitted(keyword.trim()); };
 return <section className="content-section page-section point-shop-page">
<div className="page-title split">
<div>
<span className="section-kicker">POINT SHOP</span>
<h1>쇼핑</h1>
<p>보유 포인트로 원하는 상품을 바로 구매하고 인벤토리에서 배송을 신청하세요.</p>
</div>
<label className="toolbar-select">
<select value={sort} onChange={e => setSort(e.target.value)} aria-label="정렬">
<option value="latest">최신순</option>
<option value="price_asc">낮은 가격순</option>
<option value="price_desc">높은 가격순</option>
<option value="rating_desc">평점 높은순</option>
</select>
<ChevronDown size={15}/>
</label>
</div>
<div className="shop-category-tabs">
<button className={category === 'ALL' ? 'active' : ''} onClick={() => setCategory('ALL')}>전체</button>{categories.data?.map(item => <button key={item.code} className={category === item.code ? 'active' : ''} onClick={() => setCategory(item.code)}>{item.name}
</button>)}
</div>
<form className="shop-search" onSubmit={search}>
<Search size={18}/>
<input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="상품명 또는 브랜드를 검색하세요"/>
<button>검색</button>
</form>
<p className="result-count">검색 결과 <b>{products.data?.total || 0}
</b>개</p>{products.isLoading ? <div className="data-state">상품을 불러오고 있습니다.</div> : products.isError ? <div className="data-state error">상품을 불러오지 못했습니다.</div> : products.data?.items.length ? <div className="shop-product-grid">{products.data.items.map(item => <Link to={`/shopping/${item.id}`} key={item.id} className="shop-product-card">
<div className="shop-card-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <Gift size={42}/>}
<span>{item.categoryName}
</span>
</div>
<div>
<small>{item.brandName || 'RANDOM DROP'}
</small>
<h3>{item.name}
</h3>
<p>{item.description || '포인트로 구매 가능한 공식 상품입니다.'}
</p>
<div className="shop-rating">
<Star size={13} fill="currentColor"/> {item.rating.toFixed(1)} <span>리뷰 {item.reviewCount}
</span>
</div>
<footer>
<b>{number(item.pointPrice)} P</b>
<em>재고 {item.stock}개</em>
</footer>
</div>
</Link>)}
</div> : <div className="data-state">조건에 맞는 상품이 없습니다.</div>}
</section>; }
export function ShoppingProductDetailPage() { const { id = '' } = useParams();
 const navigate = useNavigate();
 const client = useQueryClient();
 const authenticated = hasAccessToken();
 const [quantity, setQuantity] = useState(1);
 const [modal, setModal] = useState<'review' | 'question' | null>(null);
 const [form, setForm] = useState({ rating: 5, title: '', content: '', imageUrl: '' });
 const [message, setMessage] = useState('');
 const detail = useQuery({ queryKey: ['shop-product', id], queryFn: () => userApi.shopProduct(id), enabled: Boolean(id) });
 const summary = useQuery({ queryKey: ['account-summary'], queryFn: userApi.summary, enabled: authenticated });
 const purchase = useMutation({ mutationFn: () => userApi.purchaseShopProduct(id, quantity), onSuccess: async (result) => { setMessage(`${quantity}개 상품을 구매했습니다. 잔여 포인트 ${number(result.balanceAfter)} P`);
 await Promise.all([client.invalidateQueries({ queryKey: ['account-summary'] }), client.invalidateQueries({ queryKey: ['account-points'] }), client.invalidateQueries({ queryKey: ['inventory'] }), client.invalidateQueries({ queryKey: ['shop-product', id] })]); }, onError: (reason: any) => setMessage(reason?.response?.data?.error?.message || reason?.message || '구매하지 못했습니다.') });
 const submit = async () => { if (!hasAccessToken())
    return navigate(`/login?returnTo=${encodeURIComponent(`/shopping/${id}`)}`);
 if (modal === 'review')
    await userApi.createShopReview(id, { rating: form.rating, title: form.title, content: form.content, imageUrl: form.imageUrl || undefined });
else
    await userApi.createShopQuestion(id, { title: form.title, content: form.content }); setModal(null); setForm({ rating: 5, title: '', content: '', imageUrl: '' });
 await detail.refetch(); };
 if (detail.isLoading)
    return <section className="content-section page-section">
<div className="data-state">상품 정보를 불러오고 있습니다.</div>
</section>;
 if (!detail.data)
    return <section className="content-section page-section">
<div className="data-state error">상품을 찾을 수 없습니다.</div>
</section>;
 const product = detail.data;
 const gallery = product.images.length ? product.images : [{ id: 'main', url: product.imageUrl || '', type: 'THUMBNAIL' }];
 const totalPointCost = product.pointPrice * quantity;
 const pointBalance = summary.data?.wallet.balance || 0;
 const pointBalanceLoading = authenticated && summary.isLoading;
 const insufficientPoints = authenticated && summary.isSuccess && pointBalance < totalPointCost;
 const purchaseDisabled = purchase.isPending || product.stock < quantity || pointBalanceLoading || insufficientPoints;
 const buyWithPoints = () => {
     if (!authenticated) {
         navigate(`/login?returnTo=${encodeURIComponent(`/shopping/${id}`)}`);
         return;
     }
     purchase.mutate();
 };
 return <section className="content-section page-section shop-detail-page">
<div className="shop-detail-hero">
<div className="shop-gallery">
<div>{gallery[0]?.url ? <img src={gallery[0].url} alt={product.name}/> : <Gift size={80}/>}
</div>
<div>{gallery.slice(0, 6).map(image => <img key={image.id} src={image.url} alt="상품 이미지"/>)}
</div>
</div>
<div className="shop-buy-panel">
<span>{product.categoryName} · {product.brandName || 'RANDOM DROP'}
</span>
<h1>{product.name}
</h1>
<div className="detail-rating">
<Star size={16} fill="currentColor"/>
<b>{product.rating.toFixed(1)}
</b>
<a href="#reviews">리뷰 {product.reviewCount}
</a>
</div>{product.listPrice > product.pointPrice && <del>{number(product.listPrice)}원</del>}
<strong>{number(product.pointPrice)} P</strong>
<p>{product.shippingInfo || '인벤토리에 지급된 뒤 배송을 신청할 수 있습니다.'}
</p>
<div className="quantity-box">
<b>수량 선택</b>
<div>
<button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
<Minus size={15}/>
</button>
<span>{quantity}
</span>
<button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>
<Plus size={15}/>
</button>
</div>
</div>
<div className="shop-total">
<span>총 {quantity}개</span>
<b>{number(product.pointPrice * quantity)} P</b>
</div>{authenticated && <p className={`shop-balance${insufficientPoints ? ' insufficient' : ''}`}>보유 포인트 {summary.isLoading ? '확인 중' : `${number(pointBalance)} P`}{insufficientPoints && <em>{number(totalPointCost - pointBalance)} P 부족</em>}</p>}
<button className="shop-purchase" disabled={purchaseDisabled} onClick={buyWithPoints}>
<ShoppingBag size={18}/>{purchase.isPending ? '구매 처리 중' : insufficientPoints ? '포인트가 부족합니다' : '포인트로 구매하기'}
</button>{message && <div className="shop-feedback">
<p>{message}
</p>{purchase.isSuccess && <>
<Link to="/inventory">인벤토리 보기</Link>
<button onClick={() => setMessage('')}>
<X size={15}/>
</button>
</>}
</div>}
</div>
</div>
<nav className="shop-detail-nav">
<a href="#information">상세정보</a>
<a href="#reviews">리뷰 {product.reviewCount}
</a>
<a href="#questions">Q&A {product.questions.length}
</a>
</nav>
<section id="information" className="shop-detail-section">
<h2>상품 상세정보</h2>
<p className="detail-copy-text">{product.detailContent || product.description || '등록된 상세 설명이 없습니다.'}
</p>{gallery.filter(image => image.type === 'DETAIL').map(image => <img key={image.id} src={image.url} alt="상품 상세 이미지"/>)}
<dl>
<div>
<dt>상품번호</dt>
<dd>{product.sku}
</dd>
</div>
<div>
<dt>제조사</dt>
<dd>{product.manufacturerInfo || '-'}
</dd>
</div>
<div>
<dt>모델명</dt>
<dd>{product.modelInfo || '-'}
</dd>
</div>
<div>
<dt>원산지</dt>
<dd>{product.originInfo || '-'}
</dd>
</div>
</dl>
</section>
<section id="reviews" className="shop-detail-section">
<header>
<div>
<h2>상품 리뷰</h2>
<p>실제 포인트 구매 회원의 리뷰입니다.</p>
</div>
<button onClick={() => setModal('review')}>리뷰 작성</button>
</header>{product.reviews.length ? <div className="shop-review-list">{product.reviews.map(review => <article key={review.id}>
<div>
<b>{'★'.repeat(review.rating)}
</b>
<span>{review.nickname} · {review.createdAt.slice(0, 10)}
</span>
</div>
<h3>{review.title}
</h3>
<p>{review.content}
</p>{review.adminReply && <aside>
<b>판매자 답변</b>
<p>{review.adminReply}
</p>
</aside>}
</article>)}
</div> : <div className="data-state">첫 리뷰를 작성해 보세요.</div>}
</section>
<section id="questions" className="shop-detail-section">
<header>
<div>
<h2>상품 Q&A</h2>
<p>상품에 대해 궁금한 내용을 문의하세요.</p>
</div>
<button onClick={() => setModal('question')}>문의하기</button>
</header>{product.questions.length ? <div className="shop-question-list">{product.questions.map(question => <details key={question.id}>
<summary>
<span>{question.status === 'ANSWERED' ? '답변완료' : '답변대기'}
</span>
<b>{question.title}
</b>
<small>{question.nickname}
</small>
</summary>
<p>{question.content}
</p>{question.answer && <aside>
<b>판매자 답변</b>
<p>{question.answer}
</p>
</aside>}
</details>)}
</div> : <div className="data-state">등록된 문의가 없습니다.</div>}
</section>{modal && <div className="shop-form-backdrop" onMouseDown={e => { if (e.currentTarget === e.target)
    setModal(null); }}>
<section className="shop-form-dialog">
<header>
<div>
<h2>{modal === 'review' ? '리뷰 작성' : '상품 문의'}
</h2>
<p>{product.name}
</p>
</div>
<button onClick={() => setModal(null)}>
<X size={18}/>
</button>
</header>{modal === 'review' && <label>평점<select value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}점</option>)}
</select>
</label>}
<label>제목<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/>
</label>
<label>내용<textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}/>
</label>{modal === 'review' && <label>이미지 URL<input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })}/>
</label>}
<footer>
<button onClick={() => setModal(null)}>취소</button>
<button disabled={!form.title.trim() || !form.content.trim()} onClick={() => void submit()}>등록</button>
</footer>
</section>
</div>}
</section>; }

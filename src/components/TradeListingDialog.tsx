import { useEffect, useState } from 'react';
import { ArrowLeftRight, Gift, X } from 'lucide-react';
import type { ApiInventoryItem, ApiTradeEligibleProduct } from '../services/api';

export type TradeListingDialogResult = { desiredProductId: string; message?: string };
type TradeListingDialogOptions = { asset: ApiInventoryItem; products: ApiTradeEligibleProduct[] };
type TradeListingDialogRequest = TradeListingDialogOptions & { resolve: (value: TradeListingDialogResult | null) => void };

let listener: ((request: TradeListingDialogRequest) => void) | null = null;
const queue: TradeListingDialogRequest[] = [];

export const tradeListingDialog = (options: TradeListingDialogOptions) => new Promise<TradeListingDialogResult | null>((resolve) => {
  const request = { ...options, resolve };
  if (listener) listener(request);
  else queue.push(request);
});

const formatPrice = (value: number) => new Intl.NumberFormat('ko-KR').format(Number(value || 0));

export default function TradeListingDialogHost() {
  const [request, setRequest] = useState<TradeListingDialogRequest | null>(null);
  const [desiredProductId, setDesiredProductId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    listener = next => setRequest(current => {
      if (current) { queue.push(next); return current; }
      return next;
    });
    if (queue.length) setRequest(queue.shift() || null);
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    setDesiredProductId('');
    setMessage('');
  }, [request]);

  const finish = (result: TradeListingDialogResult | null) => {
    if (!request) return;
    request.resolve(result);
    setRequest(queue.shift() || null);
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && request) finish(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });

  if (!request) return null;
  const selectedProduct = request.products.find(product => product.id === desiredProductId);

  return <div className="trade-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && finish(null)}>
    <section className="trade-dialog" role="dialog" aria-modal="true" aria-labelledby="trade-dialog-title">
      <header>
        <span><ArrowLeftRight size={21}/></span>
        <div><h2 id="trade-dialog-title">트레이드 등록</h2><p>보유 상품과 같은 레벨의 교환 희망 상품을 선택해 주세요.</p></div>
        <button type="button" onClick={() => finish(null)} aria-label="닫기"><X size={18}/></button>
      </header>
      <div className="trade-dialog-source">
        <div>{request.asset.imageUrl ? <img src={request.asset.imageUrl} alt=""/> : <Gift size={24}/>}</div>
        <p><span>등록할 내 상품</span><b>{request.asset.name}</b><small>{request.asset.levelName || `레벨 ${request.asset.level}`} · {formatPrice(request.asset.marketPrice || request.asset.listPrice)}원</small></p>
      </div>
      <div className="trade-dialog-field">
        <div className="trade-dialog-label"><b>교환 희망 상품</b><span>동일 레벨 {request.products.length}개</span></div>
        <div className="trade-product-options" role="radiogroup" aria-label="교환 희망 상품">
          {request.products.map(product => <button key={product.id} type="button" role="radio" aria-checked={desiredProductId === product.id} className={desiredProductId === product.id ? 'selected' : ''} onClick={() => setDesiredProductId(product.id)}>
            <div>{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <Gift size={25}/>}</div>
            <p><span>{product.brandName || '브랜드 없음'}</span><b>{product.name}</b><small>{formatPrice(product.marketPrice || product.listPrice)}원</small></p>
          </button>)}
        </div>
      </div>
      <label className="trade-dialog-message"><span>교환 메시지 <em>선택</em></span><textarea rows={4} maxLength={500} value={message} onChange={event => setMessage(event.target.value)} placeholder="상대방에게 전달할 교환 조건이나 메시지를 입력해 주세요."/><small>{message.length}/500</small></label>
      {selectedProduct && <p className="trade-dialog-selection"><b>{selectedProduct.name}</b> 상품을 희망 상품으로 등록합니다.</p>}
      <footer><button type="button" className="dialog-cancel" onClick={() => finish(null)}>취소</button><button type="button" className="dialog-confirm" disabled={!desiredProductId} onClick={() => finish({ desiredProductId, message: message.trim() || undefined })}>트레이드 등록</button></footer>
    </section>
  </div>;
}

import { useEffect, useState } from 'react';
import { MapPin, PackageCheck, Plus, X } from 'lucide-react';
import type { ApiAddress, ApiInventoryItem } from '../services/api';

type NewAddress = Omit<ApiAddress, 'id'>;

type Props = {
  item: ApiInventoryItem;
  addresses: ApiAddress[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { addressId?: string; newAddress?: NewAddress }) => void;
};

const emptyAddress: NewAddress = {
  label: '새 배송지',
  recipientName: '',
  recipientPhone: '',
  postalCode: '',
  addressLine1: '',
  addressLine2: '',
  deliveryMemo: '',
  isDefault: false,
};

export default function ShippingRequestDialog({ item, addresses, pending, onClose, onSubmit }: Props) {
  const defaultAddress = addresses.find(address => address.isDefault) || addresses[0];
  const [mode, setMode] = useState<'saved' | 'new'>(defaultAddress ? 'saved' : 'new');
  const [addressId, setAddressId] = useState(defaultAddress?.id || '');
  const [form, setForm] = useState<NewAddress>(emptyAddress);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && !pending && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, pending]);

  const valid = mode === 'saved'
    ? Boolean(addressId)
    : Boolean(form.label.trim() && form.recipientName.trim() && form.recipientPhone.trim() && form.postalCode.trim() && form.addressLine1.trim());

  return <div className="shipping-dialog-backdrop" onMouseDown={event => event.currentTarget === event.target && !pending && onClose()}>
    <section className="shipping-dialog" role="dialog" aria-modal="true" aria-labelledby="shipping-dialog-title">
      <header>
        <span><PackageCheck size={21}/></span>
        <div><h2 id="shipping-dialog-title">배송 신청</h2><p>{item.name} 상품을 받을 배송지를 선택해 주세요.</p></div>
        <button type="button" onClick={onClose} disabled={pending} aria-label="닫기"><X size={18}/></button>
      </header>

      <div className="shipping-dialog-tabs">
        <button type="button" className={mode === 'saved' ? 'active' : ''} onClick={() => setMode('saved')} disabled={!addresses.length}><MapPin size={15}/> 주소록</button>
        <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}><Plus size={15}/> 새 배송지 등록</button>
      </div>

      {mode === 'saved' ? <div className="shipping-address-list">
        {addresses.map(address => <label key={address.id} className={addressId === address.id ? 'selected' : ''}>
          <input type="radio" name="shipping-address" value={address.id} checked={addressId === address.id} onChange={() => setAddressId(address.id)}/>
          <span><b>{address.label}{address.isDefault && <em>기본</em>}</b><small>{address.recipientName} · {address.recipientPhone}</small><p>[{address.postalCode}] {address.addressLine1} {address.addressLine2}</p>{address.deliveryMemo && <small>배송 메모: {address.deliveryMemo}</small>}</span>
        </label>)}
      </div> : <div className="shipping-address-form">
        <label>배송지 이름<input value={form.label} onChange={event => setForm({...form, label:event.target.value})}/></label>
        <label>받는 분<input value={form.recipientName} onChange={event => setForm({...form, recipientName:event.target.value})}/></label>
        <label>연락처<input value={form.recipientPhone} onChange={event => setForm({...form, recipientPhone:event.target.value})} placeholder="010-0000-0000"/></label>
        <label>우편번호<input value={form.postalCode} onChange={event => setForm({...form, postalCode:event.target.value})}/></label>
        <label className="wide">주소<input value={form.addressLine1} onChange={event => setForm({...form, addressLine1:event.target.value})}/></label>
        <label className="wide">상세 주소<input value={form.addressLine2 || ''} onChange={event => setForm({...form, addressLine2:event.target.value})}/></label>
        <label className="wide">배송 메모<input value={form.deliveryMemo || ''} onChange={event => setForm({...form, deliveryMemo:event.target.value})} placeholder="문 앞에 놓아주세요"/></label>
        <label className="shipping-default wide"><input type="checkbox" checked={form.isDefault} onChange={event => setForm({...form, isDefault:event.target.checked})}/> 주소록의 기본 배송지로 저장</label>
      </div>}

      <footer>
        <button type="button" className="dialog-cancel" onClick={onClose} disabled={pending}>취소</button>
        <button type="button" className="dialog-confirm" disabled={!valid || pending} onClick={() => onSubmit(mode === 'saved' ? { addressId } : { newAddress: form })}>{pending ? '신청 중' : '배송 신청'}</button>
      </footer>
    </section>
  </div>;
}

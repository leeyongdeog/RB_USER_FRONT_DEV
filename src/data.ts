import type { InventoryItem, MysteryBox, TradeListing } from './types';

export const boxes: MysteryBox[] = [
  { id:'food-284', title:'푸드박스', series:'284회차', price:12000, remaining:41, total:100, eyebrow:'가볍게 즐기는', description:'간식부터 프리미엄 디저트까지, 오늘의 작은 행운을 열어보세요.', grade:'NORMAL', palette:'peach' },
  { id:'chance-1144', title:'찬스업', series:'1144회차', price:29000, remaining:100, total:100, eyebrow:'더 좋은 상품을', description:'레벨이 오를수록 커지는 기대감. 한정 수량 찬스업 박스입니다.', grade:'RARE', palette:'rose', featured:true },
  { id:'premium-475', title:'찬스업 프리미엄', series:'475회차', price:49000, remaining:3, total:50, eyebrow:'프리미엄만 모은', description:'고가 상품의 비중을 높인 특별한 프리미엄 라인업입니다.', grade:'EPIC', palette:'violet' },
  { id:'choco-90', title:'초콜릿박스', series:'90회차', price:12000, remaining:0, total:80, eyebrow:'달콤한 행운', description:'초콜릿과 디저트 상품으로 구성된 시즌 한정 박스입니다.', grade:'NORMAL', palette:'pink' },
];

export const inventory: InventoryItem[] = [
  { id:'IT-89012', name:'프리미엄 디저트 컬렉션', level:'Lv.2', value:24000, acquiredAt:'2026.07.16', state:'보유중' },
  { id:'IT-88996', name:'무선 미니 가습기 오로라', level:'Lv.3', value:27500, acquiredAt:'2026.07.15', state:'보유중' },
  { id:'IT-88941', name:'신세계 상품권 5만원', level:'Lv.5', value:50000, acquiredAt:'2026.07.14', state:'트레이드중' },
  { id:'IT-88872', name:'프리미엄 타월 기프트 세트', level:'Lv.4', value:39000, acquiredAt:'2026.07.12', state:'배송신청' },
];

export const trades: TradeListing[] = [
  { id:'TR-2844', owner:'블루오빗', title:'프리미엄 타월 기프트 세트', value:39000, wants:'디지털·가전', level:'Lv.4', time:'12분 전' },
  { id:'TR-2843', owner:'망고상자', title:'호텔 베이커리 이용권', value:49000, wants:'상품권·쿠폰', level:'Lv.4', time:'28분 전' },
  { id:'TR-2841', owner:'럭키비', title:'스마트 워치 액티브', value:89000, wants:'2개 이상 제안 가능', level:'Lv.6', time:'1시간 전' },
  { id:'TR-2839', owner:'문파이', title:'프리미엄 뷰티 패키지', value:68000, wants:'뷰티·패션', level:'Lv.5', time:'2시간 전' },
];

export const formatPrice = (value: number) => new Intl.NumberFormat('ko-KR').format(value);


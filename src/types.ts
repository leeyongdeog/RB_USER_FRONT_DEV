export type BoxGrade = 'NORMAL' | 'RARE' | 'EPIC' | 'LEGENDARY';

export type MysteryBox = {
  id: string;
  title: string;
  series: string;
  price: number;
  remaining: number;
  total: number;
  eyebrow: string;
  description: string;
  grade: BoxGrade;
  palette: string;
  featured?: boolean;
};

export type InventoryItem = {
  id: string;
  name: string;
  level: string;
  value: number;
  acquiredAt: string;
  state: '보유중' | '트레이드중' | '배송신청';
};

export type TradeListing = {
  id: string;
  owner: string;
  title: string;
  value: number;
  wants: string;
  level: string;
  time: string;
};


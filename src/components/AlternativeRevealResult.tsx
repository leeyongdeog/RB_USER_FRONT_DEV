import { ArrowRight, Gift, PackageOpen, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { OpenBoxResult } from '../services/api';

export type AlternativeResultKind = 'single' | 'double' | 'level-up' | 'jackpot';

export const getAlternativeResultKind = (
  outcome?: OpenBoxResult | null,
): AlternativeResultKind => {
  if ((outcome?.levelUpCount || 0) >= 2) return 'jackpot';
  if (outcome?.double) return 'double';
  if ((outcome?.levelUpCount || 0) === 1) return 'level-up';
  return 'single';
};

export const ALTERNATIVE_RESULT_COPY: Record<
  AlternativeResultKind,
  { label: string; title: string; color: string }
> = {
  single: { label: 'SINGLE', title: '상품을 획득했습니다!', color: '#7df6ff' },
  double: { label: 'DOUBLE', title: '상품 2개를 획득했습니다!', color: '#8affdc' },
  'level-up': { label: 'LEVEL UP', title: '더 높은 등급으로 진화했습니다!', color: '#ff6c9d' },
  jackpot: { label: 'JACKPOT', title: '최고 등급 상품을 획득했습니다!', color: '#ffd85a' },
};

type AlternativeRevealResultProps = {
  outcome?: OpenBoxResult | null;
  boxId: string;
  kind: AlternativeResultKind;
  sequential?: boolean;
  remainingCount?: number;
  continuePending?: boolean;
  onContinue?: () => void;
};

export default function AlternativeRevealResult({
  outcome,
  boxId,
  kind,
  sequential = false,
  remainingCount = 0,
  continuePending = false,
  onContinue,
}: AlternativeRevealResultProps) {
  const copy = ALTERNATIVE_RESULT_COPY[kind];
  const fallbackRewards = [{
    assetId: `preview-${kind}`,
    productId: `preview-${kind}-product`,
    name: kind === 'jackpot' ? '프리미엄 잭팟 샘플 상품' : '랜덤 드롭 샘플 상품',
    value: kind === 'jackpot' ? 3500000 : kind === 'level-up' ? 128000 : 12000,
    consumerPrice: kind === 'jackpot' ? 3500000 : kind === 'level-up' ? 128000 : 12000,
    level: kind === 'jackpot' ? 3 : kind === 'level-up' ? 2 : 1,
    levelName: copy.label,
    color: copy.color,
    imageUrl: null,
  }];
  const rewards = outcome?.rewards?.length ? outcome.rewards : fallbackRewards;

  return <>
    <span>{copy.label} DROP</span>
    <h2>{rewards.length > 1 ? `상품 ${rewards.length}개를 획득했습니다!` : copy.title}</h2>
    <div className="alternative-reward-list">
      {rewards.map((reward) => <article key={reward.assetId}>
        <div>{reward.imageUrl
          ? <img src={reward.imageUrl} alt={reward.name}/>
          : <Gift size={30}/>}</div>
        <p>
          <b>{reward.name}</b>
          <small>소비자가 {(reward.consumerPrice || reward.value).toLocaleString('ko-KR')}원</small>
        </p>
      </article>)}
    </div>
    <em>결과 ID · {outcome?.openingId || boxId.toUpperCase()}</em>
    <div className="result-actions">
      {sequential
        ? <button
            className="primary sequential-continue"
            type="button"
            onClick={onContinue}
            disabled={continuePending}
          >
            {continuePending
              ? '다음 박스를 준비하고 있습니다'
              : remainingCount > 0 ? '계속' : '결과 확인'}
            <ArrowRight size={14}/>
          </button>
        : <>
          <Link className="primary" to="/inventory">
            <PackageOpen size={15}/> 인벤토리 보기 <ArrowRight size={14}/>
          </Link>
          <Link to="/shop"><ShoppingBag size={15}/> 랜투샵 가기</Link>
        </>}
    </div>
  </>;
}

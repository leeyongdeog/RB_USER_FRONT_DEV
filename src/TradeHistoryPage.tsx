import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import TradeDisputeDialog, { type TradeDisputeInput } from './components/TradeDisputeDialog';
import { alertDialog } from './components/AppDialog';
import { hasAccessToken, userApi } from './services/api';

const labels:Record<string,string>={PROPOSED:'수락 대기',NEGOTIATING:'협의중',COMPLETED:'교환 완료',REJECTED:'거절',CANCELLED:'취소',DISPUTED:'분쟁 처리중',OPEN:'신규 접수',INVESTIGATING:'조사중',RESOLVED:'해결',REJECTED_DISPUTE:'기각'};
const date=(value:string)=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export default function TradeHistoryPage(){
  const queryClient=useQueryClient(); const authenticated=hasAccessToken(); const [reporting,setReporting]=useState<any|null>(null);
  const {data:trades=[],isLoading}=useQuery({queryKey:['my-trades'],queryFn:userApi.myTrades,enabled:authenticated});
  const {data:disputes=[]}=useQuery({queryKey:['my-trade-disputes'],queryFn:userApi.myTradeDisputes,enabled:authenticated});
  const mutation=useMutation({mutationFn:({tradeId,input}:{tradeId:string;input:TradeDisputeInput})=>userApi.reportTrade(tradeId,input),onSuccess:async()=>{setReporting(null);await Promise.all([queryClient.invalidateQueries({queryKey:['my-trades']}),queryClient.invalidateQueries({queryKey:['my-trade-disputes']})]);await alertDialog({title:'신고 접수 완료',message:'운영팀에 신고가 접수되었습니다. 이 화면에서 처리 상태를 확인할 수 있습니다.'});},onError:reason=>void alertDialog({title:'신고 접수 실패',message:reason instanceof Error?reason.message:'신고를 접수하지 못했습니다.'})});
  if(!authenticated)return <section className="content-section page-section"><div className="data-state"><p>로그인 후 거래 내역을 확인할 수 있습니다.</p><Link className="inline-action" to="/login?returnTo=%2Ftrade%2Fhistory">로그인</Link></div></section>;
  return <section className="content-section page-section"><div className="page-title"><span className="section-kicker">TRADE SAFETY</span><h1>내 거래 및 신고</h1><p>교환 진행 상태를 확인하고 완료된 거래의 문제를 운영팀에 신고할 수 있습니다.</p></div><div className="trade-history-list">{isLoading?<div className="data-state">거래 내역을 불러오고 있습니다.</div>:trades.length?trades.map(trade=>{const dispute=disputes.find(item=>item.tradeId===trade.id);return <article key={trade.id}><span><ArrowLeftRight size={20}/></span><div><b>{trade.tradeNo}</b><h3>{trade.requesterNickname} ↔ {trade.receiverNickname}</h3><p>{trade.assets||'교환 상품 정보 없음'}</p><small>{date(trade.createdAt)}</small>{dispute&&<div className="trade-dispute-state"><ShieldAlert size={15}/><b>{labels[dispute.status]||dispute.status}</b><span>{dispute.resolutionNote||'운영팀에서 내용을 확인하고 있습니다.'}</span></div>}</div><em>{labels[trade.status]||trade.status}</em>{trade.status==='COMPLETED'&&!dispute&&<button onClick={()=>setReporting(trade)}>거래 신고</button>}</article>}):<div className="data-state">진행한 트레이드가 없습니다.</div>}</div>{reporting&&<TradeDisputeDialog tradeNo={reporting.tradeNo} pending={mutation.isPending} onClose={()=>setReporting(null)} onSubmit={input=>mutation.mutate({tradeId:reporting.id,input})}/>}</section>;
}

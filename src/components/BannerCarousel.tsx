import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { userApi, type ApiBanner } from '../services/api';

export type BannerPlacement = 'HOME' | 'EVENT' | 'EXCHANGE' | 'COMMUNITY';

const BannerLink = ({ banner, children }: { banner: ApiBanner; children: ReactNode }) => {
  if (!banner.linkUrl) return <div className="service-banner-link">{children}</div>;
  if (/^https?:\/\//i.test(banner.linkUrl)) return <a className="service-banner-link" href={banner.linkUrl} target={banner.linkTarget === 'BLANK' ? '_blank' : undefined} rel={banner.linkTarget === 'BLANK' ? 'noreferrer' : undefined}>{children}</a>;
  return <Link className="service-banner-link" to={banner.linkUrl}>{children}</Link>;
};

export default function BannerCarousel({ placement }: { placement: BannerPlacement }) {
  const { data: banners = [] } = useQuery({ queryKey: ['service-banners', placement], queryFn: () => userApi.banners(placement), staleTime: 60_000 });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => setActive(0), [banners.length, placement]);
  useEffect(() => {
    if (paused || banners.length < 2) return;
    const timer = window.setInterval(() => setActive(index => (index + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);

  if (!banners.length) return null;
  const show = (index: number) => setActive((index + banners.length) % banners.length);

  return <section className="service-banner" aria-label="프로모션 배너" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => {
    if (touchStart.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) > 45) show(active + (distance < 0 ? 1 : -1));
  }}>
    <div className="service-banner-track" style={{ transform: `translate3d(-${active * 100}%,0,0)` }}>
      {banners.map((banner, index) => <article key={banner.id} className="service-banner-slide" aria-hidden={index !== active}><BannerLink banner={banner}><picture>{banner.mobileImageUrl && <source media="(max-width: 600px)" srcSet={banner.mobileImageUrl}/>}<img src={banner.imageUrl} alt={banner.title}/></picture></BannerLink></article>)}
    </div>
    {banners.length > 1 && <><button type="button" className="service-banner-arrow prev" onClick={() => show(active - 1)} aria-label="이전 배너"><ChevronLeft size={20}/></button><button type="button" className="service-banner-arrow next" onClick={() => show(active + 1)} aria-label="다음 배너"><ChevronRight size={20}/></button><div className="service-banner-dots">{banners.map((banner, index) => <button key={banner.id} type="button" className={`service-banner-dot ${index === active ? 'active' : ''}`} onClick={() => show(index)} aria-label={`${index + 1}번째 배너`} aria-current={index === active ? 'true' : undefined}/>)}</div></>}
  </section>;
}

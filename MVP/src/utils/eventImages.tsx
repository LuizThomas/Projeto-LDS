import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Evento } from '../types';

const BANNER_COMPUTING = '/src/assets/images/event_computing_banner_1795516590978.jpg';
const BANNER_SCIENCE = '/src/assets/images/event_science_banner_1795516590989.jpg';
const BANNER_WORKSHOP = '/src/assets/images/event_workshop_banner_1795516590955.jpg';

export function getEventBannerSrc(
  evento?: Pick<Evento, 'banner_url' | 'titulo' | 'modalidade' | 'id_evento'> | null
): string {
  if (evento?.banner_url && evento.banner_url.trim().length > 0) {
    return evento.banner_url;
  }

  const title = (evento?.titulo || '').toLowerCase();
  if (
    title.includes('computa') ||
    title.includes('tecnolog') ||
    title.includes('software') ||
    title.includes('dados') ||
    title.includes('ia') ||
    title.includes('intelig')
  ) {
    return BANNER_COMPUTING;
  }

  if (
    title.includes('oficina') ||
    title.includes('workshop') ||
    title.includes('minicurso') ||
    title.includes('extens') ||
    evento?.modalidade === 'Online'
  ) {
    return BANNER_WORKSHOP;
  }

  const mod = (evento?.id_evento || 0) % 3;
  if (mod === 0) return BANNER_SCIENCE;
  if (mod === 1) return BANNER_COMPUTING;
  return BANNER_WORKSHOP;
}

interface EventBannerProps {
  evento?: Pick<Evento, 'banner_url' | 'titulo' | 'modalidade' | 'id_evento'> | null;
  alt?: string;
  className?: string;
}

export const EventBanner: React.FC<EventBannerProps> = ({
  evento,
  alt,
  className = 'w-full h-full object-cover',
}) => {
  const [failed, setFailed] = useState(false);
  const src = getEventBannerSrc(evento);

  if (failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 flex flex-col items-center justify-center text-emerald-100/80 p-4">
        <Calendar className="w-8 h-8 mb-1.5 opacity-80" />
        <span className="text-[11px] font-semibold tracking-wide text-center line-clamp-1">
          {evento?.titulo || 'IFCE Iventus'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || evento?.titulo || 'Banner do evento IFCE'}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

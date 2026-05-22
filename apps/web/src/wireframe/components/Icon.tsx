type IconName =
  | "play" | "pause" | "note" | "mic" | "record" | "fire" | "clock"
  | "chev" | "star" | "metro" | "plus" | "back" | "pin" | "headphones" | "send";

export function Icon({ name, size = 18, stroke = "currentColor" }: {
  name: IconName; size?: number; stroke?: string;
}) {
  const s = size;
  const paths: Record<IconName, React.ReactNode> = {
    play: <path d="M5 3 L17 10 L5 17 Z" fill={stroke} stroke={stroke} strokeLinejoin="round" strokeWidth={1.5}/>,
    pause: <g fill={stroke}><rect x="5" y="3" width="4" height="14" rx="1"/><rect x="11" y="3" width="4" height="14" rx="1"/></g>,
    note: <g fill="none" stroke={stroke} strokeWidth={1.5}><circle cx="6" cy="15" r="2.4"/><path d="M8.4 15 V 4 L 16 3 V 13"/><circle cx="13.6" cy="13" r="2.4"/></g>,
    mic: <g fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round"><rect x="7" y="2" width="6" height="10" rx="3"/><path d="M4 10 a6 6 0 0 0 12 0"/><path d="M10 16 v3"/></g>,
    record: <circle cx="10" cy="10" r="6" fill={stroke}/>,
    fire: <path d="M10 2 Q 7 6 8 9 Q 5 8 5 12 a5 5 0 0 0 10 0 Q 15 7 12 5 Q 12 3 10 2 Z" fill={stroke}/>,
    clock: <g fill="none" stroke={stroke} strokeWidth={1.5}><circle cx="10" cy="10" r="7"/><path d="M10 5 V 10 L 13 12" strokeLinecap="round"/></g>,
    chev: <path d="M7 4 L 13 10 L 7 16" fill="none" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>,
    star: <path d="M10 2 L12 7 L17 7.5 L13 11 L14.5 16 L10 13.5 L5.5 16 L7 11 L3 7.5 L8 7 Z" fill={stroke}/>,
    metro: <g fill="none" stroke={stroke} strokeWidth={1.5}><path d="M6 17 L8 4 L12 4 L14 17 Z"/><path d="M10 14 L 12 6"/></g>,
    plus: <g stroke={stroke} strokeWidth={2} strokeLinecap="round"><path d="M10 4 V 16"/><path d="M4 10 H 16"/></g>,
    back: <path d="M13 4 L 7 10 L 13 16" fill="none" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>,
    pin: <g fill="none" stroke={stroke} strokeWidth={1.5}><path d="M10 2 L13 5 L11 7 L13 11 L7 11 L9 7 L7 5 Z"/><path d="M10 11 V 18"/></g>,
    headphones: <g fill="none" stroke={stroke} strokeWidth={1.5}><path d="M3 12 a7 7 0 0 1 14 0"/><rect x="3" y="11" width="3" height="6" rx="1"/><rect x="14" y="11" width="3" height="6" rx="1"/></g>,
    send: <path d="M3 10 L17 3 L13 17 L10 11 L3 10 Z" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round"/>,
  };
  return <svg width={s} height={s} viewBox="0 0 20 20">{paths[name]}</svg>;
}

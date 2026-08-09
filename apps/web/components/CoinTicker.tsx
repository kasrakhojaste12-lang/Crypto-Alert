import { CoinIcon } from '@/components/CoinIcon'

const COINS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'TON', 'TRX', 'AVAX']

// Seamless, truly-infinite marquee: the track is 4 copies of the same list and
// the keyframe (in globals.css) shifts it by exactly -25% (= one copy's
// width), so at the moment it "resets" to 0% the on-screen content is pixel
// identical — no visible restart, no gap, regardless of viewport width.
export function CoinTicker() {
  const track = [...COINS, ...COINS, ...COINS, ...COINS]
  return (
    <div className="border-y border-white/[0.05] bg-slate-900/30 py-3 overflow-hidden">
      <div className="flex w-max animate-marquee gap-10 px-5">
        {track.map((sym, i) => (
          <div key={`${sym}-${i}`} className="flex items-center gap-2 shrink-0 opacity-70">
            <CoinIcon base={sym} size={20} />
            <span className="text-sm font-medium text-slate-400">{sym}/USDT</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="Alert Key" className={className} />
}

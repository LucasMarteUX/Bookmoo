export function Logo({ height = 30 }: { height?: number }) {
  return <img src="/site/upoonly-final.svg" alt="Upoonly" width={Math.round(height * 1904 / 625)} height={height} style={{height,width:'auto'}} />
}

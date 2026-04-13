export default function ChunksLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" />
      <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.6" />
      <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.6" />
      <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.3" />
    </svg>
  );
}

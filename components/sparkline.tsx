'use client';

interface SparklineProps {
  data: Array<{ date: string; total: number }>;
}

export function Sparkline({ data }: SparklineProps) {
  if (data.length === 0) return null;

  const values = data.map(d => d.total);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  // Create SVG path
  const width = 96; // w-24 = 96px
  const height = 48; // h-12 = 48px
  const padding = 2;
  const stepX = (width - padding * 2) / (values.length - 1 || 1);

  const points = values.map((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  // Create area path
  const areaPath = `${pathData} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill="url(#sparkline-gradient)"
        className="text-primary"
      />
      <path
        d={pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  );
}

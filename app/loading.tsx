export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true">
      <div className="h-8 w-40 rounded-lg bg-[var(--color-line)]" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="card h-44" />)}
      </div>
      <div className="card h-56" />
    </div>
  );
}

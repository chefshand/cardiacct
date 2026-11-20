export default function Offline() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center text-center">
      <div className="card p-8 max-w-sm space-y-3">
        <h1 className="text-lg font-bold">You&apos;re offline</h1>
        <p className="text-sm text-[var(--color-muted)]">Flashcards you&apos;ve opened recently still work offline; your reviews sync when you reconnect.</p>
        <a href="/review" className="btn btn-primary">Open flashcards</a>
      </div>
    </div>
  );
}

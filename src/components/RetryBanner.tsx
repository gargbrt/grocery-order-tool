export function RetryBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl2 border border-red-200 bg-red-50 p-3 text-center">
      <p className="text-sm text-red-700">{message}</p>
      <button
        onClick={onRetry}
        className="tap-target mt-2 rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700"
      >
        Retry
      </button>
    </div>
  );
}

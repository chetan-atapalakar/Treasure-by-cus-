import "./QuoteLoader.css";

interface QuoteLoaderProps {
  /** Contextual message, e.g. "Gathering your financial picture..." */
  message?: string;
  size?: "sm" | "md" | "lg";
  fullscreen?: boolean;
}

export default function QuoteLoader({
  message = "Gathering your financial picture...",
  size = "md",
  fullscreen = false,
}: QuoteLoaderProps) {
  return (
    <div
      className={`quote quote--${size}${fullscreen ? " quote--fullscreen" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="quote__marks" aria-hidden="true">
        <span className="quote__mark quote__mark--open">“</span>
        <span className="quote__mark quote__mark--close">”</span>
      </div>
      <p className="quote__msg">{message}</p>
    </div>
  );
}
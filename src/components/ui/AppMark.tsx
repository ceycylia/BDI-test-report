type AppMarkProps = {
  compact?: boolean;
};

export function AppMark({ compact = false }: AppMarkProps) {
  return (
    <div
      className={`app-mark${compact ? " app-mark--compact" : ""}`}
      aria-label="Aplikasi Penyelenggaraan Diklat - BDI Medan"
    >
      <span className="app-mark__logo" aria-hidden="true">
        <img src="/bdi-logo.jpg" alt="" />
      </span>

      {!compact && (
        <span className="app-mark__text">
          <strong>Aplikasi Penyelenggaraan</strong>
          <span className="app-mark__second-line">
            <strong>Diklat -</strong><small>BDI Medan</small>
          </span>
        </span>
      )}
    </div>
  );
}

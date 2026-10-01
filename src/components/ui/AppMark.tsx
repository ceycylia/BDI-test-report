type AppMarkProps = {
  compact?: boolean;
};

export function AppMark({ compact = false }: AppMarkProps) {
  return (
    <div
      className={`app-mark${compact ? " app-mark--compact" : ""}`}
      aria-label="Sistem Tes Pelatihan BDI Medan"
    >
      <span className="app-mark__logo" aria-hidden="true">
        <img src="/bdi-logo.jpg" alt="" />
      </span>

      {!compact && (
        <span className="app-mark__text">
          <strong>Sistem Tes Pelatihan</strong>
          <small>BDI Medan</small>
        </span>
      )}
    </div>
  );
}
type FoundationNoticeProps = {
  children: string;
};

export function FoundationNotice({ children }: FoundationNoticeProps) {
  return (
    <div className="notice" role="status">
      <span className="notice__bar" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

import styles from "./match-form-tip.module.css";

/** Shared footer tip line used on member/admin recommendation rows. */
export function MatchFormTip({
  tip,
  className,
}: {
  tip: string | null | undefined;
  className?: string;
}) {
  if (!tip?.trim()) return null;
  return (
    <p className={`${styles.tip}${className ? ` ${className}` : ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
        <path
          d="M4 19V5h2.2l1.1 3H18a1 1 0 0 1 .95 1.3l-1.5 5A1.5 1.5 0 0 1 16 15.5H8.4L7.2 19H4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span>{tip}</span>
    </p>
  );
}

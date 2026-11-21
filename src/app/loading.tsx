import Image from "next/image";

import styles from "./loading.module.css";

function TacticsOverlay() {
  return (
    <svg className={styles.tactics} viewBox="0 0 1200 700" fill="none" aria-hidden>
      <ellipse
        cx="600"
        cy="360"
        rx="420"
        ry="230"
        stroke="rgba(96,165,250,0.28)"
        strokeWidth="2"
      />
      <path
        d="M180 520 C320 430, 420 360, 560 300 S820 210, 980 160"
        stroke="rgba(34,197,94,0.55)"
        strokeWidth="2.5"
        strokeDasharray="8 9"
      />
      <path
        d="M240 560 C380 470, 500 390, 650 330 S900 240, 1040 190"
        stroke="rgba(96,165,250,0.4)"
        strokeWidth="2"
        strokeDasharray="5 9"
      />
      <circle className={styles.pulse} cx="420" cy="380" r="7" fill="#3b82f6" />
      <circle className={`${styles.pulse} ${styles.pulseDelay}`} cx="560" cy="300" r="9" fill="#22c55e" />
      <circle className={styles.pulse} cx="720" cy="250" r="7" fill="#60a5fa" />
      <circle className={`${styles.pulse} ${styles.pulseDelay}`} cx="880" cy="200" r="8" fill="#22c55e" />
      <circle cx="560" cy="300" r="22" stroke="rgba(34,197,94,0.35)" strokeWidth="2" />
      <circle cx="720" cy="250" r="18" stroke="rgba(59,130,246,0.3)" strokeWidth="2" />
    </svg>
  );
}

export default function Loading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-live="polite">
      <div className={styles.backdrop} aria-hidden>
        <Image
          className={styles.backdropImage}
          src="/brand/landing-pitch.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.backdropScrim} />
        <TacticsOverlay />
      </div>

      <section className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} data-no-translate>
            W
          </span>
          <p className={styles.brandName} data-no-translate>
            WINIQ
          </p>
        </div>

        <div className={styles.body}>
          <div className={styles.copy}>
            <h1 className={styles.title}>Preparing page</h1>
            <p className={styles.lede}>
              Data is loading securely. Please wait a moment.
            </p>
            <div className={styles.progressTrack} aria-hidden>
              <i className={styles.progressFill} />
            </div>
          </div>
          <div className={styles.spinner} aria-hidden />
        </div>
      </section>
    </main>
  );
}

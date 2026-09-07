import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { loadProductionDataCoverageSnapshot } from "@/lib/production-data-coverage-snapshot";
import { loadProductionOperationsDashboard } from "@/lib/production-operations-dashboard";
import { loadProductionResultReconciliationSnapshot } from "@/lib/production-result-reconciliation-snapshot";

import styles from "./operations-page.module.css";

export const dynamic = "force-dynamic";

function dateTime(value: string | null): string {
  if (!value) return "Henüz yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function roi(value: number | null): string {
  return value === null ? "Veri birikiyor" : `%${value.toFixed(1)}`;
}

function tone(value: string | null): string {
  if (value === "HEALTHY") return styles.good;
  if (value === "CRITICAL") return styles.danger;
  return styles.warning;
}

function apiTone(
  state: string | undefined,
): string {
  if (state === "CONNECTED") return styles.good;
  if (state === "NOT_CONFIGURED") return styles.danger;
  return styles.warning;
}

function reconciliationTone(
  state: string | undefined,
): string {
  if (state === "HEALTHY") return styles.good;
  if (state === "CRITICAL") return styles.danger;
  return styles.warning;
}

function quotaValue(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("tr-TR").format(value);
}

export default async function OperationsPage() {
  const [
    dashboard,
    coverage,
    reconciliation,
  ] = await Promise.all([
    loadProductionOperationsDashboard(),
    loadProductionDataCoverageSnapshot(),
    loadProductionResultReconciliationSnapshot(),
  ]);

  return (
    <PageShell>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>V4 PRODUCTION OPERATIONS</p>
          <h1>Üretim Operasyon Merkezi</h1>
          <p className={styles.subtitle}>
            Yedekler, performans raporları, model sağlığı ve yerel bildirim kuyruğu
            tek bir salt okunur görünümde izlenir.
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.readOnlyBadge}>SALT OKUNUR</span>
          <Link className={styles.homeLink} href="/">Ana sayfa</Link>
        </div>
      </header>

      <section className={styles.metricGrid} aria-label="Üretim özeti">
        <article className={styles.metricCard}>
          <span>SON YEDEK</span>
          <strong>{dashboard.backup.id ?? "—"}</strong>
          <small>
            {dashboard.backup.available
              ? `${dashboard.backup.fileCount} dosya • ${megabytes(dashboard.backup.totalBytes)}`
              : "Doğrulanabilir manifest bulunamadı"}
          </small>
        </article>
        <article className={styles.metricCard}>
          <span>GÜNLÜK RAPOR</span>
          <strong>{dashboard.dailyReport.key ?? "—"}</strong>
          <small>{dashboard.dailyReport.settled} sonuç • {roi(dashboard.dailyReport.roi)}</small>
        </article>
        <article className={styles.metricCard}>
          <span>HAFTALIK ROI</span>
          <strong className={dashboard.weeklyReport.roi === null ? undefined : styles.good}>
            {roi(dashboard.weeklyReport.roi)}
          </strong>
          <small>
            {dashboard.weeklyReport.key ?? "Rapor yok"} • {dashboard.weeklyReport.settled} sonuç
          </small>
        </article>
        <article className={styles.metricCard}>
          <span>MODEL SAĞLIĞI</span>
          <strong className={tone(dashboard.health.currentLevel)}>
            {dashboard.health.currentLevel ?? "VERİ YOK"}
          </strong>
          <small>{dateTime(dashboard.health.lastObservedAt)}</small>
        </article>
      </section>

      <section className={styles.coveragePanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>V5.1 DATA COVERAGE</p>
            <h2>2026 Veri Kapsamı ve API Kotası</h2>
          </div>
          <span>
            {coverage
              ? dateTime(coverage.generatedAt)
              : "Anlık görüntü bekleniyor"}
          </span>
        </div>

        {!coverage ? (
          <p className={styles.empty}>
            Veri kapsamı henüz oluşturulmadı. Terminalde pnpm run
            coverage:production komutunu çalıştırın.
          </p>
        ) : (
          <>
            <div className={styles.coverageMetrics}>
              <article>
                <span>API-FOOTBALL</span>
                <strong className={apiTone(coverage.api.state)}>
                  {coverage.api.plan ?? coverage.api.state}
                </strong>
                <small>
                  {coverage.api.active === true
                    ? "Abonelik aktif"
                    : coverage.api.active === false
                      ? "Abonelik pasif"
                      : "Durum bilgisi alınamadı"}
                </small>
              </article>

              <article>
                <span>GÜNLÜK API KOTASI</span>
                <strong>
                  {quotaValue(coverage.api.remainingToday)}
                </strong>
                <small>
                  {quotaValue(coverage.api.usedToday)} kullanıldı • {quotaValue(coverage.api.dailyLimit)} limit
                </small>
              </article>

              <article>
                <span>2026 FİKSTÜRLERİ</span>
                <strong>{quotaValue(coverage.totals.fixtures)}</strong>
                <small>
                  {coverage.totals.leagues} lig • {coverage.totals.finished} sonuçlandı
                </small>
              </article>

              <article>
                <span>SKOR KONTROLÜ</span>
                <strong className={coverage.totals.missingFinalScores === 0 ? styles.good : styles.warning}>
                  {coverage.totals.missingFinalScores}
                </strong>
                <small>
                  sonuçlanmış fakat skoru eksik maç
                </small>
              </article>

              <article>
                <span>YAYIMLANMIŞ ADAY</span>
                <strong>{coverage.totals.publishedCandidates}</strong>
                <small>
                  Seçim Politikası V2 filtresini geçen maç
                </small>
              </article>
            </div>

            <div className={styles.coverageTableWrap}>
              <table className={styles.coverageTable}>
                <thead>
                  <tr>
                    <th>Lig</th>
                    <th>Fikstür</th>
                    <th>Sonuçlandı</th>
                    <th>Planlandı</th>
                    <th>Eksik skor</th>
                    <th>Tahmin adayı</th>
                    <th>Son güncelleme</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.leagues.map((league) => (
                    <tr key={league.leagueApiId}>
                      <td>
                        <strong>{league.leagueName}</strong>
                        <small>API {league.leagueApiId}</small>
                      </td>
                      <td>{league.fixtures}</td>
                      <td>{league.finished}</td>
                      <td>{league.scheduled}</td>
                      <td className={league.missingFinalScores === 0 ? styles.good : styles.warning}>
                        {league.missingFinalScores}
                      </td>
                      <td>{league.publishedCandidates}</td>
                      <td>{dateTime(league.lastDatabaseUpdateAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className={styles.coveragePanel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>V5.3 RESULT RECONCILIATION</p>
            <h2>Sonuç Uzlaştırma ve Skor Uyarıları</h2>
          </div>
          <span>
            {reconciliation
              ? dateTime(reconciliation.generatedAt)
              : "Anlık görüntü bekleniyor"}
          </span>
        </div>

        {!reconciliation ? (
          <p className={styles.empty}>
            Sonuç denetimi henüz oluşturulmadı. Terminalde pnpm run
            reconcile:results-v5 komutunu çalıştırın.
          </p>
        ) : (
          <>
            <div className={styles.coverageMetrics}>
              <article>
                <span>UZLAŞTIRMA DURUMU</span>
                <strong className={reconciliationTone(reconciliation.status)}>
                  {reconciliation.status}
                </strong>
                <small>{reconciliation.issueCount} aktif uyarı</small>
              </article>

              <article>
                <span>EKSİK FİNAL SKORU</span>
                <strong className={reconciliation.missingFinalScores === 0 ? styles.good : styles.warning}>
                  {reconciliation.missingFinalScores}
                </strong>
                <small>FINISHED fakat skoru eksik</small>
              </article>

              <article>
                <span>BEKLEYEN SONUÇLANDIRMA</span>
                <strong className={reconciliation.pendingSettlements === 0 ? styles.good : styles.warning}>
                  {reconciliation.pendingSettlements}
                </strong>
                <small>Skoru var fakat tahmin PENDING</small>
              </article>

              <article>
                <span>SKOR UYUŞMAZLIĞI</span>
                <strong className={reconciliation.archiveScoreMismatches === 0 ? styles.good : styles.danger}>
                  {reconciliation.archiveScoreMismatches}
                </strong>
                <small>Arşiv ve veritabanı karşılaştırması</small>
              </article>

              <article>
                <span>GECİKMİŞ DURUM</span>
                <strong className={reconciliation.overdueStatuses === 0 ? styles.good : styles.warning}>
                  {reconciliation.overdueStatuses}
                </strong>
                <small>Başlama saatinden 6+ saat sonra açık</small>
              </article>
            </div>

            {reconciliation.issues.length === 0 ? (
              <div className={styles.reconciliationHealthy}>
                <strong>SONUÇLAR TUTARLI</strong>
                <span>
                  Eksik skor, bekleyen sonuçlandırma, arşiv uyuşmazlığı veya gecikmiş maç durumu bulunmadı.
                </span>
              </div>
            ) : (
              <div className={styles.reconciliationList}>
                {reconciliation.issues.map((issue) => (
                  <article
                    className={styles.reconciliationIssue}
                    key={`${issue.matchId}-${issue.code}`}
                  >
                    <div>
                      <strong className={issue.severity === "CRITICAL" ? styles.danger : styles.warning}>
                        {issue.code.replaceAll("_", " ")}
                      </strong>
                      <span>{issue.leagueName} • {issue.match}</span>
                    </div>
                    <div className={styles.rowMeta}>
                      <span>{issue.detail}</span>
                      <time>{dateTime(issue.kickoffAt)}</time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className={styles.lockPanel}>
        <div>
          <strong>ÜRETİM KİLİDİ AKTİF</strong>
          <span>{dashboard.production.champion} Champion değişmeden kalır.</span>
        </div>
        <div className={styles.lockTags}>
          <span>OTOMATİK DEĞİŞİM KAPALI</span>
          <span>UZAKTAN AKTİVASYON KAPALI</span>
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>SON 10 KAYIT</p>
              <h2>Model Sağlığı Olayları</h2>
            </div>
            <span>{dashboard.recentHealthEvents.length} kayıt</span>
          </div>
          {dashboard.recentHealthEvents.length === 0 ? (
            <p className={styles.empty}>Henüz sağlık olayı kaydedilmedi.</p>
          ) : (
            <div className={styles.list}>
              {dashboard.recentHealthEvents.map((event) => (
                <article className={styles.listRow} key={`${event.observedAt}-${event.reason}`}>
                  <div>
                    <strong className={tone(event.level)}>{event.level}</strong>
                    <span>{event.reason.replaceAll("_", " ")}</span>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>{event.independentSelections ?? "—"} bağımsız sonuç</span>
                    <time>{dateTime(event.observedAt)}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>YEREL OUTBOX</p>
              <h2>Bildirim Kuyruğu</h2>
            </div>
            <span>{dashboard.notifications.length} kayıt</span>
          </div>
          {dashboard.notifications.length === 0 ? (
            <p className={styles.empty}>Henüz yerel bildirim oluşturulmadı.</p>
          ) : (
            <div className={styles.list}>
              {dashboard.notifications.map((notification) => (
                <article className={styles.listRow} key={`${notification.createdAt}-${notification.title}`}>
                  <div>
                    <strong className={tone(notification.severity)}>{notification.severity}</strong>
                    <span>{notification.reason.replaceAll("_", " ")}</span>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>
                      {notification.deliveryStatus === "DELIVERED"
                        ? "HTTPS ile teslim edildi"
                        : notification.deliveryStatus === "FAILED"
                          ? "Teslimat başarısız"
                          : "Yerel kuyrukta bekliyor"}
                    </span>
                    <time>{dateTime(notification.deliveredAt ?? notification.createdAt)}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className={styles.footerNote}>
        <strong>GİZLİLİK SINIRI</strong>
        <span>
          Bu ekran yalnızca özet metadata okur; .env içeriği, veritabanı parolası,
          API anahtarı ve PostgreSQL dump içeriği okunmaz.
        </span>
      </footer>
    </PageShell>
  );
}

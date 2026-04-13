import { fontJp } from '@/styles/fonts'
import styles from './UiDemo.module.css'

type UiDemoPageProps = {
  searchParams?: { glass?: string }
}

export default function UiDemoPage({ searchParams }: UiDemoPageProps) {
  const isStrongGlass = searchParams?.glass === 'strong'

  return (
    <div className={`${styles.page} ${fontJp.className} ${isStrongGlass ? styles.glassStrong : ''}`}>
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.desk} aria-hidden="true" />
      <div className={styles.deskEdgeShadow} aria-hidden="true" />

      <div className={styles.content}>
        <header className={styles.topBar}>
          <div className={`${styles.glassPanel} ${styles.weatherChip}`}>
            <span className={styles.weatherLabel}>天気：晴れ</span>
            <span className={styles.weatherStatus}>今は静かなようです。</span>
          </div>
        </header>

        <main className={styles.panels}>
          <section className={`${styles.glassPanel} ${styles.panel} ${styles.panelLeft}`}>
            <div className={styles.panelHeader}>
              <span className={styles.mailIcon} aria-hidden="true">
                🗨️
              </span>
              <span className={styles.panelTitle}>会話</span>
            </div>

            <div className={styles.messageCard}>
              <div className={styles.messageRow}>
                <span className={styles.initial}>A</span>
                <span>「今日はいい天気だね。」</span>
                <span className={styles.time}>14:00</span>
              </div>
              <div className={styles.messageRow}>
                <span className={styles.initial}>B</span>
                <span>「うん、散歩日和。」</span>
                <button className={styles.link} type="button">
                  見てみる &gt;
                </button>
              </div>
            </div>

            <div className={styles.messageCard}>
              <div className={styles.messageRow}>
                <span className={styles.initial}>C</span>
                <span>「昨日の本、面白かった。」</span>
                <span className={styles.time}>13:30</span>
              </div>
              <div className={styles.messageRow}>
                <span className={styles.initial}>D</span>
                <span>「へえ、そうなんだ」</span>
                <button className={styles.link} type="button">
                  見てみる &gt;
                </button>
              </div>
            </div>
          </section>

          <section className={`${styles.glassPanel} ${styles.panel} ${styles.panelCenter}`}>
            <div className={styles.panelHeader}>
              <span className={styles.mailIcon} aria-hidden="true">
                ✉
              </span>
              <span className={styles.panelTitle}>相談</span>
            </div>

            <div className={styles.messageCard}>
              <div className={styles.consultationRow}>
                <span className={styles.consultationTime}>14:10</span>
                <span className={styles.consultationMessage}>
                  <span>
                    <span className={styles.consultationName}>B</span>
                    から
                  </span>
                  <span>　相談が届いています</span>
                </span>
                <button className={styles.consultationAction} type="button">
                  回答する &gt;
                </button>
              </div>
            </div>

            <div className={styles.messageCard}>
              <div className={styles.consultationRow}>
                <span className={styles.consultationTime}>13:55</span>
                <span className={styles.consultationMessage}>
                  <span>
                    <span className={styles.consultationName}>A</span>
                    から
                  </span>
                  <span>　相談が届いています</span>
                </span>
                <button className={styles.consultationAction} type="button">
                  回答する &gt;
                </button>
              </div>
            </div>
          </section>

          <section className={`${styles.glassPanel} ${styles.panel} ${styles.panelRight}`}>
            <div className={styles.panelHeader}>
              <span className={styles.mailIcon} aria-hidden="true">
                🧑‍🤝‍🧑
              </span>
              <span className={styles.panelTitle}>みんなの様子</span>
              <div className={styles.panelControls}>
                <button className={styles.sortButton} type="button">
                  並び替え
                </button>
                <input className={styles.searchInput} placeholder="検索" />
              </div>
            </div>

            <div className={styles.statusList}>
              {[
                { id: 'A', tone: styles.toneGreen },
                { id: 'B', tone: styles.toneGreen },
                { id: 'C', tone: styles.toneGreen },
                { id: 'D', tone: styles.toneBlue },
              ].map(item => (
                <div key={item.id} className={styles.statusRow}>
                  <span className={`${styles.statusDot} ${item.tone}`} />
                  <span className={styles.statusName}>{item.id}</span>
                  <button className={styles.peekButton} type="button">
                    覗く
                  </button>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <button className={`${styles.navButton} ${styles.navButtonLeft}`} type="button">
            ← 日報
          </button>
          <div className={`${styles.glassPanel} ${styles.timeCard}`}>
            <span className={styles.date}>2026/01/16</span>
            <span className={styles.clock}>14:00:00</span>
          </div>
          <button className={`${styles.navButton} ${styles.navButtonRight}`} type="button">
            管理室 →
          </button>
        </footer>
      </div>
    </div>
  )
}

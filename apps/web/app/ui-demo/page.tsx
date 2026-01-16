'use client';

export default function UiDemoPage() {
  return (
    <div className="scene" role="application" aria-label="Reladen UI demo scene">
      <div className="sky" aria-hidden="true" />
      <div className="desk" aria-hidden="true" />

      <div className="ui">
        <div className="topbar glass" aria-label="環境情報">
          <span className="badge">天気：晴れ</span>
          <span className="sep" aria-hidden="true" />
          <span className="state">今は静かなようです。</span>
        </div>

        <div className="mid" aria-label="窓パネル領域">
          <section className="panel glass" aria-label="通知・相談">
            <div className="notif-head">
              <div className="icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="rgba(10,20,35,.85)" strokeWidth="1.6"/>
                  <path d="M6 8l6 4 6-4" stroke="rgba(10,20,35,.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="notif-title">太郎から相談が届いています。</div>
            </div>

            <div className="card" aria-label="通知カード1">
              <div className="talk-row">
                <div className="who">A</div>
                <div>「今日はいい天気だね。」</div>
                <div className="time">14:00</div>
              </div>
              <div className="talk-row">
                <div className="who">B</div>
                <div>「うん、散歩日和。」</div>
                <div />
              </div>
              <a className="see" href="#" onClick={(e) => e.preventDefault()}>
                見てみる &gt;
              </a>
            </div>

            <div className="card" aria-label="通知カード2">
              <div className="talk-row">
                <div className="who">C</div>
                <div>「昨日の本、面白かった。」</div>
                <div className="time">13:30</div>
              </div>
              <div className="talk-row">
                <div className="who">D</div>
                <div>「へえ、そうなんだ」</div>
                <div />
              </div>
              <a className="see" href="#" onClick={(e) => e.preventDefault()}>
                見てみる &gt;
              </a>
            </div>
          </section>

          <section className="panel glass" aria-label="みんなの様子">
            <div className="right-head">
              <div className="title">みんなの様子</div>
              <div className="tools" aria-label="一覧操作">
                <select className="select" aria-label="並べ替え（ダミー）" defaultValue="sort">
                  <option value="sort">並べ替え</option>
                  <option value="name">名前順</option>
                  <option value="state">状態順</option>
                </select>

                <div className="search-wrap" aria-label="検索（ダミー）">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="rgba(10,20,35,.75)" strokeWidth="1.6"/>
                    <path d="M16.8 16.8 21 21" stroke="rgba(10,20,35,.75)" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                  <input className="search" placeholder="検索" />
                </div>
              </div>
            </div>

            <div className="list" role="list" aria-label="住人一覧（ダミー）">
              {[
                { name: "A", color: "green" },
                { name: "B", color: "green" },
                { name: "C", color: "green" },
                { name: "D", color: "blue" },
              ].map((r) => (
                <div className="row" role="listitem" key={r.name}>
                  <div className={`dot ${r.color}`} aria-hidden="true" />
                  <div><strong>{r.name}</strong></div>
                  <button className="peek" type="button" aria-label={`覗く ${r.name}（ダミー）`}>
                    覗く
                  </button>
                </div>
              ))}
              <div style={{ height: 140 }} />
            </div>
          </section>
        </div>

        <div className="bottom" aria-label="机上の案内と時計">
          <div className="navHint left">←　日報へ</div>

          <div className="clock" aria-label="時計（固定表示）">
            <div className="date">2026/01/16</div>
            <div className="now">14:00:00</div>
          </div>

          <div className="navHint right">管理室へ　→</div>
        </div>
      </div>

      {/* このページ専用のCSS（分離したければ css module に移してください） */}
      <style jsx>{`
        :global(html, body) { height: 100%; }
        :global(body) { margin: 0; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; }

        :global(:root){
          --glass-bg: rgba(255,255,255,.16);
          --glass-stroke: rgba(255,255,255,.34);
          --glass-shadow: rgba(0,0,0,.14);
          --text: rgba(10,20,35,.92);
          --muted: rgba(10,20,35,.70);
          --panel-radius: 14px;
        }

        .scene{ position: relative; height: 100vh; width: 100vw; color: var(--text); background: #bfe6ff; }
        .sky{
          position: absolute; inset: 0;
          background:
            radial-gradient(900px 500px at 70% 20%, rgba(255,255,255,.55), rgba(255,255,255,0) 60%),
            radial-gradient(420px 320px at 25% 18%, rgba(255,255,255,.35), rgba(255,255,255,0) 65%),
            linear-gradient(180deg, #9fd7ff 0%, #bfeaff 45%, #e9f7ff 100%);
        }
        .sky::before{
          content:""; position:absolute; inset:-10%;
          background:
            radial-gradient(120px 60px at 12% 32%, rgba(255,255,255,.65), rgba(255,255,255,0) 70%),
            radial-gradient(180px 80px at 22% 38%, rgba(255,255,255,.55), rgba(255,255,255,0) 72%),
            radial-gradient(220px 90px at 42% 30%, rgba(255,255,255,.50), rgba(255,255,255,0) 74%),
            radial-gradient(140px 70px at 68% 35%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),
            radial-gradient(220px 90px at 80% 28%, rgba(255,255,255,.50), rgba(255,255,255,0) 74%);
          filter: blur(6px); opacity: .85;
        }
        .sky::after{
          content:""; position:absolute; inset:0;
          background:
            linear-gradient(120deg, rgba(255,255,255,.18), rgba(255,255,255,0) 40%),
            linear-gradient(300deg, rgba(255,255,255,.10), rgba(255,255,255,0) 35%);
          mix-blend-mode: screen;
        }

        .desk{
          position: absolute; left: 0; right: 0; bottom: 0;
          height: min(32vh, 320px);
          background:
            linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.18)),
            repeating-linear-gradient(90deg, rgba(140,92,48,.55) 0px, rgba(140,92,48,.55) 26px, rgba(120,76,38,.55) 26px, rgba(120,76,38,.55) 52px);
          box-shadow: 0 -24px 60px rgba(0,0,0,.18);
        }

        .ui{ position:absolute; inset:0; display:grid; grid-template-rows:auto 1fr auto; padding: 22px 26px 18px; gap: 14px; }

        .glass{
          position: relative;
          background: var(--glass-bg);
          border: 1px solid var(--glass-stroke);
          box-shadow: 0 14px 36px var(--glass-shadow);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-radius: var(--panel-radius);
        }
        .glass::before{
          content:""; position:absolute; inset:0; border-radius:inherit;
          background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0) 40%);
          pointer-events:none;
        }

        .topbar{ height: 44px; display:flex; align-items:center; gap: 18px; padding: 0 14px; border-radius: 10px; }
        .badge{ font-weight: 600; letter-spacing: .02em; }
        .sep{ width:1px; height:18px; background: rgba(255,255,255,.35); }
        .state{ color: var(--muted); font-weight: 560; }

        /* left half / right half on the window */
        .mid{ display:grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items:start; padding-bottom: min(32vh, 320px); }
        .panel{ padding: 16px; min-height: 360px; }

        .notif-head{ display:flex; align-items:center; gap: 10px; margin-bottom: 14px; }
        .icon{ width: 28px; height: 28px; display:grid; place-items:center; border-radius: 9px; background: rgba(255,255,255,.22); border: 1px solid rgba(255,255,255,.28); }
        .notif-title{ font-weight: 700; }

        .card{ padding: 12px; border-radius: 12px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.22); margin-top: 10px; }
        .talk-row{ display:grid; grid-template-columns: 32px 1fr auto; gap: 10px; align-items:baseline; line-height: 1.35; margin-bottom: 6px; }
        .who{ font-weight: 800; opacity: .92; }
        .time{ color: var(--muted); font-variant-numeric: tabular-nums; font-size: 13px; }
        .see{ display:flex; justify-content:flex-end; margin-top: 6px; color: rgba(0,40,90,.80); font-weight: 650; text-decoration:none; }
        .see:hover{ text-decoration: underline; }

        .right-head{ display:flex; align-items:center; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
        .title{ font-weight: 800; font-size: 18px; letter-spacing:.02em; }
        .tools{ display:flex; align-items:center; gap: 10px; flex-wrap: wrap; justify-content:flex-end; }
        .select{ height: 32px; border-radius: 10px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.22); padding: 0 10px; }
        .search-wrap{ display:flex; align-items:center; gap: 8px; padding: 0 10px; height: 32px; border-radius: 10px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.22); }
        .search{ border: none; outline:none; background: transparent; width: 170px; }

        .list{ margin-top: 10px; max-height: 420px; overflow:auto; padding-right: 6px; }
        .row{ display:grid; grid-template-columns: 18px 1fr auto; gap: 12px; align-items:center; padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.10); margin-bottom: 10px; }
        .dot{ width:12px; height:12px; border-radius:999px; border: 1px solid rgba(255,255,255,.65); box-shadow: 0 0 0 3px rgba(255,255,255,.10); }
        .green{ background: rgba(70,210,120,.95); }
        .blue{ background: rgba(70,150,230,.95); }
        .peek{ height: 34px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.18); font-weight: 700; cursor: default; }

        .bottom{
          height: min(32vh, 320px);
          display:grid;
          grid-template-columns: 1fr auto 1fr;
          align-items:end;
          padding-bottom: 18px;
        }
        .navHint{
          color: rgba(255,255,255,.86);
          text-shadow: 0 1px 10px rgba(0,0,0,.22);
          font-weight: 750;
          letter-spacing: .02em;
          user-select:none;
          padding: 0 8px;
        }
        .left{ justify-self: start; }
        .right{ justify-self: end; }
        .clock{
          justify-self:center;
          min-width: 240px;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(240,240,240,.25);
          border: 1px solid rgba(255,255,255,.35);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 10px 26px rgba(0,0,0,.20);
          text-align:center;
          font-variant-numeric: tabular-nums;
        }
        .date{ font-weight: 800; color: rgba(255,255,255,.92); text-shadow: 0 1px 12px rgba(0,0,0,.18); margin-bottom: 4px; }
        .now{ font-size: 22px; font-weight: 900; color: rgba(255,255,255,.95); text-shadow: 0 1px 16px rgba(0,0,0,.20); }

        @media (max-width: 920px){
          .mid{ grid-template-columns: 1fr; }
          .bottom{ grid-template-columns: 1fr; gap: 10px; justify-items:center; }
          .left, .right{ justify-self:center; }
          .search{ width: 140px; }
        }
      `}</style>
    </div>
  );
}

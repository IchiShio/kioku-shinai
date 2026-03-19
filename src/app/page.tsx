import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen px-6">
      {/* Hero */}
      <section className="text-center pt-24 pb-12 max-w-md">
        <div className="text-xs tracking-[0.3em] text-text2 uppercase mb-6">
          A New Way to Learn Vocabulary
        </div>
        <h1 className="text-[2.5rem] font-bold tracking-tight leading-tight mb-5">
          記憶しない
          <br />
          <span className="text-accent2">英単語</span>
        </h1>
        <p className="text-base leading-relaxed text-text2 mb-3">
          記憶した単語は消える。
        </p>
        <p className="text-base leading-relaxed text-foreground mb-10">
          理解した単語は残る。
        </p>

        <Link
          href="/trial"
          className="inline-flex items-center gap-2 bg-accent text-white font-semibold py-4 px-10 rounded-full text-base hover:bg-accent2 hover:text-background transition-all hover:-translate-y-0.5 animate-pulse-glow"
        >
          無料で体験する
          <span className="text-lg">→</span>
        </Link>
        <p className="text-xs text-text2 mt-4">
          100語 × 5形式 = 500問を無料で体験
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-md w-full pb-20 space-y-4">
        <div className="text-xs tracking-[0.2em] text-text2 uppercase text-center mb-6">
          Why it works
        </div>

        {/* Card 1 */}
        <div className="bg-surface rounded-2xl p-5 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0 text-lg">
            🔬
          </div>
          <div>
            <h3 className="text-sm font-bold mb-1">語源で分解する</h3>
            <p className="text-xs text-text2 leading-relaxed">
              EtymOnline・OED裏取り済み。単語を語根に分解して核の意味を掴む。
            </p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface rounded-2xl p-5 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0 text-lg">
            🧠
          </div>
          <div>
            <h3 className="text-sm font-bold mb-1">認知言語学で感じる</h3>
            <p className="text-xs text-text2 leading-relaxed">
              Lakoff等の研究に基づき、英語話者の「身体感覚」で理解する。
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface rounded-2xl p-5 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-correct/15 flex items-center justify-center flex-shrink-0 text-lg">
            🔄
          </div>
          <div>
            <h3 className="text-sm font-bold mb-1">5形式で多角的に</h3>
            <p className="text-xs text-text2 leading-relaxed">
              同じ単語を5つの角度から出題。正解なら難化、間違えたら別角度で再出題。
            </p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-surface rounded-2xl p-5 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-wrong/15 flex items-center justify-center flex-shrink-0 text-lg">
            🔊
          </div>
          <div>
            <h3 className="text-sm font-bold mb-1">6声のネイティブ音声</h3>
            <p className="text-xs text-text2 leading-relaxed">
              英・米・豪の男女6声。全例文に音声付き。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

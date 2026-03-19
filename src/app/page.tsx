import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <h1 className="text-6xl font-black tracking-tight text-ink leading-[1.1] text-center mb-6">
          記憶しない
          <br />
          英単語
        </h1>
        <div className="w-12 h-0.5 bg-accent mb-6" />
        <p className="text-xl text-ink font-medium text-center mb-2">
          記憶した単語は消える。
        </p>
        <p className="text-xl text-accent font-bold text-center mb-12">
          理解した単語は残る。
        </p>

        <Link
          href="/trial"
          className="bg-accent text-white font-bold text-lg py-5 px-14 rounded-full hover:bg-accent2 transition-colors"
        >
          無料で体験する
        </Link>
      </section>

      {/* Features */}
      <section className="bg-surface border-t border-border px-6 py-16">
        <div className="max-w-lg mx-auto space-y-10">
          <div>
            <h3 className="text-2xl font-black text-ink mb-3">語源で分解する</h3>
            <p className="text-base text-text2 leading-relaxed">
              company = com（一緒に）+ panis（パン）。
              <br />
              「パンを分け合う仲間」が原義。全てEtymOnline裏取り済み。
            </p>
          </div>
          <div className="h-px bg-border" />
          <div>
            <h3 className="text-2xl font-black text-ink mb-3">認知言語学で感じる</h3>
            <p className="text-base text-text2 leading-relaxed">
              volatile = 「飛び去りやすい」。unstableは「倒れそう」。
              <br />
              Lakoff等の研究に基づく、英語話者の身体感覚で理解する。
            </p>
          </div>
          <div className="h-px bg-border" />
          <div>
            <h3 className="text-2xl font-black text-ink mb-3">5つの角度で出題</h3>
            <p className="text-base text-text2 leading-relaxed">
              同じ単語を穴埋め、語源クイズ、コロケーション、例文推測で。
              <br />
              正解したら難化。間違えたら別角度から。機械的な繰り返しゼロ。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

import Arena from "@/components/Arena";
import Faq from "@/components/Faq";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <div className="mb-3 text-[11px] uppercase tracking-widest text-muted">
          Storage Arena
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
          Storage network checker
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Upload one file and watch how each network handles it — the speed, the
          steps, and where your bytes actually land. Or replay the recorded
          averages, no upload needed.
        </p>
      </header>

      {/* the tool sits in its own pure-white card, set apart from the off-white
          page; each network inside returns to off-white (layered, Bungee-style) */}
      <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-20px_rgba(0,0,0,0.18)] sm:p-6">
        <Arena />
      </div>
      <Faq />
    </main>
  );
}

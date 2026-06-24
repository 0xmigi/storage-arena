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
          Four storage networks. One file.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Send a file to Tapedrive, Walrus, IPFS, and S3 at once and watch how
          each one handles it — or replay the averaged runs. Tap any step to see
          how it works.
        </p>
      </header>

      <Arena />
      <Faq />
    </main>
  );
}

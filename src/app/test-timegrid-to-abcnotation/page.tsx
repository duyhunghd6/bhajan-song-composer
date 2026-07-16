import { loadAllSongs } from "@/lib/songs/loader";
import TimeGridToAbcNotationClient from "./TimeGridToAbcNotationClient";

export default async function TestTimeGridToAbcNotationPage() {
  const songs = await loadAllSongs();
  const song = songs.find(candidate => candidate.meta.slug.toLowerCase() === "ganesha");
  const melodyAbc = song?.abcNotations.find(notation => notation.type === "melody")?.content;

  if (!melodyAbc) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8">
          <h1 className="text-2xl font-bold text-rose-200">Ganesha melody notation was not found</h1>
          <p className="mt-3 text-sm leading-6 text-rose-100/80">
            This diagnostic reads the saved <code>ganesha</code> catalog melody, so it cannot run until that notation is available.
          </p>
        </div>
      </main>
    );
  }

  return <TimeGridToAbcNotationClient sourceAbc={melodyAbc} />;
}

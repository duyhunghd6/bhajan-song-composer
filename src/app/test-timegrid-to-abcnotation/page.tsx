import { loadAllSongs } from "@/lib/songs/loader";
import TimeGridToAbcNotationClient from "./TimeGridToAbcNotationClient";

export default async function TestTimeGridToAbcNotationPage() {
  const songs = await loadAllSongs();
  
  const availableSongs = songs
    .map(song => {
      const melodyAbc = song.abcNotations.find(notation => notation.type === "melody")?.content;
      return {
        title: song.meta.title,
        slug: song.meta.slug,
        melodyAbc,
      };
    })
    .filter((song): song is { title: string; slug: string; melodyAbc: string } => !!song.melodyAbc);

  if (availableSongs.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8">
          <h1 className="text-2xl font-bold text-rose-200">No melody notations found</h1>
          <p className="mt-3 text-sm leading-6 text-rose-100/80">
            This diagnostic reads saved catalog melodies, but no songs with a melody notation were loaded.
          </p>
        </div>
      </main>
    );
  }

  // Put Ganesha first by default if available, otherwise just sort alphabetically or leave as is
  const sortedSongs = [...availableSongs].sort((a, b) => {
    if (a.slug.toLowerCase() === "ganesha") return -1;
    if (b.slug.toLowerCase() === "ganesha") return 1;
    return a.title.localeCompare(b.title);
  });

  return <TimeGridToAbcNotationClient songs={sortedSongs} />;
}


import { validateSongLibrary } from "./src/lib/songs/validation";
async function run() {
  const report = await validateSongLibrary();
  console.log(JSON.stringify(report.issues, null, 2));
}
run();

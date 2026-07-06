const abcjs = require("abcjs");
const fs = require("fs");

const abc = fs.readFileSync("test-abcjs-full-song1.abc", "utf8");
const visualObj = abcjs.renderAbc("*", abc, { add_classes: true });

if (visualObj && visualObj.length > 0) {
  const obj = visualObj[0];
  console.log("Warnings:", obj.warnings);
  
  // Let's count notes and syllables for the first few measures
  const lines = obj.lines;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.staffGroup) {
      console.log(`Line ${i} has staffGroup`);
    }
  }
}

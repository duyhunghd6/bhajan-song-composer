const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="paper"></div>`);
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

const abcjs = require('./public/abcjs-basic-min.js');

function testAbc(name, abc) {
  try {
    abcjs.renderAbc("paper", abc);
    console.log(name, "OK");
  } catch (e) {
    console.log(name, "crashed:", e.message);
  }
}

testAbc("Empty grace", "X:1\nK:C\n{}C");
testAbc("Space grace", "X:1\nK:C\n{ }C");
testAbc("Tilde grace", "X:1\nK:C\n{~}C");
testAbc("Dangling grace", "X:1\nK:C\n{c");
testAbc("Dangling string force", "X:1\nK:C\n!1!");

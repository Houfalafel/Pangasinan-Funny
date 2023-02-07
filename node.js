#!/usr/bin/env node

const { JSDOM } = require("jsdom");
const { DOMParser, XMLSerializer } = new JSDOM().window;

class Convert {
  constructor(text) {
    this.parsed = new DOMParser().parseFromString(text, "text/xml");
    this.meta = this.parsed.querySelector("meta");

    const main = (this.main = this.parsed.querySelector("main"));

    // convert elements that only needs lowercase
    main.querySelectorAll("head, wh").forEach((el) => {
      el.innerHTML = el.innerHTML.toLocaleLowerCase();
    });
    // "other" elements get deleted
    main.querySelectorAll("other").forEach((el) => el.remove());

    console.log([...main.childNodes].filter((el) => el.nodeType == 3).map((a) => a.nodeValue));
    // process the text (the ones that are not inside elements)
    [...main.childNodes].filter((el) => el.nodeType == 3).forEach((textNode, i, array) => this.handleText(textNode, i, array));
  }

  /**
   * handle text nodes
   * @param {ChildNode} textNode
   * @param {number} index
   * @param {ChildNode[]} textNodes
   */
  handleText(textNode, index, textNodes) {
    const text = textNode.nodeValue?.replace(/(((\.|\n|^)(\s?)+)(\w+))/g, (a) => a.toLocaleLowerCase());

    if (!text) return;

    const final = [];

    text.split(" ").forEach((word, i, array) => {
      if (i == 0) {
        const prevNodeText = textNodes[index - 1]?.nodeValue;
        final.push(this.transformWord(word));
        return;
      }
      final.push(this.transformWord(word));
    });

    textNode.nodeValue = final.join(" ");
  }

  /**
   *
   * @param {string} word
   * @param {boolean} precededByStop
   * @returns {string}
   */
  transformWord(word, precededByStop = false) {
    //console.log(word, word.length, precededByStop);
    if (this.containsCapital(word)) return word;
    word = word.toLocaleLowerCase();

    if (word.includes("-")) {
      return word
        .split("-")
        .map((word) => this.transformWord(word))
        .join("-");
    }

    return (
      word
        .replace(/^y([^aiueo\s\d])/, "i$1") // ^yC = ^iC
        .replace(/c([aou])/g, "k$1") // ca, co, cu = ka, ko, ku
        .replace(/qu([ie])/g, "k$1") // qui, que = ki, ke
        .replace(/gu([ie])/g, "g$1") // gui, gue = gi, ge
        .replace(/ng̃u([ie])/g, "ng$1") // ng̃ui, ng̃ue = ngi, nge
        .replace(/([pbm])ue/g, "$1e") // pue, bue, mue = pe, be, me
        // ʊ
        // V != o
        .replace(/^[ou]([aiue])/, "w$1") // ^ʊV = ^wV
        .replace(/([aiue])[ou]([aiue])/g, "$1w$2") // VʊV = VwV
        .replace(/([aiue])[ou]([^aiueo\s\d])([aiue])[ou]/g, "$1w$2$3w") // VʊCVʊ = VwCVw
        .replace(/([aiue])[ou]$/, "$1w") // Vʊ$ = Vw$
    );
  }

  /**
   * check if string ends with full stop
   * @param {string} text
   * @returns {boolean}
   */
  endsWithStop(text) {
    if (!text) return true;
    return text.endsWith(".") || text.endsWith("\n") || /\.\s+$/.test(text);
  }

  /**
   * test if string contains capital letter
   * @param {string} string
   * @returns
   */
  containsCapital(string) {
    return /[A-Z]/.test(string);
  }

  serialize() {
    // remove meta before finalizing output
    this.parsed.querySelector("meta").remove();
    return new XMLSerializer().serializeToString(this.parsed);
  }
}

module.exports = Convert;

const fs = require("fs/promises");

async function main() {
  fs.mkdir("./pagTexts/outputs", { recursive: true });
  const files = (await fs.readdir("./pagTexts/", { withFileTypes: true })).filter((item) => !item.isDirectory()).map((item) => item.name);

  const texts = await Promise.all(files.map((a) => fs.readFile(`./pagTexts/${a}`, "utf-8")));
  texts.forEach((text, i) => {
    try {
      fs.writeFile(`./pagTexts/outputs/${files[i]}`, new Convert(text).serialize());
    } catch (e) {
      console.log(files[i] + " failed to convert...");
    }
  });
}

if (require.main === module) {
  main();
}

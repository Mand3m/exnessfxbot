const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "home", "fractals");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));

async function run() {
  for (const file of files) {
    const src = path.join(dir, file);
    const base = file.replace(/\.png$/i, "");
    const webp = path.join(dir, base + ".webp");
    await sharp(src).webp({ quality: 72, effort: 5 }).toFile(webp);
    console.log(`WEBP ${file} ${fs.statSync(src).size} -> ${fs.statSync(webp).size}`);
  }
  for (const id of ["01", "03"]) {
    for (const side of ["before", "after"]) {
      const src = path.join(dir, `${id}-${side}.png`);
      const out = path.join(dir, `${id}-${side}.phone.webp`);
      await sharp(src)
        .resize({ width: 720, withoutEnlargement: true })
        .webp({ quality: 70, effort: 5 })
        .toFile(out);
      console.log(`PHONE ${path.basename(out)} ${fs.statSync(out).size}`);
    }
  }
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { writeFileSync, readdirSync } from "fs";
import { join } from "path";

const pubDir = join(process.cwd(), ".output", "public");
const assetsDir = join(pubDir, "assets");

const files = readdirSync(assetsDir);
const routesJs = files.find((f) => f.startsWith("routes-") && f.endsWith(".js"));
const stylesCss = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!routesJs || !stylesCss) {
  console.error("Could not find routes or styles in build output");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lucky Aluminium</title>
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/assets/${stylesCss}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${routesJs}"></script>
  </body>
</html>`;

writeFileSync(join(pubDir, "index.html"), html);
console.log(`[build] Wrote index.html referencing ${routesJs} and ${stylesCss}`);

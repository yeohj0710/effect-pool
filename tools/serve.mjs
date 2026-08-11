// 만들어진 site/ 를 눈으로 보려고 띄우는 것뿐이다. 배포와는 상관없다.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const root = new URL("../site/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TYPE = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".png": "image/png",
               ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(root, "index.html");
  res.writeHead(200, { "content-type": TYPE[extname(p)] || "text/plain; charset=utf-8" });
  res.end(readFileSync(p));
}).listen(4321, () => console.log("http://localhost:4321"));

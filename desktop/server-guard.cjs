"use strict";
/**
 * Start-up file for the desktop app's server (copied next to server.js as desktop-entry.cjs).
 *
 * The server only listens on this computer, but a web page in an ordinary browser can still trick
 * the browser into talking to it by giving it a name that points to 127.0.0.1 ("DNS rebinding"),
 * and could then read your data. Real requests from this app always say Host: 127.0.0.1:<port>,
 * so anything else is turned away before the app sees it.
 */
const http = require("node:http");

const port = process.env.PORT;
const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, req, res, ...rest) {
  if (event === "request" && !allowed.has(String(req.headers.host).toLowerCase())) {
    res.writeHead(421, { "content-type": "text/plain" });
    res.end("Misdirected request");
    return true;
  }
  return emit.call(this, event, req, res, ...rest);
};

require("./server.js");

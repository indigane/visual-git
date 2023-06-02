
//
// Server
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const STATIC_PATH = '../frontend/';

const extensionToMimeType = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

const isValidPath = (() => {
  const containsDisallowedCharacters = /[^a-z0-9._/-]/i;
  const nonAlphanumericCharacterBeforeDot = /[^a-z0-9]\./i;
  const nonAlphanumericCharacterAfterDot = /\.[^a-z0-9]/i;
  return function isValidPath(inputPath) {
    inputPath = path.normalize(inputPath);
    if (containsDisallowedCharacters.test(inputPath)) {
      return false;
    }
    if (nonAlphanumericCharacterBeforeDot.test(inputPath)) {
      return false;
    }
    if (nonAlphanumericCharacterAfterDot.test(inputPath)) {
      return false;
    }
    return true;
  }
})();

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    // Serve static files
    const filePath = req.url === '/' ? 'index.html' : req.url;
    if ( ! isValidPath(filePath)) {
      res.statusCode = 404;
      res.end();
    }
    const mimeType = extensionToMimeType[path.extname(filePath)] ?? 'application/octet-stream';
    fs.readFile(path.join(STATIC_PATH, filePath), (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end();
      } else {
        res.writeHead(200, {'Content-Type': mimeType});
        res.end(data);
      }
    });
  } else if (req.method === 'POST' && req.url === '/') {
    // Handle commands
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      handleCommand(body)
      .then(result => res.end(result))
      .catch(error => res.end(error));
    });
  } else {
    res.statusCode = 404;
    res.end();
  }
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});


//
// Command handling
//
import { spawn } from 'node:child_process';

// TODO: Better validation?
const commandAllowList = [
  `["log","--all","--oneline","--reflog"]`,
];

async function handleCommand(commandArguments) {
  return new Promise((resolve, reject) => {
    // TODO: Do we need CSRF checks?
    if (commandAllowList.includes(commandArguments)) {
      commandArguments = JSON.parse(commandArguments);
      const git = spawn('git', commandArguments);
      let result = '';
      git.stdout.on('data', (data) => {
        result += data;
      });
      git.on('close', (exitCode) => {
        console.log(`git exited with code ${exitCode}`);
        resolve(result);
      });
    } else {
      reject('unknown-command');
    }
  });
}

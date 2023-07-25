
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
  `["log","--all","--pretty=raw"]`,
  `["log","--decorate=full","--format=%H%n %T%n %P%n %an%n %ae%n %aD%n %cn%n %ce%n %cD%n %e%n %D%n %S%n %G?%n%n%w(0,0,1) %s%w(0,0,0)%n%n%w(0,0,1) %b%w(0,0,0)%n%n%w(0,0,1) %N%w(0,0,0)%n%n"]`,
  `["log","--decorate=full","--format=%H%n %T%n %P%n %an%n %ae%n %aD%n %cn%n %ce%n %cD%n %e%n %D%n %S%n %G?%n%n%w(0,0,1) %s%w(0,0,0)%n%n%w(0,0,1) %b%w(0,0,0)%n%n%w(0,0,1) %N%w(0,0,0)%n%n","--date-order"]`,
];
// TODO: Where do we get repository path from? For now it is a command line argument, or current directory.
let repositoryPath;
if (process.argv[2]) {
  repositoryPath = path.join(process.argv[2], '.git');
}
else {
  // Ask git for --git-dir. This is mostly an example, as we could also omit --git-dir in this case.
  repositoryPath = (await runCommand('git', ['rev-parse', '--absolute-git-dir'])).trim();
}

function handleCommand(commandArguments) {
  return new Promise((resolve, reject) => {
    // TODO: Do we need CSRF checks?
    if (commandAllowList.includes(commandArguments)) {
      commandArguments = JSON.parse(commandArguments);
      // Repository path can contain spaces, child_process.spawn does not care.
      runCommand('git', [`--git-dir=${repositoryPath}`, ...commandArguments])
      .then(result => resolve(result))
      .catch(error => {
        console.log(error);
        reject('git-error');
      });
    } else {
      console.log('Unknown command: ' + commandArguments);
      reject('unknown-command');
    }
  });
}

function runCommand(executable, args) {
  return new Promise((resolve, reject) => {
    const command = spawn(executable, args);
    let result = '';
    let errorResult = '';
    command.stdout.on('data', (data) => {
      result += data;
    });
    command.stderr.on('data', (data) => {
      errorResult += data;
    });
    command.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve(result);
      }
      else {
        reject(errorResult);
      }
    });
  });
}

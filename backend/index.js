import child_process from 'node:child_process';

//
// Server
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { WebSocket, WebSocketServer } from './vendor/ws/wrapper.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const STATIC_PATH = `${__dirname}/../frontend/`;

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
    if (containsDisallowedCharacters.test(inputPath)) {
      return false;
    }
    inputPath = path.normalize(inputPath);
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
  // Serve static files
  if (req.method === 'GET') {
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

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  // Heartbeat
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true });
});
// Heartbeat
{
  const heartbeatInterval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
    setTimeout(() => {
      if (wss.clients.size === 0) {
        // No open tabs remain. Close the server process.
        process.exit();
      }
    }, 100);
  }, 30000);
  wss.on('close', function close() {
    clearInterval(heartbeatInterval);
  });
}

{
  let port = process.env.PORT || 3000;
  // Node server.listen has no concept of success, only error,
  // so we wait a bit and assume success if there was no error.
  let connectionSuccessTimer;
  const waitForSuccess = () => {
    clearTimeout(connectionSuccessTimer);
    connectionSuccessTimer = setTimeout(() => {
      console.log(`Server is listening on port ${port}`);
      openUrlInBrowser(`http://localhost:${port}`);
    }, 100);
  };
  wss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      port += 1;
      server.listen(port);
      waitForSuccess();
    } else {
      clearTimeout(connectionSuccessTimer);
      console.error(err);
    }
  });
  server.listen(port);
  waitForSuccess();
}

function openUrlInBrowser(url) {
  let startCommand;
  if (process.platform === 'darwin') {
    startCommand = 'open';
  } else if (process.platform === 'win32') {
    startCommand = 'start';
  } else {
    startCommand = 'xdg-open';
  }
  child_process.exec(`${startCommand} ${url}`, { windowsHide: true });
}

function websocketBroadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}


//
// Command handling
//

// Can be undefined, which defaults to current working directory.
const targetDirectory = process.argv[2];
// Path to .git directory.
const repositoryPath = (await runCommand('git', ['rev-parse', '--absolute-git-dir'], { cwd: targetDirectory })).trim();

function handleCommand(commandArgumentsJson) {
  return new Promise((resolve, reject) => {
    // TODO: Do we need CSRF checks? We could probably avoid the need for that by triggering CORS checks.
    let commandArguments;
    try {
      // TODO: Do some basic validation before parsing JSON?
      commandArguments = JSON.parse(commandArgumentsJson);
    } catch (err) {
      console.log('Could not parse commandArguments JSON: ' + err);
      reject('invalid-command-arguments-json');
    }
    if (commandArguments && validateArguments(commandArguments)) {
      // Repository path can contain spaces, child_process.spawn does not care.
      runCommand('git', [`--git-dir=${repositoryPath}`, ...commandArguments])
      .then(result => resolve(result))
      .catch(error => {
        console.log(error);
        reject('git-error');
      });
    } else {
      console.log('Invalid command arguments: ' + commandArguments);
      reject('invalid-command-arguments');
    }
  });
}

function runCommand(executable, args, options) {
  return new Promise((resolve, reject) => {
    const command = child_process.spawn(executable, args, options);
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

function validateArguments(commandArguments) {
  const [gitCommand, ...args] = commandArguments;
  const allowedCommands = {
    'log': {
      allowedArguments: [
        '--all',
        '--oneline',
        '--reflog',
        '--pretty=raw',
        '--decorate=full',
        '--date-order',
        '--format=%H%n %T%n %P%n %an%n %ae%n %aD%n %cn%n %ce%n %cD%n %e%n %D%n %S%n %G?%n%n%w(0,0,1) %s %w(0,0,0)%n%n%w(0,0,1) %b %w(0,0,0)%n%n%w(0,0,1) %N %w(0,0,0)%n%n',
        '--format=%H%n %T%n %P%n %an%n %ae%n %aD%n %cn%n %ce%n %cD%n %e%n %D%n %S%n %n%n%w(0,0,1) %s %w(0,0,0)%n%n%w(0,0,1) %b %w(0,0,0)%n%n%w(0,0,1) %N %w(0,0,0)%n%n',
      ],
      allowedArgumentsRegex: makeArgumentsRegex(
        /--max-count=\d+/,
      ),
    },
  };

  if ( ! gitCommand in allowedCommands) {
    return false;
  }

  const { allowedArguments, allowedArgumentsRegex } = allowedCommands[gitCommand];
  for (const argument of args) {
    if ( ! allowedArguments.includes(argument) && ! allowedArgumentsRegex.test(argument)) {
      return false;
    }
  }

  return true;
}

function makeArgumentsRegex(...regexArray) {
  // Joins regexes into one regex like this: `(?:^regex1$|^regex2$|^regex3$)`
  // In other words, argument must exactly match at least one regex in regexArray.
  return new RegExp(
    '(?:' + regexArray.map(regex => '^' + regex.source + '$').join('|') + ')'
  );
}


//
// Monitor .git
//
fs.watch(path.join(repositoryPath, 'HEAD'), function handleGitChange(eventType, filename) {
  websocketBroadcast('HEAD');
});
fs.watch(path.join(repositoryPath, 'refs'), { recursive: true }, function handleGitChange(eventType, filename) {
  websocketBroadcast('refs:' + filename);
});

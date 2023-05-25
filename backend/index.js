
//
// Server
//
import http from 'http';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/') {
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
import { spawn } from 'child_process';

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
      git.stdout.on('close', (exitCode) => {
        console.log(`git exited with code ${exitCode}`);
        resolve(result);
      });
    } else {
      reject('unknown-command');
    }
  });
}

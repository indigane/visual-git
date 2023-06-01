const commandArguments = ['log', '--all', '--oneline', '--reflog'];
const response = await fetch('', {
  method: 'POST',
  body: JSON.stringify(commandArguments),
});
const result = await response.text();
document.querySelector('.result').insertAdjacentText('beforeend', result);
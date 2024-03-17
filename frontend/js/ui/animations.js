import { animate } from '../utils.js';


function distanceBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function calculatePathStringLength(pathString) {
  const pointsArray = pathString
    .replaceAll('M ', '')
    .replaceAll('L ', '')
    .split(' ')
    .map(Number);
  let totalLength = 0;
  for (let i = 0; i < pointsArray.length - 2; i += 2) {
    totalLength += distanceBetweenPoints(pointsArray[i], pointsArray[i + 1], pointsArray[i + 2], pointsArray[i + 3]);
  }
  return totalLength;
}

export function animateCommitEnter(commitElement, duration) {
  const animation = animate(commitElement,
    [
      {opacity: '0'},
      {opacity: '1'},
    ], {
      delay: duration,
      duration: duration,
      easing: 'ease-in-out',
      fill: 'backwards',
    },
  );
  animate(commitElement.querySelector('circle'),
    [
      {r: '0'},
      {r: 'var(--radius)'},
    ], {
      delay: duration,
      duration: duration,
      easing: 'ease-in-out',
      fill: 'backwards',
    },
  );
  for (const edgeElement of commitElement.querySelectorAll('.edge')) {
    animate(edgeElement,
      [
        {strokeWidth: '0'},
        {strokeWidth: 'var(--stroke-width)'},
      ], {
        delay: duration,
        duration: duration,
        easing: 'ease-in-out',
        fill: 'backwards',
      },
    );
  }
  return animation.finished;
}

export function animateCommitLeave(commitElement, duration) {
  const animation = animate(commitElement,
    [
      {opacity: '1'},
      {opacity: '0'},
    ], {
      duration: duration,
      easing: 'ease-in-out',
    },
  );
  animate(commitElement.querySelector('circle'),
    [
      {r: 'var(--radius)'},
      {r: '0'},
    ],
    {duration: duration},
  );
  for (const edgeElement of commitElement.querySelectorAll('.edge')) {
    animate(edgeElement,
      [
        {strokeWidth: 'var(--stroke-width)'},
        {strokeWidth: '0'},
      ], {
        duration: duration,
        easing: 'ease-in-out',
      },
    );
  }
  return animation.finished;
}


export function animateRefEnter(commitElement, refContext, duration) {
  commitElement._elems.refsContainer.insertAdjacentHTML('beforeend', refContext.htmlString);
  const refElement = commitElement._elems.refsContainer.lastElementChild;
  const animation = animate(refElement,
    [
      {opacity: '0'},
      {opacity: '1'},
    ], {
      duration: duration,
      easing: 'ease-in-out',
    },
  );
}


export function animateRefTransition(commitElement, refContext, commitContext, refOldCommitContext, duration) {
  const rowOffset = refOldCommitContext.row - commitContext.row;
  const columnOffset = refOldCommitContext.column - commitContext.column;
  const yOffset = rowOffset * 32;
  const xOffset = columnOffset * 32;
  commitElement._elems.refsContainer.insertAdjacentHTML('beforeend', refContext.htmlString);
  const refElement = commitElement._elems.refsContainer.lastElementChild;
  const animation = animate(refElement,
    [
      {transform: `translate(${xOffset}px, ${yOffset}px)`},
      {transform: `translate(0, 0)`},
    ], {
      duration: duration,
      easing: 'ease-in-out',
    },
  );
}

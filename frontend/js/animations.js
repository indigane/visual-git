import { animate } from './utils.js';


function distanceBetweenPoints (x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function calculatePointsStringLength(pointsString) {
  const pointsArray = pointsString.split(',').map(Number);
  let totalLength = 0;
  for (let i = 0; i < pointsArray.length - 2; i += 2) {
    totalLength += distanceBetweenPoints(pointsArray[i], pointsArray[i + 1], pointsArray[i + 2], pointsArray[i + 3]);
  }
  return totalLength;
}

export function animateEdgesTransition(commitElement, newEdges, oldEdges, duration) {
  const edgeElements = commitElement.querySelectorAll('.edge');
  for (const [index, newEdge] of newEdges.entries()) {
    const oldEdge = oldEdges[index];
    const edgeElement = edgeElements[index];
    // Remove existing animations
    edgeElement.replaceChildren();
    edgeElement.setAttribute('points', newEdge.pointsString);
    // Calculate polylineLength instead of calling Polyline.getTotalLength()
    // to fix issues when getTotalLength is called during animation.
    edgeElement.setAttribute('stroke-dasharray', newEdge.totalLength);
    edgeElement.style.stroke = newEdge.strokeColor;
    edgeElement.insertAdjacentHTML('beforeend', `<animate attributeName="points" values="${oldEdge.pointsString};${newEdge.pointsString}" dur="${duration}ms" repeatCount="1" keySplines="0.42 0.0 0.58 1.0" calcMode="spline">`);
    edgeElement.insertAdjacentHTML('beforeend', `<animate attributeName="stroke-dasharray" values="${oldEdge.totalLength};${newEdge.totalLength}" dur="${duration}ms" repeatCount="1" keySplines="0.42 0.0 0.58 1.0" calcMode="spline">`);
  }
  // Edge animation timing
  const svgElement = commitElement.querySelector('svg');
  const syncSVGAnimationToCSSTransition = () => {
    svgElement.unpauseAnimations();
    commitElement.removeEventListener('transitionrun', syncSVGAnimationToCSSTransition);
  };
  svgElement.pauseAnimations();
  svgElement.setCurrentTime(0);
  commitElement.addEventListener('transitionrun', syncSVGAnimationToCSSTransition);
  // HACK: After two frames, if the transition has not started, start the animation anyway.
  // The transition will never start, if there is nothing else to animate except the edge.
  // This may also help with the syncing in Chromium based browsers.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(syncSVGAnimationToCSSTransition);
  });
}

export function animateCommitEnter(commitElement, duration) {
  const animation = animate(commitElement,
    [
      {opacity: '0'},
      {opacity: '1'},
    ],
    {delay: duration, duration: duration, fill: 'backwards'},
  );
  animate(commitElement.querySelector('circle'),
    [
      {r: '0'},
      {r: 'var(--radius)'},
    ],
    {delay: duration, duration: duration, fill: 'backwards'},
  );
  for (const edgeElement of commitElement.querySelectorAll('polyline')) {
    animate(edgeElement,
      [
        {strokeWidth: '0'},
        {strokeWidth: 'var(--stroke-width)'},
      ],
      {delay: duration, duration: duration, fill: 'backwards'},
    );
  }
  return animation.finished;
}

export function animateCommitLeave(commitElement, duration) {
  const animation = animate(commitElement,
    [
      {opacity: '1'},
      {opacity: '0'},
    ],
    {duration: duration},
  );
  animate(commitElement.querySelector('circle'),
    [
      {r: 'var(--radius)'},
      {r: '0'},
    ],
    {duration: duration},
  );
  for (const edgeElement of commitElement.querySelectorAll('polyline')) {
    animate(edgeElement,
      [
        {strokeWidth: 'var(--stroke-width)'},
        {strokeWidth: '0'},
      ],
      {duration: duration},
    );
  }
  return animation.finished;
}
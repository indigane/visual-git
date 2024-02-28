import { animate } from './utils.js';


function distanceBetweenPoints (x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function calculatePointsStringLength(pointsString) {
  const pointsArray = pointsString.split(',').map(Number);
  let totalLength = 0;
  for (let i = 0; i < pointsArray.length - 2; i += 2) {
    totalLength += distanceBetweenPoints(pointsArray[i], pointsArray[i + 1], pointsArray[i + 2], pointsArray[i + 3]);
  }
  return totalLength;
}

export function animateEdgesTransition(commitElement, edges, duration) {
  const edgeElements = commitElement.querySelectorAll('.edge');
  for (const [index, edge] of edges.entries()) {
    const edgeElement = edgeElements[index];
    const oldPointsString = edgeElement.getAttribute('points');
    const oldPolylineLength = edgeElement.getAttribute('stroke-dasharray');
    // Remove existing animations
    edgeElement.replaceChildren();
    edgeElement.setAttribute('points', edge.pointsString);
    // Calculate polylineLength instead of calling Polyline.getTotalLength()
    // to fix issues when getTotalLength is called during animation.
    const polylineLength = calculatePointsStringLength(edge.pointsString);
    edgeElement.setAttribute('stroke-dasharray', polylineLength);
    edgeElement.style.stroke = edge.strokeColor;
    edgeElement.insertAdjacentHTML('beforeend', `<animate attributeName="points" values="${oldPointsString};${edge.pointsString}" dur="${duration}ms" repeatCount="1" keySplines="0.42 0.0 0.58 1.0" calcMode="spline">`);
    edgeElement.insertAdjacentHTML('beforeend', `<animate attributeName="stroke-dasharray" values="${oldPolylineLength};${polylineLength}" dur="${duration}ms" repeatCount="1" keySplines="0.42 0.0 0.58 1.0" calcMode="spline">`);
  }
  // Edge animation timing
  const svgElement = commitElement.querySelector('svg');
  const syncSVGAnimationToCSSTransition = () => {
    svgElement.unpauseAnimations();
    commitElement.removeEventListener('transitionstart', syncSVGAnimationToCSSTransition);
  };
  svgElement.pauseAnimations();
  svgElement.setCurrentTime(0);
  commitElement.addEventListener('transitionstart', syncSVGAnimationToCSSTransition);
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
/** @type {WebSocket} */
export default new globalThis.ReconnectingWebSocket(`ws://${window.location.host}`);

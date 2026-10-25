// jsdom does not implement PointerEvent. Without this, fireEvent builds a plain Event and
// drops button, clientX, and pointerId, so a drag never starts.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public readonly pointerId: number;
    public readonly pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  // The polyfill only carries the fields drag tests read, so it is not a full PointerEvent.
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

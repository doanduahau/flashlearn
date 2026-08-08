import "@testing-library/jest-dom/vitest";

// jsdom does not implement HTMLDialogElement.showModal / close.
// Polyfill minimally so components that call these methods don't throw.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

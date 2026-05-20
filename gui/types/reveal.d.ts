declare module "reveal.js" {
  interface RevealOptions {
    transition?: string;
    transitionSpeed?: string;
    controls?: boolean;
    progress?: boolean;
    keyboard?: boolean;
    touch?: boolean;
    hash?: boolean;
    center?: boolean;
    width?: string | number;
    height?: string | number;
    margin?: number;
    minScale?: number;
    maxScale?: number;
  }

  interface RevealApi {
    initialize(): Promise<void>;
    on(event: string, callback: (e: Record<string, unknown>) => void): void;
    destroy(): void;
  }

  export default class Reveal {
    constructor(element: HTMLElement, options?: RevealOptions);
    initialize(): Promise<void>;
    on(event: string, callback: (e: Record<string, unknown>) => void): void;
    destroy(): void;
  }
}

declare module "reveal.js/dist/reveal.css";

declare module "abcjs" {
  export interface RenderAbcOptions {
    responsive?: "resize" | boolean;
    add_classes?: boolean;
    [key: string]: unknown;
  }

  export interface VisualObj {
    warnings?: string[];
    [key: string]: unknown;
  }

  export interface SynthInitOptions {
    visualObj: VisualObj;
    audioContext: AudioContext;
    millisecondsPerMeasure?: number;
    [key: string]: unknown;
  }

  export interface CreateSynthInstance {
    init(options: SynthInitOptions): Promise<void>;
    prime(): Promise<void>;
    start(): void;
    pause(): void;
    stop(): void;
  }

  export interface SynthNamespace {
    CreateSynth: new () => CreateSynthInstance;
  }

  export interface Abcjs {
    renderAbc(
      target: string | HTMLElement,
      abcString: string,
      options?: RenderAbcOptions
    ): VisualObj[];
    parseOnly(abcString: string): VisualObj[];
    synth: SynthNamespace;
  }

  export function renderAbc(
    target: string | HTMLElement,
    abcString: string,
    options?: RenderAbcOptions
  ): VisualObj[];

  export function parseOnly(abcString: string): VisualObj[];

  export const synth: SynthNamespace;

  const abcjs: Abcjs;
  export default abcjs;
}

declare module "abcjs" {
  export function renderAbc(
    target: string | HTMLElement,
    abcString: string,
    options?: any
  ): any;

  export const synth: any;

  const abcjs: {
    renderAbc: typeof renderAbc;
    synth: any;
  };
  export default abcjs;
}

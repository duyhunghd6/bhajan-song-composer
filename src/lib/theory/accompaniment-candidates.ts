export interface AccompanimentOption {
  id: string;
  label: string;
  instrument: "piano" | "guitar";
  style: "pop-ballad" | "rock-rnb" | "classical-folk" | "strict-pima" | "folk-travis";
  explanation: string;
}

export interface AccompanimentResult {
  options: AccompanimentOption[];
}

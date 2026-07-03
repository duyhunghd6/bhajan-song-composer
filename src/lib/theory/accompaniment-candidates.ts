export interface AccompanimentOption {
  id: string;
  label: string;
  instrument: "piano" | "guitar";
  style:
    | "pop-ballad" | "rock-rnb" | "classical-folk" | "strict-pima" | "folk-travis"
    | "strummed-pop" | "ballad-arpeggio" | "rock-power"
    | "devotional-sustained" | "jazz-comping";
  explanation: string;
}

export interface AccompanimentResult {
  options: AccompanimentOption[];
}

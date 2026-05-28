// html-midi-player ships no types. Importing it for side effects registers
// the <midi-player> / <midi-visualizer> custom elements; declare the module
// and the JSX intrinsics so they can be used in TSX.
declare module "html-midi-player";

import type { DetailedHTMLProps, HTMLAttributes } from "react";

type MidiPlayerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  "sound-font"?: string | boolean;
  loop?: boolean;
  visualizer?: string;
};

type MidiVisualizerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  type?: "piano-roll" | "waterfall" | "staff";
  src?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "midi-player": MidiPlayerAttributes;
      "midi-visualizer": MidiVisualizerAttributes;
    }
  }
}

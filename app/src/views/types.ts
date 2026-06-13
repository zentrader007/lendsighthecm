import type { Dispatch, SetStateAction } from 'react';
import type { RateScenario, RateSourceMode, SimulationInputs, SimulationResult } from '../engine';

export const RATE_MODES: readonly RateSourceMode[] = ['Assumed', 'Historical'];

export const RATE_SCENARIOS: readonly RateScenario[] = [
  'Flat (assumed)',
  'Rates +2%',
  'Rates -2%',
  'Replay 1986-2024',
];

export type LayoutKind = 'classic' | 'v2';

/** Props shared by both advisor layouts. App.tsx owns the state; views render it. */
export interface AdvisorProps {
  inp: SimulationInputs;
  setInp: Dispatch<SetStateAction<SimulationInputs>>;
  result: SimulationResult;
  copied: boolean;
  share: () => void;
  goConsumer: () => void;
  switchLayout: (l: LayoutKind) => void;
}

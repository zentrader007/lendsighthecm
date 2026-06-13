import type { Dispatch, SetStateAction } from 'react';
import type { RateScenario, RateSourceMode, SimulationInputs, SimulationResult } from '../engine';

export const RATE_MODES: readonly RateSourceMode[] = ['Assumed', 'Historical'];

export const RATE_SCENARIOS: readonly RateScenario[] = [
  'Flat (assumed)',
  'Rates +2%',
  'Rates -2%',
  'Replay 1986-2024',
];

/** Props for the advisor layout. App.tsx owns the state; the view renders it. */
export interface AdvisorProps {
  inp: SimulationInputs;
  setInp: Dispatch<SetStateAction<SimulationInputs>>;
  result: SimulationResult;
  copied: boolean;
  share: () => void;
  goConsumer: () => void;
}

import { mMToMolPerCm3, type FickParams } from '../../lib/fick';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose:
   *  the site is shared beyond any one class, so presets are invented
   *  examples, never actual assigned homework. */
  source: string;
  blurb: string;
  params: FickParams;
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'epidermis',
    name: 'Drug through skin',
    source: 'Transdermal',
    blurb:
      'A drug patch is applied to 1 cm² of skin. The avascular epidermis is 100 µm thick; the dermis beneath it clears the drug instantly, so the far face sits at zero.',
    check: 'j = 5 × 10⁻¹² mol/cm²·s, and 2.5 × 10⁻⁸ mol sitting in the layer',
    params: {
      geometry: 'slab',
      D: 1e-8,
      C1: mMToMolPerCm3(5),
      C2: 0,
      L: 0.01,
      A: 1,
      r1: 0.005,
      r2: 0.05,
    },
  },
  {
    id: 'oxygen',
    name: 'Oxygen into a cell layer',
    source: 'Bioreactor',
    blurb:
      'Culture medium carrying about 0.88 mM of dissolved O₂ feeds a 25 µm layer of cells and gel; the cells consume oxygen fast enough to hold the far face near zero.',
    params: {
      geometry: 'slab',
      D: 2e-5,
      C1: mMToMolPerCm3(0.875),
      C2: 0,
      L: 0.0025,
      A: 4,
      r1: 0.005,
      r2: 0.05,
    },
  },
  {
    id: 'microsphere',
    name: 'Drug from a microsphere',
    source: 'Controlled release',
    blurb:
      'A drug-loaded microsphere releases into surrounding tissue. Its surface is held at C₀; far away the tissue clears the drug. The classic spherical steady-state problem.',
    params: {
      geometry: 'sphere',
      D: 1e-6,
      C1: mMToMolPerCm3(1),
      C2: 0,
      L: 1,
      A: 1,
      r1: 0.005,
      r2: 0.05,
    },
  },
  {
    id: 'vessel',
    name: 'Gas across a vessel wall',
    source: 'Tubing wall',
    blurb:
      'An inert gas crosses a cylindrical tubing wall. The wall material dissolves the gas, so the concentrations at the two faces are set by solubility in the solid, not by the gas phase alone.',
    params: {
      geometry: 'cylinder',
      D: 1e-5,
      C1: mMToMolPerCm3(0.25),
      C2: mMToMolPerCm3(0.04),
      L: 1,
      A: 1,
      r1: 1.0,
      r2: 1.3,
    },
  },
];

export const DEFAULT_PARAMS: FickParams = PRESETS[0].params;

/** Landmark D values for the "how big is D, really" scale. */
export const D_LANDMARKS: { label: string; D: number }[] = [
  { label: 'Gases', D: 0.1 },
  { label: 'O₂ in water', D: 1e-5 },
  { label: 'Albumin in saline', D: 8e-7 },
  { label: 'Macromolecule in a cell', D: 1e-9 },
  { label: 'Solids', D: 1e-10 },
];

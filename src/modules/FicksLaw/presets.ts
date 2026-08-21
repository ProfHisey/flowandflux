import { mMToMolPerCm3, type FickParams } from '../../lib/fick';

export interface Preset {
  id: string;
  name: string;
  /** Where in BME 378 this problem comes from. */
  source: string;
  blurb: string;
  params: FickParams;
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'epidermis',
    name: 'Drug through epidermis',
    source: 'HW1 #2',
    blurb:
      'A drug is applied to 1 cm² of skin. The avascular epidermis is 100 µm thick; the dermis beneath it clears the drug instantly, so the far face sits at zero.',
    check: 'j = 7 × 10⁻¹² mol/cm²·s, and 3.5 × 10⁻⁸ mol sitting in the layer',
    params: {
      geometry: 'slab',
      D: 1e-8,
      C1: mMToMolPerCm3(7),
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
    source: 'Lecture 18',
    blurb:
      'Supply fluid in the artificial-liver bioreactor carries 2.8 × 10⁻⁵ g/mL of O₂ — about 0.88 mM — into a 25 µm layer of cells and gel.',
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
    source: 'Lecture 4',
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
    source: 'HW2 #4',
    blurb:
      'An inert gas crosses a cylindrical vessel wall. The wall binds the gas, so the concentration jumps at each face by a partition coefficient — inner face 3×, outer face 2×.',
    params: {
      geometry: 'cylinder',
      D: 1e-5,
      C1: mMToMolPerCm3(0.3),
      C2: mMToMolPerCm3(0.02),
      L: 1,
      A: 1,
      r1: 1.0,
      r2: 1.3,
    },
  },
];

export const DEFAULT_PARAMS: FickParams = PRESETS[0].params;

/** D values quoted in Lecture 3, for the "how big is D, really" scale. */
export const D_LANDMARKS: { label: string; D: number }[] = [
  { label: 'Gases', D: 0.1 },
  { label: 'O₂ in water', D: 1e-5 },
  { label: 'Albumin in saline', D: 8e-7 },
  { label: 'Macromolecule in a cell', D: 1e-9 },
  { label: 'Solids', D: 1e-10 },
];

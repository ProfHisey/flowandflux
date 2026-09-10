import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const RTT_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Drag the downstream face of the box to the right and watch the ledger. Two numbers move; one does not. Which, and why?',
    probe: 'Do it on the energy face with the heater on, slowly, and read the source, storage, and flux chips as you go.',
    resolution:
      'Storage and net flux trade off; the source does not move. The heater delivers 500 W whether the box is wide or narrow, so dB_sys/dt is fixed by physics — but how that 500 W is booked, as accumulation inside versus enthalpy carried out through the surface, is decided entirely by where you drew the surface. The theorem is an identity about your bookkeeping, and the drag proves it: nothing physical changed, only the partition. Every integral balance you will ever write starts with a choice of box, and this is what the choice controls.',
  },
  {
    q: 'On the mass face nothing is created and nothing is destroyed, yet the storage term is plainly not zero during a surge. Where did the extra mass come from?',
    probe: 'Load "Surges." Watch the storage chip swing positive as a gust enters and negative as it leaves.',
    resolution:
      'From the inlet, a moment ago. Storage is not a source; it is a delay between what has crossed the upstream face and what has yet to cross the downstream one. Conservation says source = 0, and the theorem then says storage = influx − outflux exactly — the contents rise when more is arriving than leaving and fall when the gust passes through. Averaged over a few correlation times the storage term integrates to zero and ⟨in⟩ = ⟨out⟩; instant by instant it need not. Students who write "steady state" on a problem that is only steady on average are making this mistake.',
  },
  {
    q: 'The heater delivers 500 W and the outlet water is only 1.2 K warmer. Turn the mass flow down. Why does ΔT rise, and what is the ledger doing while it rises?',
    probe: 'Halve ṁ on "An inline heater" and wait a transit time.',
    resolution:
      'At steady state the storage term averages to zero, so the heater\'s 500 W must all leave as enthalpy flux: Q = ṁ c_p ΔT, and with half the flow the same 500 W has half as much water to warm, so ΔT doubles. Between the two steady states the storage term is briefly positive — the box holds warmer water than it is releasing — until the new outlet temperature has propagated through. The first law for an open system is nothing but this theorem with b = c_p T and the heater as the source.',
  },
  {
    q: 'On the momentum face, with the push switched off, the inlet wobbles but its mean velocity is exactly ū. Why does the measured momentum flux still run above ρAū²?',
    probe: 'Load "A gusty inlet, no push" and compare the measured flux with mean × mean in the Reynolds panel.',
    resolution:
      'Because momentum is carried by the very velocity that fluctuates. The flux of b = u is ρAu·u, and ⟨u²⟩ = ū² + ⟨u\'²⟩ — the fluctuations do not cancel, they square. This is a Reynolds stress, the term that makes turbulent flow harder than laminar flow, and it is why the correlation slider is locked at ρ = 1 on this face: you cannot decouple the flow rate from the property when the property is the flow rate. On the energy face you can, which is why that slider is free.',
  },
  {
    q: 'Load "Lump sum, left alone," then "Flows that ignore the market," then "Buying high." Which term of the theorem is the behavior gap, and what has to be true of the flows for it to exist?',
    probe: 'Watch the dollar-weighted and time-weighted readouts on each preset for a full holding period.',
    resolution:
      'It comes from the control-surface term — deposits and withdrawals — and it needs two things. There must be flows at all: with none, the surface term vanishes and the account IS the fund, so the two returns agree exactly. And the flows must be correlated with the price: uncorrelated flows produce a surface term whose correlation part ⟨n\'P\'⟩ averages to zero, and the two returns wander around each other without a trend. Only when buying surges with the price does the flux carry more dollars than mean × mean — you paid above the average price — and the account earns less than the fund it holds. Same term as the turbulent heat flux on the energy face. The gap is a Reynolds covariance.',
  },
  {
    q: 'A critic says the behavior gap is an artifact: it depends on where you draw the account. Use the box to show what they mean, and say what the theorem says about who is right.',
    probe: 'On the wealth face, drag the upstream face left to include shares "on the sidelines" that have not been bought yet, and watch the ledger repartition.',
    resolution:
      'The theorem says both are right and neither can win, because it is an identity about the boundary: dB_sys/dt is fixed, and how it splits into "return the account earned" and "dollars that crossed the boundary" is decided by the boundary. Include the cash on the sidelines in the control volume and a deposit stops being a flux and becomes an internal transfer — the measured gap changes with no change in behavior. That is not a flaw in the gap; it is the content of the theorem. The honest version of the claim is "with the account boundary drawn HERE, the surface term costs this much," and the argument is about the boundary, not the physics.',
  },
  {
    q: 'Money is not conserved — banks create it. Which term of the theorem absorbs that, and what does it change about the wealth face?',
    probe: 'Compare the mass face, whose source chip reads zero by law, with the wealth face, whose source is the market.',
    resolution:
      'The source term. Mass has dB_sys/dt = 0 by law; wealth has dB_sys/dt = the market\'s gain on every share, everywhere, whether or not it is in your box — and credit creation is a second source, sitting outside any one account. The theorem itself is indifferent: it is the balance-sheet identity that a brokerage statement obeys (market gain = Δbalance + withdrawals − deposits) and it holds with or without a source. What changes is that choosing the extensive property becomes the real work: b = shares is conserved, b = dollars is not, and the same page reads differently depending on which you tag as the dye.',
  },
];

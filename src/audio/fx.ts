/**
 * Master effects chain.
 * Signal path: input → filter → bitcrusher → feedback delay → reverb → output
 */
import * as Tone from "tone";
import { clamp } from "../state/pattern";
import type { FxParams } from "../state/pattern";

export class FxChain {
  readonly input: Tone.Gain;
  readonly output: Tone.Gain;
  private filter: Tone.Filter;
  private crusher: Tone.BitCrusher;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.Reverb;

  constructor() {
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    this.filter = new Tone.Filter({ type: "lowpass", frequency: 18000, rolloff: -24 });
    this.crusher = new Tone.BitCrusher({ bits: 16 });
    this.crusher.wet.value = 0;
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.35, wet: 0 });
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0 });

    this.input.chain(this.filter, this.crusher, this.delay, this.reverb, this.output);
  }

  apply(fx: FxParams): void {
    this.setFilter(fx.filter);
    this.setCrush(fx.crush);
    this.setDelay(fx.delay);
    this.setReverb(fx.reverb);
  }

  setFilter(value: number): void {
    const v = clamp(value, 0, 1);
    const freq = 120 * Math.pow(18000 / 120, v);
    this.filter.frequency.rampTo(freq, 0.05);
  }

  setCrush(value: number): void {
    const v = clamp(value, 0, 1);
    this.crusher.wet.rampTo(v, 0.05);
    this.crusher.bits.value = Math.round(16 - v * 12);
  }

  setDelay(value: number): void {
    this.delay.wet.rampTo(clamp(value, 0, 1), 0.05);
  }

  setReverb(value: number): void {
    this.reverb.wet.rampTo(clamp(value, 0, 1), 0.05);
  }

  connect(destination: Tone.InputNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.input.dispose();
    this.filter.dispose();
    this.crusher.dispose();
    this.delay.dispose();
    this.reverb.dispose();
    this.output.dispose();
  }
}

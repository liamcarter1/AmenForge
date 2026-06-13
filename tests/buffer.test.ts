import { describe, it, expect } from "vitest";
import { toMono, encodeWav, type ChannelData } from "../src/audio/buffer";

function mockBuffer(channels: number[][], sampleRate = 44100): ChannelData {
  const data = channels.map((c) => Float32Array.from(c));
  return {
    numberOfChannels: data.length,
    length: data[0].length,
    sampleRate,
    getChannelData: (c: number) => data[c],
  };
}

describe("toMono", () => {
  it("returns a copy of the single channel for mono input", () => {
    const buf = mockBuffer([[0.1, 0.2, 0.3]]);
    const mono = toMono(buf);
    expect(mono.length).toBe(3);
    expect(mono[0]).toBeCloseTo(0.1);
    expect(mono[1]).toBeCloseTo(0.2);
    expect(mono[2]).toBeCloseTo(0.3);
    expect(mono).not.toBe(buf.getChannelData(0));
  });

  it("averages stereo channels", () => {
    const buf = mockBuffer([[1, 0, -1], [0, 0, 1]]);
    const mono = toMono(buf);
    expect(mono[0]).toBeCloseTo(0.5);
    expect(mono[1]).toBeCloseTo(0);
    expect(mono[2]).toBeCloseTo(0);
  });
});

describe("encodeWav", () => {
  it("writes a valid RIFF/WAVE header", () => {
    const wav = encodeWav([Float32Array.from([0, 0.5, -0.5, 1])], 44100);
    const view = new DataView(wav);
    const tag = (off: number) =>
      String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(12)).toBe("fmt ");
    expect(tag(36)).toBe("data");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it("produces the correct byte length for the data", () => {
    const frames = 100;
    const wav = encodeWav([new Float32Array(frames), new Float32Array(frames)], 48000);
    expect(wav.byteLength).toBe(44 + frames * 2 * 2);
    const view = new DataView(wav);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(40, true)).toBe(frames * 2 * 2);
  });

  it("clamps and quantises samples to PCM16", () => {
    const wav = encodeWav([Float32Array.from([2, -2, 0])], 44100);
    const view = new DataView(wav);
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
    expect(view.getInt16(48, true)).toBe(0);
  });

  it("throws on empty or mismatched channels", () => {
    expect(() => encodeWav([], 44100)).toThrow();
    expect(() => encodeWav([new Float32Array(4), new Float32Array(5)], 44100)).toThrow();
  });
});

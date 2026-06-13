/**
 * Buffer utilities: channel mix-down and WAV (PCM16) encoding.
 */

export interface ChannelData {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export function toMono(buf: ChannelData): Float32Array {
  const { numberOfChannels, length } = buf;
  if (numberOfChannels <= 1) return buf.getChannelData(0).slice();
  const out = new Float32Array(length);
  for (let c = 0; c < numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += data[i];
  }
  const inv = 1 / numberOfChannels;
  for (let i = 0; i < length; i++) out[i] *= inv;
  return out;
}

function floatToPcm16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? s * 0x8000 : s * 0x7fff;
}

export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  if (channels.length === 0) throw new Error("encodeWav: need at least one channel");
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  for (const ch of channels) {
    if (ch.length !== numFrames) throw new Error("encodeWav: channels must be equal length");
  }

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      view.setInt16(offset, floatToPcm16(channels[c][i]), true);
      offset += 2;
    }
  }
  return buffer;
}

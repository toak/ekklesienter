/**
 * Converts Gain (linear 0-1+) to Decibels (dB)
 * 0 dB = 1.0 gain
 * Gain 2.0 = +6.02 dB
 */
export const gainToDb = (gain: number): string => {
    if (gain <= 0) return '-∞';
    const db = 20 * Math.log10(gain);
    return (db > 0 ? '+' : '') + db.toFixed(1);
};

/**
 * Converts Decibels (dB) to Gain (linear)
 * 0 dB = 1.0 gain
 */
export const dbToGain = (db: number): number => {
    return Math.pow(10, db / 20);
};
/**
 * Extracts peaks from an AudioBuffer to be used for waveform visualization.
 * It combines channels and returns an array of normalized peaks (0 to 1).
 */
export const generateWaveformPoints = (buffer: AudioBuffer, samples: number): number[] => {
    const { numberOfChannels, length } = buffer;
    const channelData: Float32Array[] = [];

    // Get data for all channels
    for (let i = 0; i < numberOfChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }

    const points: number[] = [];
    const blockSize = Math.floor(length / samples);

    // AI Performance Optimization: For very large buffers, we sample instead of checking EVERY point.
    // 44.1kHz * 60s = 2.6M samples. Doing 100 iterations of 26k iterations = 2.6M operations.
    // With 2 channels, that's 5.2M operations in a blocking loop.
    // We cap the samples checked per block to 1000 for responsive UI.
    const maxSamplesPerBlock = 1000;
    const sampleStep = Math.max(1, Math.floor(blockSize / maxSamplesPerBlock));

    for (let i = 0; i < samples; i++) {
        const start = i * blockSize;
        let max = 0;

        // Find maximum peak in this block across all channels
        for (let c = 0; c < numberOfChannels; c++) {
            const data = channelData[c];
            // Iterate with sampleStep to jump over points if block is too large
            for (let j = 0; j < blockSize; j += sampleStep) {
                const val = Math.abs(data[start + j]);
                if (val > max) max = val;
            }
        }
        points.push(max);
    }

    return points;
};


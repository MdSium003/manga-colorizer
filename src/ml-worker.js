import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

self.onmessage = async (event) => {
    // We now receive the 'hints' array from React
    const { imageData, hints, modelPath } = event.data;

    try {
        // We tell it to try WebGPU first. If the user's browser is old and doesn't support it, 
        // it safely falls back to WASM (CPU).
        const session = await ort.InferenceSession.create(modelPath, { 
            executionProviders: ['webgpu', 'wasm'] 
        });

        const tensor512 = preprocess(imageData);

        const feeds = {};
        for (const inputName of session.inputNames) {
            
            if (inputName === 'line') {
                feeds[inputName] = tensor512;
            } else if (inputName === 'hint') {
                
                // 1. Create the blank 128x128 4-Channel Array
                const hintData = new Float32Array(4 * 128 * 128).fill(0.0);
                const size128 = 128 * 128;

                // 2. Loop through every click the user made
                // 2. Loop through every click the user made
                hints.forEach(hint => {
                    // Scale the 512x512 click down to a 128x128 coordinate
                    const px = Math.floor(hint.x / 4);
                    const py = Math.floor(hint.y / 4);

                    // --- FIX: USE A 3x3 BLOCK FOR STRONGER HINT INFLUENCE ---
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const npx = px + dx;
                            const npy = py + dy;

                            if (npx >= 0 && npx < 128 && npy >= 0 && npy < 128) {
                                const idx = npy * 128 + npx;
                                hintData[idx] = hint.r / 255.0;                   // Red
                                hintData[idx + size128] = hint.g / 255.0;         // Green
                                hintData[idx + 2 * size128] = hint.b / 255.0;     // Blue
                                hintData[idx + 3 * size128] = 1.0;                // Alpha Mask
                            }
                        }
                    }
                });

                feeds[inputName] = new ort.Tensor('float32', hintData, [1, 4, 128, 128]);
                
            } else {
                const blankData = new Float32Array(1 * 128 * 128).fill(0.0);
                feeds[inputName] = new ort.Tensor('float32', blankData, [1, 1, 128, 128]);
            }
        }

        const results = await session.run(feeds);
        const outputTensor = results[session.outputNames[0]];
        const finalPixels = postprocess(outputTensor);

        self.postMessage({ success: true, pixels: finalPixels, width: 512, height: 512 });

    } catch (error) {
        console.error("ONNX Runtime Error:", error);
        self.postMessage({ success: false, error: error.message || error.toString() });
    }
};

// --- THE MATH ---

function preprocess(imageData) {
    const { data, width, height } = imageData; // This will be 512 from App.jsx
    
    // We only need 1 channel (Grayscale)
    const float32Data = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
        // Grab Red channel and convert 0-255 to 0.0-1.0
        let val = data[i * 4] / 255.0;

        // --- FIX: LINEART HARDENING ---
        // Boost contrast: make near-whites pure white and near-blacks pure black
        if (val > 0.8) val = 1.0;
        else if (val < 0.2) val = 0.0;
        else {
            // Apply a simple sigmoid-like contrast curve for the middle values
            val = (val - 0.2) / 0.6; 
        }

        float32Data[i] = val;
    }

    // Shape is [1, 1, 512, 512]
    return new ort.Tensor('float32', float32Data, [1, 1, height, width]);
}

function postprocess(tensor) {
    const size = 512 * 512; // Output is high-res 512x512
    const rgbaPixels = new Uint8ClampedArray(size * 4);
    const tensorData = tensor.data;

    for (let i = 0; i < size; i++) {
        // Convert 0.0-1.0 back to 0-255
        let r = tensorData[i] * 255.0;
        let g = tensorData[i + size] * 255.0;
        let b = tensorData[i + 2 * size] * 255.0;

        rgbaPixels[i * 4 + 0] = Math.max(0, Math.min(255, r)); // Red
        rgbaPixels[i * 4 + 1] = Math.max(0, Math.min(255, g)); // Green
        rgbaPixels[i * 4 + 2] = Math.max(0, Math.min(255, b)); // Blue
        rgbaPixels[i * 4 + 3] = 255;                           // Alpha
    }

    return rgbaPixels;
}
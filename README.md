# ✒️ COLOR-PANEL AI: Manga Colorizer

🚀 **[Live Demo](https://mdsium003.github.io/manga-colorizer/)**

![Manga Colorizer Preview](https://images.unsplash.com/photo-1601039727490-458d3e7f2799?q=80&w=1000&auto=format&fit=crop)

**COLOR-PANEL AI** is a professional-grade, high-performance web application designed for interactive manga lineart colorization. It uses Edge-ML technology to colorize grayscale panels directly in your browser without uploading your art to a server.

## 🚀 Key Features

*   **Interactive Hinting:** Guide the AI by placing colored dots (hints) on your drawing to define color zones.
*   **Edge-ML Inference:** Powered by ONNX Runtime Web for near-instant results using your device's GPU/CPU.
*   **Professional Manga Aesthetic:** A custom-built UI featuring halftone textures, translucent SFX, and a stylized panel workspace.
*   **High-Res Lineart Preservation:** Uses a smart "Multiply" blend mode and lineart hardening preprocessing to keep your inks sharp and crisp.

## 🛠️ Technology Stack

*   **Frontend Ecosystem:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) (Speed-optimized build tool).
*   **AI Engine:** [ONNX Runtime Web](https://onnxruntime.ai/) (WebGPU & WASM fallback).
*   **Architecture:** Multi-threaded processing via **Web Workers** to keep the UI responsive during inference.
*   **Styling:** Vanilla CSS with **Glassmorphism** and **Manga Studio** design principles.
*   **Data Integrity:** [Supabase](https://supabase.com/) integration for future cloud gallery features.

## 🧠 How It Works

1.  **Preprocessing:** When you upload lineart, the engine applies "Lineart Hardening." This increases contrast and clears digital noise from scan artifacts, providing the AI with a clean 512x512 feature map.
2.  **Hint Mapping:** Your color clicks are converted into a $128 \times 128$ hint tensor. Each hint is expanded into a $3 \times 3$ block to ensure the U-Net architecture recognizes the color influence.
3.  **Inference:** The ONNX model (a specialized U-Net) processes the lineart and hint tensors simultaneously to generate a high-res RGB color map.
4.  **Post-processing:** The generated colors are blended back with the original high-res inks using a `multiply` composite operation, preserving every stroke of your original art.

## 📦 Model Credit

The pretrained ONNX model used in this project is based on the research and implementation from:
👉 **[SketchColorization by rapidrabbit76](https://github.com/rapidrabbit76/SketchColorization)**

## 💻 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/MdSium003/manga-colorizer.git
    cd manga-colorizer
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:5173`.

---
*Created with ❤️ for manga artists and enthusiasts.*

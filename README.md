# NewsFlow2 - Development Guide (Updated: 2026-03-10)

This project now uses **Vite** to support environment variables (`.env`) and npm packages.

## Prerequisite: Running the Project

You **cannot** open the `.html` files directly in your browser anymore. You must use the Vite development server.

1.  **Open your terminal** in the `NewsFlow2` folder.
2.  **Run this command**:
    ```bash
    npm run dev
    ```
3.  **Open the URL** that appears in the terminal (usually `http://localhost:3000`).

## Why this error happens
Browsers don't know where to find packages like `firebase/auth` by themselves. When you run `npm run dev`, Vite starts a "smart" server that finds these packages in your `node_modules` and sends them to the browser correctly.

## Deployment (Netlify/GitHub)

I've added a **`netlify.toml`** file to the project. If you are using Netlify:
1.  **Push your changes** to GitHub.
2.  Netlify will automatically see the `netlify.toml` and know to:
    -   Run `npm run build`
    -   Serve the `dist` folder
3.  **Crucial**: You must add your Firebase keys (from your `.env` file) as **Environment Variables** in the Netlify Dashboard (Site settings > Build & deploy > Environment).

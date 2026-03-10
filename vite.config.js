import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                admin: 'admin.html',
                article: 'article.html'
            }
        },
        outDir: 'dist'
    },
    server: {
        port: 3000
    }
});

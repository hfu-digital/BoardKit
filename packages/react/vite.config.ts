import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react(), dts()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'BoardKitReact',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'es.' : ''}js`,
        },
        cssCodeSplit: false,
        // Inline cap of 0 keeps every font as a separate file. Inlining them
        // would balloon the CSS file with base64 and break HTTP caching.
        assetsInlineLimit: 0,
        rollupOptions: {
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                '@hfu.digital/boardkit-core',
                'socket.io-client',
                'lucide-react',
                'roughjs',
                'roughjs/bin/canvas',
                'roughjs/bin/generator',
            ],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@hfu.digital/boardkit-core': 'BoardKitCore',
                    'lucide-react': 'LucideReact',
                    roughjs: 'rough',
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.css')) return 'boardkit.css';
                    if (assetInfo.name?.endsWith('.woff2')) return 'fonts/[name][extname]';
                    return 'assets/[name][extname]';
                },
            },
        },
    },
});

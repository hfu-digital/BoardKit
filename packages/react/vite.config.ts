import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react(), dts({ rollupTypes: true })],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'BoardKitReact',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'es.' : ''}js`,
        },
        rollupOptions: {
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                '@boardkit/core',
            ],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@boardkit/core': 'BoardKitCore',
                },
            },
        },
    },
});

// Bundled stylesheet — vite extracts this to dist/boardkit.css. Consumers can
// either import this entry (CSS is auto-included by Next.js / most bundlers)
// or explicitly import '@hfu.digital/boardkit-react/styles.css' to opt in.
import './styles/index.css';
// Inject @font-face for Virgil + Cascadia at runtime so the woff2 files stay
// as separate dist assets (avoids CSS base64 bloat).
import './styles/fonts';

// Context
export { BoardKitProvider, useBoardKit } from './context/BoardKitProvider';
export type { BoardKitConfig, BoardKitTheme, BoardKitProviderProps } from './context/BoardKitProvider';

// Components
export * from './components';

// Hooks
export * from './hooks';

// Engine
export * from './engine';

// Gestures
export * from './gestures';

// Store
export * from './store';

/**
 * Minimal React client demonstrating BoardKitProvider and useCollaboration.
 *
 * Wrap your app in BoardKitProvider with the server URL, then use the
 * provided hooks and components for real-time collaboration.
 */

import React from 'react';
import { BoardKitProvider } from '@hfu.digital/boardkit-react';

const config = {
    apiUrl: 'http://localhost:3000',
    wsUrl: 'http://localhost:3000',
    authToken: 'demo-token',
};

export default function App() {
    return (
        <BoardKitProvider config={config}>
            <div style={{ width: '100vw', height: '100vh' }}>
                <h1 style={{ padding: 16, margin: 0 }}>BoardKit Example</h1>
                <p style={{ padding: '0 16px' }}>
                    This is a minimal example. See the package READMEs for full
                    component and hook documentation.
                </p>
            </div>
        </BoardKitProvider>
    );
}

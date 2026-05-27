import App from '../App';

// Thin wrapper so routing can mount the existing full UI at /app
export default function AppShell() {
    return <App />;
}

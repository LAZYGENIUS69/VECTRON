import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';

export default function AppRoutes() {
    return (
        <Routes>
            {/* Upload UI is the primary page until landing page enhancement is complete */}
            <Route path="/" element={<AppShell />} />
            <Route path="/app" element={<AppShell />} />
            <Route path="/app/*" element={<AppShell />} />
            {/* Landing page available at /landing for preview/development */}
            <Route path="/landing" element={<Landing />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

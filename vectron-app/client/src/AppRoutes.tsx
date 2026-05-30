import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import AppShell from './pages/AppShell';

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppShell />} />
            {/* Optional: keep any old /app/* deep routes landing on the UI */}
            <Route path="/app/*" element={<AppShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

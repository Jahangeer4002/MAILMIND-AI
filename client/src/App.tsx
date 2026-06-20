import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import ThreadPage from './pages/ThreadPage';
import EmailDetailPage from './pages/EmailDetailPage';
import ComposePage from './pages/ComposePage';
import CategoriesPage from './pages/CategoriesPage';
import AssistantPage from './pages/AssistantPage';
import NewsDigestPage from './pages/NewsDigestPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/threads/:id" element={<ThreadPage />} />
        <Route path="/emails/:id" element={<EmailDetailPage />} />
        <Route path="/compose" element={<ComposePage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/news" element={<NewsDigestPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

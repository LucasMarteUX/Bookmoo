import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useLanguage } from '@/store/useLanguage'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { Dashboard } from '@/pages/Dashboard'
import { BookPage } from '@/pages/BookPage'
import { VocabularyPage } from '@/pages/VocabularyPage'
import { Stats } from '@/pages/Stats'
import { PracticePage } from '@/pages/PracticePage'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'
import { SignUp } from '@/pages/SignUp'
import { LegalPage } from '@/pages/legal/LegalPage'
import { Gallery } from '@/pages/Gallery'
import { AdminPage } from '@/pages/Admin'
import { AdminBookEdit } from '@/pages/AdminBookEdit'
import { MePage } from '@/pages/Me'
import { Community, ConnectionsPage, NotificationsPage, PostPage, PublicProfile } from '@/pages/Community'

function ThemeToBody() {
  const { theme } = useReaderSettings()
  const { locale } = useLanguage()
  useVisualViewport()
  useEffect(() => {
    document.body.className = `theme-${theme} font-sans antialiased transition-colors duration-300`
    // O <html> também recebe o tema: sem isso, o fundo branco padrão aparece nas bordas (rolagem elástica, cantos).
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-sepia', 'theme-dark')
    root.classList.add(`theme-${theme}`)
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
    // Barra de status / barra do Safari com a cor do app.
    const navBg = getComputedStyle(root).getPropertyValue('--theme-nav-bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', navBg || '#F6F3EE')
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', theme === 'dark' ? 'black' : 'default')
  }, [theme])
  // Leitor de tela pronuncia no idioma certo.
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ThemeToBody />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/terms" element={<LegalPage doc="terms" />} />
          <Route path="/privacy" element={<LegalPage doc="privacy" />} />
          <Route path="/faq" element={<LegalPage doc="faq" />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="book/:id" element={<BookPage />} />
            <Route path="vocabulary" element={<VocabularyPage />} />
            <Route path="stats" element={<Stats />} />
            <Route path="practice/:kind" element={<PracticePage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="gallery/:id" element={<Gallery />} />
            <Route path="community" element={<Community />} />
            <Route path="profile/:userId" element={<PublicProfile />} />
            <Route path="u/:handle" element={<PublicProfile />} />
            <Route path="post/:id" element={<PostPage />} />
            <Route path="u/:handle/:list" element={<ConnectionsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/books/:id" element={<AdminBookEdit />} />
            <Route path="me" element={<MePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

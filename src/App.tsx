import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { useReaderSettings } from '@/store/useReaderSettings'
import { Dashboard } from '@/pages/Dashboard'
import { BookPage } from '@/pages/BookPage'
import { VocabularyPage } from '@/pages/VocabularyPage'
import { Stats } from '@/pages/Stats'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'
import { SignUp } from '@/pages/SignUp'

function ThemeToBody() {
  const { theme } = useReaderSettings()
  useEffect(() => {
    document.body.className = `theme-${theme} font-sans antialiased transition-colors duration-300`
  }, [theme])
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
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

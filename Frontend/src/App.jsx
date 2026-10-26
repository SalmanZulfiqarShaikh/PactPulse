import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'

import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PublicOnly, RequireAuth } from './components/RouteGuards'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { Landing } from './pages/Landing'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { Dashboard } from './pages/Dashboard'
import { UploadPage } from './pages/UploadPage'
import { ContractPage } from './pages/ContractPage'
import { AccountPage } from './pages/AccountPage'
import { NotFound } from './pages/NotFound'

/** Navigating to a new page should start at the top of it, not mid-scroll. */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />

            <Routes>
              <Route path="/" element={<Landing />} />

              {/* Signed-out pages. A live session redirects straight to /app. */}
              <Route element={<PublicOnly />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify" element={<VerifyEmailPage />} />
              </Route>

              {/* Everything behind the session check. */}
              <Route path="/app" element={<RequireAuth />}>
                {/* AppShell is a layout route: every page below renders inside it. */}
                <Route element={<AppShell />}>
                  <Route index element={<Dashboard />} />
                  <Route path="upload" element={<UploadPage />} />
                  <Route path="contracts/:contractId" element={<ContractPage />} />
                  <Route path="account" element={<AccountPage />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

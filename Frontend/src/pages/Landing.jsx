import { useAuth } from '../context/AuthContext'
import { SiteFooter } from '../components/landing/SiteFooter'
import { SiteNav } from '../components/landing/SiteNav'
import {
  AskSection,
  ChecklistSection,
  ClosingCall,
  Faq,
  Hero,
  PlainWords,
  PrivacySection,
} from '../components/landing/Sections'

/** The public landing page. Sections live in components/landing. */
export function Landing() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-[#F2F4F3] font-grotesk text-[#1B2A38] dark:bg-stone-950 dark:text-stone-100">
      <SiteNav authenticated={isAuthenticated} />
      <main>
        <Hero authenticated={isAuthenticated} />
        <PlainWords />
        <AskSection />
        <ChecklistSection />
        <PrivacySection />
        <Faq />
        <ClosingCall authenticated={isAuthenticated} />
      </main>
      <SiteFooter />
    </div>
  )
}

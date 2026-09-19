import { HashRouter, Route, Routes } from 'react-router-dom'
import { DiceProvider } from '@/hooks/DiceProvider.tsx'
import { ConjureProvider } from '@/hooks/ConjureProvider.tsx'
import { AppShell } from '@/components/layout/AppShell.tsx'
import { BestiaryPage } from '@/pages/BestiaryPage.tsx'
import { ConjurePage } from '@/pages/ConjurePage.tsx'
import { ScribePage } from '@/pages/ScribePage.tsx'
import { MonsterPage } from '@/pages/MonsterPage.tsx'
import { SettingsPage } from '@/pages/SettingsPage.tsx'

export default function App() {
  return (
    <DiceProvider>
      <HashRouter>
        <ConjureProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<BestiaryPage />} />
              <Route path="/conjure" element={<ConjurePage />} />
              <Route path="/scribe" element={<ScribePage />} />
              <Route path="/scribe/:id" element={<ScribePage />} />
              <Route path="/monster/:id" element={<MonsterPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </ConjureProvider>
      </HashRouter>
    </DiceProvider>
  )
}

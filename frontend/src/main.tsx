import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/hooks/useAuth'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Backend data is served from a shared Google Sheet with a tight API
      // quota — a longer staleTime means navigating around the app within a
      // session reuses what's already fetched instead of re-requesting it.
      staleTime: 45_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)

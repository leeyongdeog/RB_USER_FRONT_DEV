import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import AppDialogHost from './components/AppDialog';
import TradeListingDialogHost from './components/TradeListingDialog';
import './styles.css';
import './shop.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App/><AppDialogHost/><TradeListingDialogHost/></BrowserRouter></QueryClientProvider></StrictMode>,
);

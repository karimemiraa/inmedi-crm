import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { useSession } from './data/auth.js';
import { registerAutomations, setAutomationToaster } from './lib/automation.js';
import { useToast } from './components/Toast.jsx';
import Login from './pages/Login.jsx';

registerAutomations();

import Dashboard from './pages/Dashboard.jsx';
import Accounts from './pages/Accounts.jsx';
import AccountDetail from './pages/AccountDetail.jsx';
import Contacts from './pages/Contacts.jsx';
import ContactDetail from './pages/ContactDetail.jsx';
import Duplicates from './pages/Duplicates.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Orders from './pages/Orders.jsx';
import RecurringOrders from './pages/RecurringOrders.jsx';
import Invoices from './pages/Invoices.jsx';
import Contracts from './pages/Contracts.jsx';
import Service from './pages/Service.jsx';
import Quality from './pages/Quality.jsx';
import Products from './pages/Products.jsx';
import Activities from './pages/Activities.jsx';
import Leads from './pages/Leads.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Campaigns from './pages/Campaigns.jsx';
import Events from './pages/Events.jsx';
import Territories from './pages/Territories.jsx';
import Provision from './pages/Provision.jsx';
import Reports from './pages/Reports.jsx';
import Documents from './pages/Documents.jsx';
import Ideas from './pages/Ideas.jsx';
import Messages from './pages/Messages.jsx';
import CostCalc from './pages/CostCalc.jsx';
import CareCostAnalysis from './pages/CareCostAnalysis.jsx';
import DataProtection from './pages/DataProtection.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import VorgangPage from './pages/VorgangPage.jsx';
import TeamMember from './pages/TeamMember.jsx';
import Assistant from './pages/Assistant.jsx';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'accounts', element: <Accounts /> },
      { path: 'accounts/:id', element: <AccountDetail /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'contacts/:id', element: <ContactDetail /> },
      { path: 'duplicates', element: <Duplicates /> },
      { path: 'pipeline', element: <Pipeline /> },
      { path: 'orders', element: <Orders /> },
      { path: 'recurring-orders', element: <RecurringOrders /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'contracts', element: <Contracts /> },
      { path: 'service', element: <Service /> },
      { path: 'quality', element: <Quality /> },
      { path: 'cost-calc', element: <CostCalc /> },
      { path: 'care-cost', element: <CareCostAnalysis /> },
      { path: 'products', element: <Products /> },
      { path: 'activities', element: <Activities /> },
      { path: 'leads', element: <Leads /> },
      { path: 'leads/:id', element: <LeadDetail /> },
      { path: 'campaigns', element: <Campaigns /> },
      { path: 'events', element: <Events /> },
      { path: 'territories', element: <Territories /> },
      { path: 'provision', element: <Provision /> },
      { path: 'reports', element: <Reports /> },
      { path: 'documents', element: <Documents /> },
      { path: 'ideas', element: <Ideas /> },
      { path: 'messages', element: <Messages /> },
      { path: 'datenschutz', element: <DataProtection /> },
      { path: 'profile', element: <Profile /> },
      { path: 'settings', element: <Settings /> },
      { path: 'vorgang/:slug/:id', element: <VorgangPage /> },
      { path: 'team/:id', element: <TeamMember /> },
      { path: 'assistant', element: <Assistant /> },
      // Entfernte Module (Serviceaufträge, Geräte) und unbekannte Links → Dashboard
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

function App() {
  const session = useSession();
  const toast = useToast();
  React.useEffect(() => { setAutomationToaster(toast); }, [toast]);
  if (!session) return <Login />;
  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);

import { createBrowserRouter } from "react-router-dom";
import { lazy, type ComponentType } from "react";
import { AppShell } from "../layouts/app-shell";
import { PublicLayout } from "../layouts/public-layout";
import {
  NoAccessPage,
  NotFoundPage,
  RouteErrorPage,
} from "../pages/system-pages";
import { GuestRoute, ProtectedRoute } from "../routes/protected-route";

const page = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(async () => ({ default: (await loader())[name] as ComponentType }));

const publicPages = () => import("../pages/public-pages");
const authPages = () => import("../pages/auth-pages");
const portalPages = () => import("../pages/portal-pages");
const staffPages = () => import("../pages/staff-pages");
const staffOperationsPages = () => import("../pages/staff-operations");
const staffTicketDetailPages = () => import("../pages/staff-ticket-detail");
const HomePage = page(publicPages, "HomePage");
const HowItWorksPage = page(publicPages, "HowItWorksPage");
const PublicFaqPage = page(publicPages, "PublicFaqPage");
const AboutPage = page(publicPages, "AboutPage");
const HelpPage = page(publicPages, "HelpPage");
const LegalPage = lazy(async () => ({
  default: (await publicPages()).LegalPage,
}));
const LoginPage = page(authPages, "LoginPage");
const RegisterPage = page(authPages, "RegisterPage");
const ForgotPasswordPage = page(authPages, "ForgotPasswordPage");
const ResetPasswordPage = page(authPages, "ResetPasswordPage");
const VerifyAccountPage = page(authPages, "VerifyAccountPage");
const ClientDashboardPage = page(portalPages, "ClientDashboardPage");
const ClientTicketsPage = page(portalPages, "ClientTicketsPage");
const NewTicketPage = page(portalPages, "NewTicketPage");
const TicketCreatedPage = page(portalPages, "TicketCreatedPage");
const TicketDetailPage = lazy(async () => ({
  default: (await portalPages()).TicketDetailPage,
}));
const StaffTicketDetailPage = lazy(async () => ({
  default: (await staffTicketDetailPages()).StaffTicketDetailPage,
}));
const ClientFaqPage = page(portalPages, "ClientFaqPage");
const ChatbotPage = page(portalPages, "ChatbotPage");
const ProfilePage = page(portalPages, "ProfilePage");
const AdvisorDashboardPage = page(staffOperationsPages, "AdvisorDashboardPage");
const AdvisorInboxPage = page(staffOperationsPages, "AdvisorInboxPage");
const AdvisorHistoryPage = page(staffOperationsPages, "AdvisorHistoryPage");
const KnowledgePage = page(staffPages, "KnowledgePage");
const SupervisorDashboardPage = page(
  staffOperationsPages,
  "SupervisorDashboardPage",
);
const SupervisorQueuePage = page(staffOperationsPages, "SupervisorQueuePage");
const SupervisorHistoryPage = page(
  staffOperationsPages,
  "SupervisorHistoryPage",
);
const AssignmentsPage = page(staffOperationsPages, "AssignmentsPage");
const ContentManagementPage = page(staffPages, "ContentManagementPage");
const SlaPage = page(staffPages, "SlaPage");
const ReportsPage = page(staffPages, "ReportsPage");
const AuditPage = page(staffPages, "AuditPage");

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "como-funciona", element: <HowItWorksPage /> },
      { path: "preguntas-frecuentes", element: <PublicFaqPage /> },
      { path: "nosotros", element: <AboutPage /> },
      { path: "ayuda", element: <HelpPage /> },
      { path: "privacidad", element: <LegalPage type="privacy" /> },
      { path: "terminos", element: <LegalPage type="terms" /> },
    ],
  },
  { path: "restablecer-acceso", element: <ResetPasswordPage /> },
  { path: "verificar-cuenta", element: <VerifyAccountPage /> },
  {
    element: <GuestRoute />,
    children: [
      { path: "ingresar", element: <LoginPage /> },
      { path: "registro", element: <RegisterPage /> },
      { path: "recuperar-acceso", element: <ForgotPasswordPage /> },
    ],
  },
  { path: "sin-acceso", element: <NoAccessPage /> },
  {
    element: <ProtectedRoute roles={["CLIENTE"]} />,
    children: [
      {
        path: "app",
        element: <AppShell />,
        children: [
          { path: "inicio", element: <ClientDashboardPage /> },
          { path: "solicitudes", element: <ClientTicketsPage /> },
          { path: "nueva-solicitud", element: <NewTicketPage /> },
          { path: "solicitudes/:id/creada", element: <TicketCreatedPage /> },
          { path: "solicitudes/:id", element: <TicketDetailPage /> },
          { path: "faq", element: <ClientFaqPage /> },
          { path: "asistente", element: <ChatbotPage /> },
          { path: "perfil", element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute roles={["ASESOR"]} />,
    children: [
      {
        path: "asesor",
        element: <AppShell />,
        children: [
          { path: "panel", element: <AdvisorDashboardPage /> },
          { path: "bandeja", element: <AdvisorInboxPage /> },
          { path: "historial", element: <AdvisorHistoryPage /> },
          { path: "conocimiento", element: <KnowledgePage /> },
          {
            path: "tickets/:id",
            element: <StaffTicketDetailPage fallbackPath="/asesor/panel" />,
          },
          { path: "perfil", element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute roles={["SUPERVISOR"]} />,
    children: [
      {
        path: "supervisor",
        element: <AppShell />,
        children: [
          { path: "operacion", element: <SupervisorDashboardPage /> },
          { path: "cola", element: <SupervisorQueuePage /> },
          { path: "historial", element: <SupervisorHistoryPage /> },
          { path: "asignaciones", element: <AssignmentsPage /> },
          { path: "contenido", element: <ContentManagementPage /> },
          { path: "sla", element: <SlaPage /> },
          { path: "reportes", element: <ReportsPage /> },
          { path: "auditoria", element: <AuditPage /> },
          {
            path: "tickets/:id",
            element: <StaffTicketDetailPage fallbackPath="/supervisor/cola" />,
          },
          { path: "perfil", element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

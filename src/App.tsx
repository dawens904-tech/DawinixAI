import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Overview from "@/pages/Overview";
import Conversations from "@/pages/Conversations";
import Users from "@/pages/Users";
import BotConfig from "@/pages/BotConfig";
import Analytics from "@/pages/Analytics";
import SetupGuide from "@/pages/SetupGuide";
import SystemLogs from "@/pages/SystemLogs";
import WebhookSimulator from "@/pages/WebhookSimulator";
import CommandBuilder from "@/pages/CommandBuilder";
import SendMessage from "@/pages/SendMessage";
import Broadcast from "@/pages/Broadcast";
import NotFound from "@/pages/NotFound";
import { useState } from "react";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-dark-900 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto scrollbar-thin bg-grid">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/users" element={<Users />} />
              <Route path="/config" element={<BotConfig />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/setup" element={<SetupGuide />} />
              <Route path="/logs" element={<SystemLogs />} />
              <Route path="/simulator" element={<WebhookSimulator />} />
              <Route path="/commands" element={<CommandBuilder />} />
              <Route path="/send" element={<SendMessage />} />
              <Route path="/broadcast" element={<Broadcast />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}

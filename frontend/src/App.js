import "@/App.css";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import OpsPortal from "@/portals/OpsPortal";
import BusinessPortal from "@/portals/BusinessPortal";
import PartnerPortal from "@/portals/PartnerPortal";

// Subdomain locking: map hostname prefix -> forced portal.
const SUBDOMAIN_MAP = { ops: "/ops", app: "/business", partner: "/partner" };
function lockedPortal() {
  const host = window.location.hostname.split(".")[0];
  return SUBDOMAIN_MAP[host] || null;
}

function App() {
  const locked = lockedPortal();
  return (
    <div className="App">
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={locked ? <Navigate to={locked} replace /> : <Landing />} />
            <Route path="/ops/*" element={<OpsPortal />} />
            <Route path="/business/*" element={<BusinessPortal />} />
            <Route path="/partner/*" element={<PartnerPortal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
        <Toaster theme="dark" position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const tabs = [
    { to: "/", label: "Jobs" },
    { to: "/analytics", label: "Analytics" },
  ];

  return (
    <header className="border-b border-line bg-ink text-paper">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-14 gap-8">
        <Link to="/" className="font-semibold tracking-tight text-sm flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-signal inline-block" />
          Resume Screening
        </Link>
        <nav className="flex gap-1 flex-1">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={`px-3 py-1.5 text-sm rounded-sm transition ${
                location.pathname === t.to ? "bg-white/10 text-white" : "text-paper/70 hover:text-white"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-paper/70">
          <span className="font-mono text-xs">{user?.email}</span>
          <button onClick={() => { logout(); navigate("/login"); }} className="hover:text-white transition">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

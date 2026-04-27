import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 glow-green">
        <Zap className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-4xl font-bold text-gradient mb-2">404</h1>
      <p className="text-sm text-muted-foreground mb-6">This page doesn't exist in the Dawinix AI dashboard.</p>
      <button
        onClick={() => navigate("/")}
        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Back to Overview
      </button>
    </div>
  );
}

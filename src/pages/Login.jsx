import { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Completá email y contraseña");
      return;
    }
    setLoading(true);
    try {
      const emailNormalized = email.trim().toLowerCase();

      if (isSignupMode) {
        const { data, error } = await supabase.auth.signUp({
          email: emailNormalized,
          password,
        });
        if (error) throw error;

        toast.success("Cuenta creada correctamente.");
        toast.info("Pedí acceso al administrador para que te asigne un equipo.");

        if (data?.session) {
          window.location.href = "/";
          return;
        }

        toast.info("Si tu proyecto requiere verificación, revisá tu email para confirmar la cuenta.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailNormalized,
          password,
        });
        if (error) throw error;
        toast.success("Sesión iniciada");
        window.location.href = "/";
      }
    } catch (err) {
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("invalid login credentials")) {
        toast.error("Email o contraseña incorrectos");
      } else if (message.toLowerCase().includes("already registered")) {
        toast.error("Ese email ya está registrado. Iniciá sesión.");
      } else {
        toast.error(message || "Error de autenticación");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader>
          <CardTitle className="text-2xl">PRAGMA CRM</CardTitle>
          <CardDescription>
            {isSignupMode
              ? "Creá tu cuenta para ingresar. Luego pedí acceso al administrador."
              : "Iniciá sesión. El alta de usuarios la gestiona un administrador (invitación por correo)."}
          </CardDescription>
          {authError && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              {authError}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignupMode ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Procesando…" : isSignupMode ? "Crear cuenta" : "Entrar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsSignupMode((prev) => !prev)}
              disabled={loading}
            >
              {isSignupMode ? "Ya tengo cuenta, quiero iniciar sesión" : "No tengo cuenta, quiero registrarme"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

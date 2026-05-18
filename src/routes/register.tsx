import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Crear cuenta — EstateHub" }] }),
  component: Page,
});

function Page() {
  const register = useAppStore((s) => s.register);
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "tenant" as "tenant" | "owner",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = await register(form);
    if (!u) {
      toast.error("No se pudo crear la cuenta");
      return;
    }
    toast.success(`Cuenta creada, bienvenido ${u.name}`);
    nav({ to: u.role === "owner" ? "/owner" : "/tenant" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-warm text-primary-foreground">
            <Home className="h-4 w-4" />
          </div>
          <span className="font-display font-bold">EstateHub</span>
        </Link>

        <h2 className="font-display text-2xl font-bold">Crear cuenta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Soy</Label>
            <Select
              value={form.role}
              onValueChange={(v: "tenant" | "owner") => setForm({ ...form, role: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant">Inquilino — busco alquilar</SelectItem>
                <SelectItem value="owner">Propietario — quiero alquilar mis propiedades</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full bg-gradient-warm">
            Crear cuenta
          </Button>
        </form>
      </div>
    </div>
  );
}

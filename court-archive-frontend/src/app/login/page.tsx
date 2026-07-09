import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#0B1220] text-white">
      <h1 className="text-2xl font-bold mb-6">Arsip Perkara Suara</h1>
      <LoginForm />
    </main>
  );
}

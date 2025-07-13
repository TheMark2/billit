import LoginPage from '../login/page';

export default function RegisterPage() {
  // Simplemente renderiza el login pero con isLogin=false
  // El componente de login ya permite alternar entre login y registro
  return <LoginPage initialMode="register" />;
} 
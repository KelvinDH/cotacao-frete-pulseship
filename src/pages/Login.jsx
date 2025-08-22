import React, { useState, useEffect } from 'react';
import { User } from '@/components/ApiDatabase';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Lock, User as UserIcon, Key, CheckCircle, AlertCircle, Loader2, Fingerprint } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState(''); // ✅ NOVO: Estado para o CPF
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await User.me();
        if (user) {
          // ✅ ATUALIZADO: Redireciona com base no tipo de usuário, incluindo motorista
          let destinationPage = 'Quote'; // Padrão
          if (user.userType === 'carrier') destinationPage = 'Negotiation';
          if (user.userType === 'driver') destinationPage = 'MeusFretes';
          
          window.location.href = createPageUrl(destinationPage);
        }
      } catch (err) {
        // Usuário não está logado, permanece na página de login
      }
    };
    checkUser();
  }, []);

  // Login Padrão (usuário e senha)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!username || !password) {
      setError('Por favor, preencha todos os campos');
      setLoading(false);
      return;
    }

    try {
      const user = await User.login(username, password);
      
      if (user.requirePasswordChange) {
        setCurrentUser(user);
        setIsFirstLogin(true);
        setLoading(false);
        return;
      }

      setSuccess('Login realizado com sucesso! Redirecionando...');

      let destinationPage = user.userType === 'carrier' ? 'Negotiation' : 'Quote';
      if (user.userType === 'driver') destinationPage = 'MeusFretes';

      setTimeout(() => {
        window.location.href = createPageUrl(destinationPage);
      }, 1000);

    } catch (err) {
      setError(err.message || 'Credenciais inválidas ou erro no servidor.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOVO: Login do Motorista (CPF)
  const handleDriverLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!cpf) {
        setError('Por favor, informe o CPF');
        setLoading(false);
        return;
    }

    try {
        // Para login de motorista, passamos o CPF no campo 'username' e null na senha
        const user = await User.login(cpf, null);

        if (user && user.id) {
            setSuccess('Login realizado com sucesso! Redirecionando...');
            setTimeout(() => {
                window.location.href = createPageUrl('MeusFretes');
            }, 1000);
        } else {
             setError(user.error || 'CPF inválido ou motorista inativo.');
        }
    } catch (err) {
        setError(err.message || 'Ocorreu um erro. Verifique o CPF e tente novamente.');
    } finally {
        setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('Por favor, preencha todos os campos de senha');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      await User.update(currentUser.id, {
        password: newPassword,
        requirePasswordChange: false
      });

      setSuccess('Senha alterada com sucesso! Você já pode fazer o login.');
      setIsFirstLogin(false);
      setCurrentUser(null);
      setPassword('');

    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  if (isFirstLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
            <div className="flex justify-center mb-3">
              <div className="bg-white/20 p-3 rounded-full">
                <Key className="w-8 h-8" />
              </div>
            </div>
            <CardTitle className="text-2xl">Primeira Configuração</CardTitle>
            <CardDescription className="text-green-100">
              Por segurança, defina uma nova senha pessoal
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input 
                    id="newPassword" 
                    type={showNewPassword ? 'text' : 'password'} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    className="pr-10"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)} 
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="pr-10"
                    placeholder="Repita a nova senha"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando senha...
                  </>
                ) : (
                  'Definir Nova Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{
          backgroundImage: 'url(src/images/truck-fundo.jpg)',
        }}
      />
      
      <Card className="w-full max-w-md shadow-xl border-0 relative z-10">
        <CardHeader className="text-center bg-gradient-to-r from-gray-100 to-gray-200 text-white rounded-t-lg">
          <div className="flex justify-center mb-3">
            <div className=" rounded-full">
              <i className="text-gray-500 fa fa-user-circle fa-4x" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gray-500">Acessar Conta</CardTitle>
          <CardDescription className="text-green-100">
            
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {/* ✅ NOVO: Sistema de Abas */}
          <Tabs defaultValue="padrao" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="padrao">
                <UserIcon className="w-4 h-4 mr-2" />
                Acesso Padrão
              </TabsTrigger>
              <TabsTrigger value="motorista">
                <i className="fa fa-id-card w-4 h-4 mr-2" />
                Acesso Motorista
              </TabsTrigger>
            </TabsList>
            
            {/* Conteúdo da Aba Padrão */}
            <TabsContent value="padrao">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="username">Usuário</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input 
                        id="username" 
                        type="text" 
                        value={username} 
                        onChange={e => { setUsername(e.target.value); setError(''); }} 
                        className="pl-10"
                        placeholder="Nome de usuário"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input 
                        id="password" 
                        type={showPassword ? 'text' : 'password'} 
                        value={password} 
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        className="pl-10 pr-10"
                        placeholder="Senha"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    disabled={loading}
                  >
                    <i className='fa fa-chevron-right' />
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
            </TabsContent>
            
            {/* ✅ NOVO: Conteúdo da Aba Motorista */}
            <TabsContent value="motorista">
              <form onSubmit={handleDriverLogin} className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <div className="relative">
                    <i className="fa fa-id-card absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                      id="cpf" 
                      type="text" 
                      value={cpf} 
                      onChange={e => { setCpf(e.target.value); setError(''); }}
                      className="pl-10"
                      placeholder="Digite seu CPF"
                      maxLength="14" // Para 111.222.333-44
                    />
                  </div>
                   <p className="text-xs text-gray-500 mt-1">Exemplo: 123.456.789-00</p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Entrar como Motorista'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Alertas fora das abas para serem visíveis em ambas */}
          <div className="mt-4 space-y-2">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;

import React, { useState, useEffect } from 'react';
import { UserPlus, User as UserIcon, Mail, Lock, Building, AlertCircle, CheckCircle, Edit, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { User, Carrier } from '@/components/ApiDatabase'; 
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'user',
    carrierName: '',
    active: true,
    requirePasswordChange: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ✅ NOVO: Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadUsersAndCarriers();
  }, []);

  const loadUsersAndCarriers = async () => {
    setLoading(true);
    try {
      const usersList = await User.list();
      const carriersList = await Carrier.list();
      setUsers(usersList);
      setCarriers(carriersList.filter(c => c.active));
      setError('');
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Falha ao carregar dados. Verifique se a API está online.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      userType: 'user',
      carrierName: '',
      active: true,
      requirePasswordChange: false
    });
    setEditingUser(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleInputChange = (field, value) => {
    // Validações específicas por campo
    if (field === 'username') {
      // Username: apenas letras, números e pontos/underscores, máximo 25 caracteres
      if (value.length <= 25 && /^[a-zA-Z0-9._]*$/.test(value)) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'fullName') {
      // Nome completo: apenas letras e espaços, máximo 50 caracteres
      if (value.length <= 50 && /^[a-zA-ZÀ-ÿ\s]*$/.test(value)) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'email') {
      // Email: máximo 60 caracteres
      if (value.length <= 60) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'password' || field === 'confirmPassword') {
      // Senha: máximo 50 caracteres
      if (value.length <= 50) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Limpar campo de transportadora quando mudar o tipo de usuário
    if (field === 'userType' && value !== 'carrier') {
      setFormData(prev => ({ ...prev, carrierName: '' }));
    }
    
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.username || !formData.email) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!editingUser && !formData.password) {
      setError('Senha é obrigatória para novos usuários');
      return false;
    }

    if (formData.password && formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return false;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return false;
    }

    if (formData.userType === 'carrier' && !formData.carrierName) {
      setError('Transportadora é obrigatória para usuários do tipo Transportadora');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Por favor, insira um email válido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userData = {
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        userType: formData.userType,
        carrierName: formData.userType === 'carrier' ? formData.carrierName : null,
        active: formData.active,
        requirePasswordChange: formData.requirePasswordChange
      };

      // Só inclui a senha se ela foi digitada
      if (formData.password) {
        userData.password = formData.password;
      }

      if (editingUser) {
        await User.update(editingUser.id, userData);
        setSuccess('Usuário atualizado com sucesso!');
      } else {
        await User.create(userData);
        setSuccess('Usuário criado com sucesso!');
      }
      
      await loadUsersAndCarriers();
      resetForm();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMessage = err.response && err.response.data && err.response.data.error 
                           ? err.response.data.error 
                           : err.message || 'Erro ao salvar usuário';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      password: '',
      confirmPassword: '',
      userType: user.userType,
      carrierName: user.carrierName || '',
      active: user.active,
      requirePasswordChange: user.requirePasswordChange || false
    });
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await User.delete(userId);
        await loadUsersAndCarriers();
        setSuccess('Usuário excluído com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError('Erro ao excluir usuário');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  // CORREÇÃO: Função para abrir o formulário de novo usuário
  const handleNewUser = () => {
    resetForm(); // Limpa o formulário
    setEditingUser(null); // Garante que não estamos editando
    setShowForm(true); // Mostra o formulário
    setError(''); // Limpa erros
    setSuccess(''); // Limpa mensagens de sucesso
  };

  // ✅ ATUALIZADO: Filtrar usuários baseado na busca E excluir motoristas
  const filteredUsers = users
    .filter(user => user.userType !== 'driver') // ✅ Exclui motoristas da lista
    .filter(user => 
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.userType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.carrierName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // ✅ NOVO: Lógica de paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // ✅ NOVO: Função para mudar página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // ✅ NOVO: Reset página quando busca muda
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Volta para primeira página ao buscar
  };

  const getUserTypeColor = (userType) => {
    switch (userType) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'carrier': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserTypeLabel = (userType) => {
    switch (userType) {
      case 'admin': return 'Administrador';
      case 'carrier': return 'Transportadora';
      case 'driver': return 'Motorista'; // Should not appear due to filter, but good to have
      default: return 'Usuário';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <UserIcon className="w-6 h-6 mr-2 text-green-600" />
          Gerenciamento de Usuários
        </h2>
        <Button 
          onClick={handleNewUser}
          className="bg-green-600 hover:bg-green-700"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Mensagens de Feedback */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
          <span className="text-green-700 text-sm">{success}</span>
        </div>
      )}
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Formulário de Usuário */}
      {showForm && (
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetForm}
              >
                ✕ Fechar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Nome Completo *</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    id="fullName" 
                    type="text" 
                    value={formData.fullName} 
                    onChange={(e) => handleInputChange('fullName', e.target.value)} 
                    placeholder="Digite o nome completo" 
                    className="pl-10" 
                    required 
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Apenas letras e espaços - máximo 50 caracteres</p>
              </div>
              
              <div>
                <Label htmlFor="username">Nome de Usuário *</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    id="username" 
                    type="text" 
                    value={formData.username} 
                    onChange={(e) => handleInputChange('username', e.target.value)} 
                    placeholder="Digite o nome de usuário" 
                    className="pl-10" 
                    required 
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Letras, números, pontos e underscores - máximo 25 caracteres</p>
              </div>
              
              <div>
                <Label htmlFor="email">Email *</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => handleInputChange('email', e.target.value)} 
                    placeholder="Digite o email" 
                    className="pl-10" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <Label>Tipo de Usuário *</Label>
                <Select value={formData.userType} onValueChange={(value) => handleInputChange('userType', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="carrier">Transportadora</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="driver">Motorista</SelectItem> {/* Keep driver in form for creation, but filtered from list */}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.userType === 'carrier' && (
                <div className="md:col-span-2">
                  <Label htmlFor="carrierName">Transportadora *</Label>
                  <Select value={formData.carrierName} onValueChange={(value) => handleInputChange('carrierName', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a transportadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.length > 0 ? (
                        carriers.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.name}>
                            <div className="flex items-center">
                              <Building className="w-4 h-4 mr-2 text-gray-500" />
                              {carrier.name}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={null} disabled>Nenhuma transportadora ativa encontrada</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label htmlFor="password">Senha {editingUser ? '(Opcional)' : '*'}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    id="password" 
                    type="password" 
                    value={formData.password} 
                    onChange={(e) => handleInputChange('password', e.target.value)} 
                    placeholder={editingUser ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} 
                    className="pl-10" 
                    required={!editingUser} 
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirmar Senha {editingUser ? '(Opcional)' : '*'}</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={formData.confirmPassword} 
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)} 
                    placeholder="Confirme a senha" 
                    className="pl-10" 
                    required={!editingUser && !!formData.password} 
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="active-mode" 
                  checked={formData.active} 
                  onCheckedChange={(checked) => handleInputChange('active', checked)} 
                />
                <Label htmlFor="active-mode">Usuário Ativo</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="require-password-change" 
                  checked={formData.requirePasswordChange} 
                  onCheckedChange={(checked) => handleInputChange('requirePasswordChange', checked)} 
                />
                <Label htmlFor="require-password-change">Exigir troca de senha no primeiro login</Label>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Salvando...' : (editingUser ? 'Atualizar Usuário' : 'Criar Usuário')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              type="text" 
              placeholder="Buscar por nome, email, transportadora..." 
              value={searchTerm} 
              onChange={(e) => handleSearchChange(e.target.value)} 
              className="pl-10" 
            />
          </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Carregando usuários...
                      </TableCell>
                    </TableRow>
                  ) : currentUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'Nenhum usuário encontrado com os critérios de busca.' : 'Nenhum usuário cadastrado ainda.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>
                          <Badge className={getUserTypeColor(user.userType)}>
                            {getUserTypeLabel(user.userType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.carrierName || 'N/A'}</TableCell>
                        <TableCell>
                            <Badge 
                                variant={user.active ? 'default' : 'secondary'} 
                                className={user.active ? 'bg-green-100 text-green-800' : ''}
                            >
                                {user.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                            {user.requirePasswordChange && (
                                <Badge className="bg-orange-100 text-orange-800 ml-1">
                                    Trocar Senha
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button 
                              onClick={() => handleEdit(user)} 
                              variant="outline" 
                              size="sm"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              onClick={() => handleDelete(user.id)} 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
            </Table>

            {/* ✅ NOVA: Seção de paginação */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4 border-t mt-4">
                  <div className="text-sm text-gray-700">
                    Mostrando {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuários
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className={`w-8 h-8 ${currentPage === page ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

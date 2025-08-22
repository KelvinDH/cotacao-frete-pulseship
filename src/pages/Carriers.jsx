
import React, { useState, useEffect } from 'react';
import { Building, Plus, Edit, Trash2, Search, Truck, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Carrier } from '@/components/ApiDatabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CarriersPage() {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true); // Changed initial state to true for data loading
  const [showForm, setShowForm] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // ✅ NOVO: Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Constant for items per page
  const [formData, setFormData] = useState({
    name: '',
    modalities: [],
    active: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const modalityOptions = [
    { value: 'paletizados', label: 'Paletizados', icon: '📦' },
    { value: 'bag', label: 'BAG', icon: '🎒' },
    { value: 'granel', label: 'Granel', icon: '🌾' }
  ];

  useEffect(() => {
    loadCarriers();
  }, []);

  const loadCarriers = async () => {
    setLoading(true); // Set loading to true when starting to load carriers
    try {
      const carriersList = await Carrier.list();
      setCarriers(carriersList);
      setError(''); // Clear any previous error on successful load
    } catch (error) {
      console.error('Error loading carriers:', error);
      setError('Falha ao carregar transportadoras. Verifique se a API está online.');
    } finally {
      setLoading(false); // Set loading to false after loading is complete
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      modalities: [],
      active: true
    });
    setEditingCarrier(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  // ✅ NOVA FUNÇÃO: Para abrir o formulário de criação
  const handleAddNew = () => {
    setEditingCarrier(null);
    setFormData({
      name: '',
      modalities: [],
      active: true,
    });
    setShowForm(true);
    window.scrollTo(0, 0); // Rola para o topo da página para ver o formulário
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (error) setError('');
  };

  const handleModalityToggle = (modality, checked) => {
    setFormData(prev => ({
      ...prev,
      modalities: checked
        ? [...prev.modalities, modality]
        : prev.modalities.filter(m => m !== modality)
    }));
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Nome da transportadora é obrigatório');
      return false;
    }

    if (formData.modalities.length === 0) {
      setError('Selecione pelo menos uma modalidade');
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
      const carrierData = {
        name: formData.name.trim(),
        modalities: formData.modalities,
        active: formData.active
      };

      if (editingCarrier) {
        await Carrier.update(editingCarrier.id, carrierData);
        setSuccess('Transportadora atualizada com sucesso!');
      } else {
        await Carrier.create(carrierData);
        setSuccess('Transportadora criada com sucesso!');
      }
      
      await loadCarriers();
      resetForm();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMessage = err.message || 'Erro ao salvar transportadora';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (carrier) => {
    setEditingCarrier(carrier);
    setFormData({
      name: carrier.name,
      modalities: Array.isArray(carrier.modalities) ? carrier.modalities : (carrier.type ? [carrier.type] : []),
      active: carrier.active !== false
    });
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (carrierId) => {
    if (window.confirm('Tem certeza que deseja excluir esta transportadora?')) {
      try {
        await Carrier.delete(carrierId);
        await loadCarriers();
        setSuccess('Transportadora excluída com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError('Erro ao excluir transportadora');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  const handleToggleActive = async (carrier) => {
    try {
      const updatedCarrier = { ...carrier, active: !carrier.active };
      await Carrier.update(carrier.id, updatedCarrier);
      await loadCarriers();
      setSuccess(`Transportadora ${carrier.active ? 'desativada' : 'ativada'} com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Erro ao alterar status da transportadora');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Filtrar transportadoras baseado na busca
  const filteredCarriers = carriers.filter(carrier =>
    carrier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (Array.isArray(carrier.modalities) ? carrier.modalities : [])
      .some(modality => modalityOptions.find(opt => opt.value === modality)?.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ✅ NOVO: Lógica de paginação
  const totalPages = Math.ceil(filteredCarriers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCarriers = filteredCarriers.slice(startIndex, endIndex);

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

  const getModalityColor = (modality) => {
    switch (modality) {
      case 'paletizados': return 'bg-blue-100 text-blue-800';
      case 'bag': return 'bg-purple-100 text-purple-800';
      case 'granel': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getModalityLabel = (modality) => {
    const option = modalityOptions.find(opt => opt.value === modality);
    return option ? `${option.icon} ${option.label}` : modality;
  };

  const getCarrierModalities = (carrier) => {
    // Compatibilidade com formato antigo (type) e novo (modalities)
    if (Array.isArray(carrier.modalities)) {
      return carrier.modalities;
    } else if (carrier.type) {
      return [carrier.type];
    }
    return [];
  };

  return (
    <div className="p-6">
      <div className="max-w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Building className="w-7 h-7 mr-3 text-green-600" />
            Transportadoras
          </h1>
          {/* ✅ CORRIGIDO: Botão agora chama a nova função handleAddNew */}
          <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-5 h-5 mr-2" />
            Nova Transportadora
          </Button>
        </div>

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

        {showForm && (
          <Card className="mb-6 shadow-lg border border-gray-200">
            <CardHeader>
              <CardTitle>
                {editingCarrier ? 'Editar Transportadora' : 'Criar Nova Transportadora'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Transportadora *</Label>
                  <div className="relative mt-1">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                      id="name" 
                      type="text" 
                      value={formData.name} 
                      onChange={(e) => handleInputChange('name', e.target.value)} 
                      placeholder="Ex: Transportes ABC Ltda" 
                      className="pl-10" 
                      required 
                      maxLength={100}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Modalidades * (Selecione uma ou mais)</Label>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {modalityOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                        <Checkbox
                          id={`modality-${option.value}`}
                          checked={formData.modalities.includes(option.value)}
                          onCheckedChange={(checked) => handleModalityToggle(option.value, checked)}
                        />
                        <label
                          htmlFor={`modality-${option.value}`}
                          className="text-sm font-medium cursor-pointer flex items-center"
                        >
                          <span className="text-lg mr-2">{option.icon}</span>
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.modalities.length > 0 && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700 font-medium">
                        ✓ {formData.modalities.length} modalidade(s) selecionada(s):
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.modalities.map((modality) => (
                          <Badge key={modality} className={getModalityColor(modality)}>
                            {getModalityLabel(modality)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
                    {loading ? 'Salvando...' : (editingCarrier ? 'Atualizar Transportadora' : 'Criar Transportadora')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Transportadoras Cadastradas</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                type="text" 
                placeholder="Buscar por nome ou modalidade..." 
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
                  <TableHead>Modalidades</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      Carregando transportadoras...
                    </TableCell>
                  </TableRow>
                ) : currentCarriers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'Nenhuma transportadora encontrada com os critérios de busca.' : 'Nenhuma transportadora cadastrada ainda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentCarriers.map((carrier) => {
                    const carrierModalities = getCarrierModalities(carrier);
                    
                    return (
                      <TableRow key={carrier.id} className={`${carrier.active === false ? 'opacity-60 bg-gray-50' : ''}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-600" />
                            {carrier.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {carrierModalities.map((modality) => (
                              <Badge key={modality} className={getModalityColor(modality)}>
                                {getModalityLabel(modality)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {carrier.active ? (
                            <Badge className="bg-green-100 text-green-800">Ativa</Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              onClick={() => handleToggleActive(carrier)} 
                              variant="outline" 
                              size="sm"
                              className={carrier.active === false ? 'text-green-600 hover:text-green-700' : 'text-orange-600 hover:text-orange-700'}
                            >
                              {carrier.active === false ? 'Ativar' : 'Desativar'}
                            </Button>
                            <Button onClick={() => handleEdit(carrier)} variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              onClick={() => handleDelete(carrier.id)} 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* ✅ NOVA: Seção de paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t mt-4">
                <div className="text-sm text-gray-700">
                  Mostrando {startIndex + 1}-{Math.min(endIndex, filteredCarriers.length)} de {filteredCarriers.length} transportadoras
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
    </div>
  );
}
